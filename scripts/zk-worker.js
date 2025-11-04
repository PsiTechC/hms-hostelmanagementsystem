// /* eslint-disable no-console */
// /**
//  * ZKTeco live-sync worker (single device)
//  * Mirrors the Python flow:
//  *  - Connect
//  *  - Disable device during bulk snapshot
//  *  - Fetch users and attendance
//  *  - Insert to MongoDB with unique index (device_ip, user_id, timestamp_utc)
//  *  - Re-enable device
//  *  - Then: keep realtime listener + periodic polling running
//  *
//  * Env (use a .env.local):
//  *   MONGODB_URI=mongodb://localhost:27017
//  *   MONGODB_DB=HMS
//  *   MONGODB_COLLECTION=attendance_logs
//  *   ZK_IP=192.168.1.250
//  *   ZK_PORT=4370
//  *   ZK_COMMKEY=0
//  *   ATTENDANCE_POLL_MS=5000
//  *   LOG_LEVEL=info
//  */

// require('dotenv').config({ path: process.env.DOTENV_PATH || '.env.local' });

// const pino = require('pino');
// const { MongoClient } = require('mongodb');
// const ZKLib = require('node-zklib');

// const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// // --- ENV & Defaults
// const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
// const MONGODB_DB = process.env.MONGODB_DB || 'HMS';
// const ATTENDANCE_COLLECTION = process.env.MONGODB_COLLECTION || 'attendance_logs';

// //const ZK_IP = process.env.ZK_IP || '192.168.1.250';
// //const ZK_PORT = Number(process.env.ZK_PORT || 4370);
// const ZK_COMMKEY = Number(process.env.ZK_COMMKEY || 0);

// // Polling fallback (ms). Keep on (>= 3000 recommended) even if realtime works.
// const ATTENDANCE_POLL_MS = Number(process.env.ATTENDANCE_POLL_MS || 5000);
// // devices list poll interval (ms) for hot-add/remove
// const DEVICE_POLL_MS = Number(process.env.DEVICE_POLL_MS || 15000);

// // --- Helpers (same semantics as your Python)
// const IN_PUNCHES = new Set([0, 3, 4]);
// const OUT_PUNCHES = new Set([1, 2, 5]);

// function punchToEvent(code) {
//   if (code === undefined || code === null || Number.isNaN(code)) return 'unknown';
//   if (IN_PUNCHES.has(code)) return 'checkin';
//   if (OUT_PUNCHES.has(code)) return 'checkout';
//   return 'unknown';
// }

// // unwrap variants some node-zklib forks return
// function unwrapList(x) {
//   if (Array.isArray(x)) return x;
//   if (x && typeof x === 'object') {
//     for (const k of ['attendances', 'attendance', 'logs', 'records', 'data', 'result', 'list', 'items', 'Items']) {
//       if (Array.isArray(x[k])) return x[k];
//     }
//   }
//   return [];
// }

// function toUTCISOString(dateLike) {
//   let d = dateLike;
//   // Accept Date, objects with toDate(), and MongoDB Extended JSON { $date: '...' }
//   if (!(d instanceof Date)) {
//     if (d && typeof d === 'object') {
//       // Mongo extended JSON wrapper
//       if (Object.prototype.hasOwnProperty.call(d, '$date')) d = d.$date;
//       else if (typeof d.toDate === 'function') d = d.toDate();
//     }
//     d = new Date(String(d));
//   }
//   // store ISO without 'Z' but explicit +00:00 to match your Node file style
//   return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().replace('Z', '+00:00');
// }

// // Try many common fields for punch code and coerce strings like "in"/"out" to numeric codes
// function resolvePunchCode(obj) {
//   if (!obj || typeof obj !== 'object') return Number.NaN;
//   const candidates = ['punch', 'punch_code', 'type', 'state', 'verify', 'verifyMode', 'att_flag', 'punchState', 'action', 'status'];
//   for (const k of candidates) {
//     if (Object.prototype.hasOwnProperty.call(obj, k)) {
//       const v = obj[k];
//       if (v === null || v === undefined) continue;
//       if (typeof v === 'number' && !Number.isNaN(v)) return Number(v);
//       if (typeof v === 'string') {
//         const s = v.toLowerCase().trim();
//         if (s === '' || s === 'null') continue;
//         if (s.includes('in')) return 0;
//         if (s.includes('out')) return 1;
//         if (s.includes('checkin')) return 0;
//         if (s.includes('checkout')) return 1;
//         // try parse as number
//         const n = Number(s.replace(/[^0-9.-]/g, ''));
//         if (!Number.isNaN(n)) return n;
//       }
//     }
//   }
//   return Number.NaN;
// }

// async function main() {
//   // --- Mongo
//   const mongo = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
//   await mongo.connect();
//   const db = mongo.db(MONGODB_DB);
//   const col = db.collection(ATTENDANCE_COLLECTION);

//   logger.info(
//     { db: MONGODB_DB, uri: MONGODB_URI.replace(/(mongodb\+srv:\/\/)[^@]+@/, '$1****@') },
//     'MongoDB connected'
//   );

//   // Unique index for idempotency (device_ip + user_id + timestamp_utc)
//   try {
//     // Check existing indexes first to avoid IndexOptionsConflict (code 85)
//     const existing = await col.indexes();
//     const sameKey = existing.find((ix) => {
//       const k = ix.key || {};
//       return k.device_ip === 1 && k.user_id === 1 && k.timestamp_utc === 1;
//     });

//     if (sameKey) {
//       logger.info({ name: sameKey.name }, 'Unique index already exists');
//     } else {
//       await col.createIndex(
//         { device_ip: 1, user_id: 1, timestamp_utc: 1 },
//         { unique: true, name: 'uniq_device_user_ts' }
//       );
//       logger.info('Created unique index uniq_device_user_ts');
//     }
//   } catch (e) {
//     // If a weird race or options conflict happens, log details but continue
//     logger.debug({ err: e }, 'Unique index creation (maybe already exists or conflict)');
//   }

//   // --- Multi-device worker startup
//   const DEVICES_COLLECTION = process.env.DEVICES_COLLECTION || 'devices';
//   const devicesCol = db.collection(DEVICES_COLLECTION);

//   const workers = new Map(); // key: device._id -> { stop: fn }
//   const reconTimers = new Map(); // key: device._id -> timer

//   // schedule a reconnect loop for a device (id must be stable string)
//   function scheduleReconnect(device, id, deviceIp, devicePort, deviceComm) {
//     if (reconTimers.has(id)) return;
//     const intervalMs = Math.max(5000, Math.floor(DEVICE_POLL_MS / 3));
//     const rt = setInterval(async () => {
//       logger.info({ device: id }, 'Reconnect tick — testing connectivity');
//       const tester = new ZKLib(deviceIp, devicePort, 5000, 2000, deviceComm);
//       try {
//         await tester.createSocket();
//         logger.info({ device: id }, 'Reconnect successful — restarting worker');
//         try { await tester.disconnect(); } catch(_){}
//         clearInterval(rt);
//         reconTimers.delete(id);
//         // start worker again
//         runDevice(device).catch((err) => logger.debug({ err, device: id }, 'runDevice after reconnect failed'));
//       } catch (err) {
//         try { await tester.disconnect(); } catch(_){}
//         logger.debug({ err, device: id }, 'Reconnect attempt failed');
//       }
//     }, intervalMs);
//     reconTimers.set(id, rt);
//   }
//   async function runDevice(device) {
//     const id = String(device._id ?? device.id ?? `${device.ip}:${device.port}`);
//     if (workers.has(id)) return; // already running

//     const deviceIp = device.ip || device.deviceIp || device.host || ZK_IP;
//   const devicePort = Number(device.port ?? device.device_port ?? ZK_PORT ?? 4370);
//   const deviceComm = Number(device.commKey ?? device.comm_key ?? ZK_COMMKEY ?? 0);

//     logger.info({ device: id, ip: deviceIp, port: devicePort }, 'Starting worker for device');

//     const zk = new ZKLib(deviceIp, devicePort, 10000, 4000, deviceComm);
//   let pollTimer = null;
//     let lastSeen = null;
//     let lastSnapCount = null;
//   let failureCount = 0; // consecutive poll failures
//     const userMap = new Map();

//     // helper to stop this worker
//     let socketCloseHandler = null;
//     let socketErrorHandler = null;
//     const stopper = async () => {
//       logger.info({ device: id }, 'Stopping worker');
//       if (pollTimer) clearInterval(pollTimer);
//       // remove socket listeners
//       try {
//         if (zk && zk.socket) {
//           if (socketCloseHandler) zk.socket.removeListener('close', socketCloseHandler);
//           if (socketErrorHandler) zk.socket.removeListener('error', socketErrorHandler);
//         }
//       } catch (_) {}
//       // clear any reconnect timer for this device
//       try { if (reconTimers.has(id)) { clearInterval(reconTimers.get(id)); reconTimers.delete(id); } } catch(_) {}
//       try { await zk.disconnect(); } catch (e) {}
//       workers.delete(id);
//     };


//     try {
//       await zk.createSocket();
//       logger.info({ device: id, ip: deviceIp, port: devicePort }, 'Connected to device');
//       // register the worker only after successful connection so failed
//       // connection attempts don't leave a stale entry and prevent retries
//       workers.set(id, { stop: stopper });
//       try { if (zk && zk.socket && typeof zk.socket.setMaxListeners === 'function') zk.socket.setMaxListeners(50); } catch {}
//       // attach socket listeners to detect abrupt disconnects (e.g. wire pulled)
//       try {
//         if (zk && zk.socket) {
//           socketCloseHandler = async (hadError) => {
//             logger.warn({ device: id, hadError }, 'Device socket closed unexpectedly');
//             try { await devicesCol.updateOne({ _id: device._id }, { $set: { online: false, syncing: false } }); } catch(_){}
//             try { await stopper(); } catch (err) { logger.debug({ err, id }, 'Failed stopping worker after socket close'); }
//             scheduleReconnect(device, id, deviceIp, devicePort, deviceComm);
//           };
//           socketErrorHandler = async (err) => {
//             logger.warn({ device: id, err }, 'Device socket error');
//             try { await devicesCol.updateOne({ _id: device._id }, { $set: { online: false, syncing: false } }); } catch(_){}
//             try { await stopper(); } catch (e) { logger.debug({ err: e, id }, 'Failed stopping worker after socket error'); }
//             scheduleReconnect(device, id, deviceIp, devicePort, deviceComm);
//           };
//           zk.socket.on('close', socketCloseHandler);
//           zk.socket.on('error', socketErrorHandler);
//         }
//       } catch (e) { logger.debug({ err: e, device: id }, 'Failed to attach socket listeners'); }
//       // mark device online and syncing
//       try {
//         await devicesCol.updateOne(
//           { _id: device._id },
//           { $set: { online: true, syncing: true, lastSeen: new Date() } },
//           { upsert: false }
//         );
//       } catch (err) {
//         logger.debug({ err, device: id }, 'Failed to update device status (online)');
//       }
//     } catch (e) {
//       logger.error({ err: e, device: id }, 'Failed to connect to device');
//       try { await zk.disconnect(); } catch {}
//       try {
//         await devicesCol.updateOne({ _id: device._id }, { $set: { online: false, syncing: false } });
//       } catch (_) {}
//       return;
//     }

//     // seed lastSeen/lastSnapCount from DB for this device
//     try {
//       const last = await col.find({ device_ip: deviceIp }).sort({ timestamp_utc: -1 }).limit(1).toArray();
//       if (last[0]?.timestamp_utc) lastSeen = new Date(last[0].timestamp_utc);
//     } catch (e) {
//       logger.debug({ err: e, device: id }, 'Could not seed lastSeen');
//     }
//     try {
//       const cnt = await col.countDocuments({ device_ip: deviceIp });
//       lastSnapCount = cnt || 0;
//     } catch (e) {}

//     // load users (register multiple id variants so deviceUserId/userSn/etc. resolve)
//     try {
//       const raw = await zk.getUsers();
//       const users = unwrapList(raw);
//       for (const u of users) {
//         const name = (u.name || u.FullName || u.nameString || u.userName || u.user_name || '').trim();
//         // derive a friendly fallback name if none provided
//         const primary = u.uid ?? u.userId ?? u.user_id ?? u.userid ?? u.deviceUserId ?? u.userSn ?? u.pin ?? '';
//         const fallback = primary ? `User ${String(primary)}` : '';
//         const resolvedName = name || fallback;

//         // register multiple possible id keys to point to the same name
//         const keys = ['uid', 'userId', 'user_id', 'userid', 'deviceUserId', 'userSn', 'pin'];
//         for (const k of keys) {
//           if (Object.prototype.hasOwnProperty.call(u, k) && u[k] != null && String(u[k]) !== '') {
//             try { userMap.set(String(u[k]), resolvedName); } catch (_) {}
//           }
//         }
//         // ensure primary as well
//         if (primary != null && String(primary) !== '') userMap.set(String(primary), resolvedName);
//       }
//       logger.info({ device: id, count: userMap.size }, 'Users loaded for device');
//     } catch (e) {
//       logger.debug({ err: e, device: id }, 'getUsers failed (continuing)');
//     }

//     // bulk snapshot on connect
//     try {
//       try { if (typeof zk.disableDevice === 'function') await zk.disableDevice(); } catch {}
//       const methodCandidates = ['getAttendance','getAttendances','getAttendanceLogs','getAttendanceData','getLogs','getPunches','getAllAttendance'];
//       let snapshot = [];
//       for (const m of methodCandidates) {
//         if (typeof zk[m] === 'function') {
//           try { snapshot = unwrapList(await zk[m]()); if (snapshot.length) break; } catch(_) {}
//         }
//       }

//       if (snapshot.length) {
//         console.log('[snapshot][%s] records=%d', deviceIp, snapshot.length);
//         let _snapshotUpdated = false;
//         for (const rec of snapshot) {
//           try {
//             // include common device variants so we don't lose the user id
//             const user_id = String(rec.user_id ?? rec.userId ?? rec.uid ?? rec.deviceUserId ?? rec.userSn ?? rec.pin ?? 'unknown');
//             const rawTs = rec.timestamp ?? rec.attendanceTime ?? rec.time ?? rec.dateTime ?? rec.punchTime ?? rec.recordTime ?? rec.timeStr ?? new Date();
//             const tsISO = toUTCISOString(rawTs);
//             const punch_code = resolvePunchCode(rec);
//             const event_type = punchToEvent(punch_code);
//             const user_name = userMap.get(user_id) || rec.name || rec.userName || rec.user_name || rec.FullName || `User ${user_id}`;
//             const doc = { device_ip: deviceIp, device_port: devicePort, user_id, user_name, timestamp_utc: tsISO, punch: Number.isNaN(punch_code) ? null : punch_code, event_type, raw: rec, ingested_at_utc: toUTCISOString(new Date()) };
//             try { await col.insertOne(doc); const d = new Date(tsISO); if (!lastSeen || d > lastSeen) lastSeen = d; _snapshotUpdated = true; } catch (ie) { if (ie?.code !== 11000) throw ie; }
//           } catch (inner) { logger.error({ err: inner, rec, device: id }, 'Snapshot record failed'); }
//         }
//         if (_snapshotUpdated) console.log('[snapshot][%s] updated lastSeen=%s', deviceIp, lastSeen ? lastSeen.toISOString() : 'null');
//         lastSnapCount = snapshot.length;
//       }
//     } catch (e) { logger.debug({ err: e, device: id }, 'Snapshot step failed'); }
//     finally { try { if (typeof zk.enableDevice === 'function') await zk.enableDevice(); } catch {} }

//     // realtime
//     try {
//       zk.getRealTimeLogs(async (payload) => {
//         try { const tsRaw = payload.timestamp ?? payload.attendanceTime ?? payload.time ?? payload.dateTime ?? payload.punchTime ?? payload.recordTime ?? null; console.log('[realtime-callback][%s] keys=%o tsRaw=%o', deviceIp, Object.keys(payload || {}), tsRaw); } catch(__){}
//         try {
//           const user_id = String(payload.user_id ?? payload.userId ?? payload.uid ?? payload.deviceUserId ?? payload.userSn ?? payload.pin ?? 'unknown');
//           const tsISO = toUTCISOString(payload.timestamp ?? payload.attendanceTime ?? payload.time ?? payload.dateTime ?? payload.recordTime ?? new Date());
//           const punch_code = resolvePunchCode(payload);
//           const event_type = punchToEvent(punch_code);
//           const user_name = userMap.get(user_id) || payload.name || payload.userName || payload.user_name || payload.FullName || `User ${user_id}`;
//           const doc = { device_ip: deviceIp, device_port: devicePort, user_id, user_name, timestamp_utc: tsISO, punch: Number.isNaN(punch_code) ? null : punch_code, event_type, raw: payload, ingested_at_utc: toUTCISOString(new Date()) };
//           try { await col.insertOne(doc); console.log('[db-insert][realtime][%s] user=%s at=%s', deviceIp, user_id, tsISO); const d = new Date(tsISO); if (!lastSeen || d > lastSeen) lastSeen = d; } catch (e) { if (e?.code === 11000) {} else logger.error({ err: e, payload, device: id }, 'Realtime insert failed'); }
//           // update device lastSeen heartbeat
//           try { await devicesCol.updateOne({ _id: device._id }, { $set: { lastSeen: new Date(), online: true, syncing: true } }); } catch (_) {}
//         } catch (e) { logger.error({ err: e, payload, device: id }, 'Realtime processing failed'); }
//       });
//     } catch (e) { logger.debug({ err: e, device: id }, 'Realtime hook failed (continuing with poll)'); }

//     // poll fallback
//     if (ATTENDANCE_POLL_MS > 0) {
//       pollTimer = setInterval(async () => {
//         try {
//           const methods = ['getAttendance','getAttendances','getAttendanceLogs','getAttendanceData','getLogs','getPunches','getAllAttendance'];
//           let snap = [];
//           let usedMethod = null;
//           for (const m of methods) { if (typeof zk[m] === 'function') { try { snap = unwrapList(await zk[m]()); if (snap.length) { usedMethod = m; break; } } catch(_){} } }
//           if (!snap.length) return;
//           try {
//             const sample = snap[0];
//             const sampleTs = sample.timestamp ?? sample.attendanceTime ?? sample.time ?? sample.dateTime ?? sample.punchTime ?? sample.recordTime ?? null;
//             let sampleStr = '';
//             try { sampleStr = JSON.stringify(sample, null, 2).slice(0, 1000); } catch(_) { sampleStr = String(sample); }
//             let sampleTsParsed = null;
//             try { if (sampleTs instanceof Date) sampleTsParsed = sampleTs; else if (sampleTs && typeof sampleTs === 'object' && typeof sampleTs.toDate === 'function') sampleTsParsed = sampleTs.toDate(); else if (sampleTs) sampleTsParsed = new Date(String(sampleTs)); } catch(_){}
//             console.log('[poll-snap][%s] records=%d usedMethod=%s lastSeen=%s sampleTs=%o', deviceIp, snap.length, usedMethod, lastSeen ? lastSeen.toISOString() : 'null', sampleTs);
//             console.log('[poll-sample-full][%s] %s', deviceIp, sampleStr);
//             console.log('[poll-sample-parsed][%s] sampleTsParsed=%s lastSeen=%s', deviceIp, sampleTsParsed ? sampleTsParsed.toISOString() : 'null', lastSeen ? lastSeen.toISOString() : 'null');
//           } catch(__){}

//           // detect appended records by count or timestamp
//           let newOnes = [];
//           try {
//             const parsed = snap.map((rec) => {
//               const rawTs = rec.timestamp ?? rec.attendanceTime ?? rec.time ?? rec.dateTime ?? rec.punchTime ?? rec.recordTime ?? rec.timeStr ?? null;
//               let ts = null;
//               try { if (rawTs instanceof Date) ts = rawTs; else if (rawTs && typeof rawTs === 'object' && typeof rawTs.toDate === 'function') ts = rawTs.toDate(); else if (rawTs) ts = new Date(String(rawTs)); } catch(_){}
//               if (!ts) ts = new Date();
//               return { rec, ts };
//             });
//             const snapCount = snap.length;
//             const delta = snapCount - (lastSnapCount || 0);
//             if (delta > 0) { newOnes = parsed.slice(-delta); console.log('[poll][%s] detected appended records by count: delta=%d lastSnapCount=%d', deviceIp, delta, lastSnapCount || 0); }
//             else { newOnes = parsed.filter(({ ts }) => !lastSeen || ts > lastSeen); }
//           } catch (err) { logger.debug({ err, device: id }, 'Error while computing newOnes'); }

//           if (!newOnes.length) { console.log('[poll][%s] newOnes=0 — nothing newer than lastSeen %s and no appended delta', deviceIp, lastSeen ? lastSeen.toISOString() : 'null'); lastSnapCount = snap.length; try { await devicesCol.updateOne({ _id: device._id }, { $set: { online: true, syncing: false, lastSeen: new Date() } }); } catch(_){}; return; }
//           console.log('[poll][%s] newOnes=%d', deviceIp, newOnes.length);

//           for (const { rec, ts } of newOnes) {
//             try {
//               // include deviceUserId and userSn fallbacks as some firmwares send these
//               const user_id = String(rec.user_id ?? rec.userId ?? rec.uid ?? rec.deviceUserId ?? rec.userSn ?? rec.pin ?? 'unknown');
//               const tsISO = toUTCISOString(ts);
//               const punch_code = resolvePunchCode(rec);
//               const event_type = punchToEvent(punch_code);
//               const user_name = userMap.get(user_id) || rec.name || rec.userName || rec.user_name || rec.FullName || `User ${user_id}`;
//               const doc = { device_ip: deviceIp, device_port: devicePort, user_id, user_name, timestamp_utc: tsISO, punch: Number.isNaN(punch_code) ? null : punch_code, event_type, raw: rec, ingested_at_utc: toUTCISOString(new Date()) };
//               try { await col.insertOne(doc); console.log('[db-insert][poll][%s] user=%s at=%s', deviceIp, user_id, tsISO); if (!lastSeen || ts > lastSeen) lastSeen = ts; } catch (ie) { if (ie?.code !== 11000) throw ie; }
//               // heartbeat update per successful insert
//               try { await devicesCol.updateOne({ _id: device._id }, { $set: { lastSeen: new Date(), online: true, syncing: true } }); } catch (_) {}
//             } catch (inner) { logger.error({ err: inner, rec, device: id }, 'Poll record failed'); }
//           }
//           console.log('[poll][%s] inserted=%d', deviceIp, newOnes.length);
//           lastSnapCount = snap.length;
//           // end of poll cycle — mark syncing false until next work
//           try { await devicesCol.updateOne({ _id: device._id }, { $set: { syncing: false, online: true } }); } catch (_) {}
//           } catch (e) {
//             // increment failure counter and decide when to mark offline
//             failureCount = (failureCount || 0) + 1;
//             logger.debug({ err: e, device: id, failureCount }, 'Poll error');
//             // after several consecutive failures, assume connectivity lost
//             if (failureCount >= 3) {
//               logger.warn({ device: id, failureCount }, 'Consecutive poll failures — marking device offline and starting reconnect loop');
//               try { await devicesCol.updateOne({ _id: device._id }, { $set: { online: false, syncing: false } }); } catch(_) {}
//               // stop current worker
//               try { await stopper(); } catch (err) { logger.debug({ err, id }, 'Failed stopping worker after poll failures'); }

//               // schedule reconnect attempts (helper deduplicates)
//               scheduleReconnect(device, id, deviceIp, devicePort, deviceComm);
//             }
//           }
//       }, ATTENDANCE_POLL_MS);
//     }
//   }

//   // read devices and start workers for enabled devices
//   try {
//     const devices = await devicesCol.find({ enabled: { $ne: false } }).toArray();
//     // track current device docs for diffing
//     const currentDevices = new Map();
//     for (const d of devices) {
//       currentDevices.set(String(d._id), d);
//       runDevice(d);
//     }

//     // poll devices collection periodically to hot-add/remove/restart workers
//     const devicePollTimer = setInterval(async () => {
//       try {
//         const fresh = await devicesCol.find({ enabled: { $ne: false } }).toArray();
//         const freshMap = new Map();
//         for (const d of fresh) freshMap.set(String(d._id), d);

//         // start new devices
//         for (const [id, d] of freshMap) {
//           if (!currentDevices.has(id)) {
//             logger.info({ id }, 'New device detected — starting worker');
//             runDevice(d);
//           } else {
//             // if device changed (ip/port/commKey/enabled), restart
//             const prev = currentDevices.get(id);
//             const prevSig = `${prev.ip || ''}:${prev.port || ''}:${prev.commKey || ''}:${prev.enabled}`;
//             const newSig = `${d.ip || ''}:${d.port || ''}:${d.commKey || ''}:${d.enabled}`;
//             if (prevSig !== newSig) {
//               logger.info({ id }, 'Device changed — restarting worker');
//               if (workers.has(id)) {
//                 try { await workers.get(id).stop(); } catch (e) { logger.debug({ err: e, id }, 'Failed stopping changed worker'); }
//               }
//               runDevice(d);
//             }
//           }
//         }

//         // stop removed devices
//         for (const [id, prev] of currentDevices) {
//           if (!freshMap.has(id)) {
//             logger.info({ id }, 'Device removed or disabled — stopping worker');
//             if (workers.has(id)) {
//               try { await workers.get(id).stop(); } catch (e) { logger.debug({ err: e, id }, 'Failed stopping removed worker'); }
//             }
//           }
//         }

//         // replace currentDevices map
//         currentDevices.clear();
//         for (const [id, d] of freshMap) currentDevices.set(id, d);
//       } catch (err) {
//         logger.debug({ err }, 'Device poll failed');
//       }
//     }, DEVICE_POLL_MS);

//     // ensure we clear devicePollTimer on shutdown (handled below)
//   } catch (e) {
//     logger.debug({ err: e }, 'Could not read devices collection');
//   }

//   // graceful shutdown: stop all workers and close mongo
//   const shutdown = async () => {
//     logger.info('Shutting down… stopping device workers');
//     for (const [id, w] of workers) {
//       try { await w.stop(); } catch (e) { logger.debug({ err: e, id }, 'Failed to stop worker'); }
//     }
//     try { await mongo.close(); } catch (e) {}
//     // clear device poll timer if set
//     try { if (typeof devicePollTimer !== 'undefined' && devicePollTimer) clearInterval(devicePollTimer); } catch (e) {}
//     process.exit(0);
//   };
//   process.on('SIGINT', shutdown);
//   process.on('SIGTERM', shutdown);
// }

// main().catch((e) => {
//   console.error(e);
//   process.exit(1);
// });
