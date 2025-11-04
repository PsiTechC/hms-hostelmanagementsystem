// /* eslint-disable @typescript-eslint/no-var-requires */
// // Polling-based multi-device ZKTeco realtime listener
// // Places realtime punches into the MongoDB specified by .env.local

// // Load .env.local by default; override with DOTENV_PATH
// require('dotenv').config({ path: process.env.DOTENV_PATH || '.env.local' });
// const pino = require('pino');
// const { MongoClient, ObjectId } = require('mongodb');

// const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// // Defaults and env
// const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
// const MONGODB_DB = process.env.MONGODB_DB || 'attendance_db';
// const DEVICES_COLLECTION = process.env.DEVICES_COLLECTION || 'devices';
// const ATTENDANCE_COLLECTION = process.env.MONGODB_COLLECTION || 'attendance_logs';
// const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 15000);
// const ATTENDANCE_POLL_MS = Number(process.env.ATTENDANCE_POLL_MS || 5000);

// // node-zklib is CJS; require it at runtime
// const ZKLib = require('node-zklib');

// // Punch code mapping (same as original)
// const IN_PUNCHES = new Set([0, 3, 4]);
// const OUT_PUNCHES = new Set([1, 2, 5]);
// function punchToEvent(code) {
//   if (code === undefined || code === null) return 'unknown';
//   if (IN_PUNCHES.has(code)) return 'checkin';
//   if (OUT_PUNCHES.has(code)) return 'checkout';
//   return 'unknown';
// }

// function parseUserId(payload) {
//   // match the Python library field names: user_id, and common JS variants
//   const v = payload.user_id ?? payload.userId ?? payload.uid ?? payload.deviceUserId ?? payload.pin ?? 'unknown';
//   return String(v);
// }

// function parseTimestampUTC(payload) {
//   // Python attendance uses .timestamp (a datetime). Node variants may use attendanceTime, time, or timestamp.
//   const raw = payload.timestamp ?? payload.attendanceTime ?? payload.time ?? payload.dateTime ?? new Date();
//   // if raw is an object with a 'toDate' or similar, try to coerce
//   let date;
//   if (raw instanceof Date) {
//     date = raw;
//   } else if (raw && typeof raw === 'object' && typeof raw.toDate === 'function') {
//     date = raw.toDate();
//   } else {
//     date = new Date(String(raw));
//   }
//   return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().replace('Z', '+00:00');
// }

// class DeviceWorker {
//   constructor(db, deviceDoc) {
//     this.db = db;
//     this.device = deviceDoc; // keep original doc
//     this.id = String(deviceDoc._id);
//     this.ip = deviceDoc.ip;
//     this.port = Number(deviceDoc.port ?? 4370);
//     this.commKey = Number(deviceDoc.commKey ?? 0);
//     this.name = deviceDoc.name || `Device ${this.ip}`;
//     this.running = false;
//     this.zk = null;
//     this.backoff = 1000; // ms
//     this.maxBackoff = 60000;
//     this._stopped = false;
//     this.lastSeenTimestamp = null; // track last inserted attendance timestamp (Date)
//     this._attendancePollId = null;
//     this._attendanceMethodName = null;
//   }

//   async start() {
//     if (this.running) return;
//     this._stopped = false;
//     this.running = true;
//     logger.info({ device_id: this.id, ip: this.ip }, 'Starting device worker');
//     this._runLoop();
//   }

//   async stop() {
//     this._stopped = true;
//     this.running = false;
//     try {
//       // clear any attendance polling timer
//       try { if (this._attendancePollId) { clearInterval(this._attendancePollId); this._attendancePollId = null; } } catch(_) {}
//       if (this.zk && typeof this.zk.disconnect === 'function') {
//         await this.zk.disconnect();
//       }
//     } catch (e) {
//       logger.warn({ err: e }, 'Error disconnecting zk');
//     }
//     this.zk = null;
//     logger.info({ device_id: this.id }, 'Stopped worker');
//   }

//   async _runLoop() {
//     while (!this._stopped) {
//       try {
//         await this._connectAndListen();
//         // if connected, reset backoff
//         this.backoff = 1000;
//         // wait until disconnected or stopped
//         // _connectAndListen only returns on error/disconnect
//       } catch (e) {
//         logger.error({ device_id: this.id, err: e }, 'Device worker error');
//       }
//       if (this._stopped) break;
//       // wait backoff before retry
//       const wait = Math.min(this.backoff, this.maxBackoff);
//       logger.info({ device_id: this.id, wait }, 'Reconnecting after backoff');
//       await new Promise((r) => setTimeout(r, wait));
//       this.backoff = Math.min(this.backoff * 2, this.maxBackoff);
//     }
//   }

//   async _connectAndListen() {
//     // instantiate ZKLib and connect
//     this.zk = new ZKLib(this.ip, this.port, 10000, 4000, this.commKey);
//     try {
//       await this.zk.createSocket();
//       logger.info({ device_id: this.id, ip: this.ip, port: this.port }, 'Connected to device');
//     } catch (e) {
//       logger.warn({ device_id: this.id, err: e }, 'Failed to connect to device');
//       try { await this.zk.disconnect(); } catch {};
//       throw e;
//     }

//     const col = this.db.collection(ATTENDANCE_COLLECTION);

//     // load users for name map (best-effort)
//     const userMap = new Map();
//     try {
//       const usersRaw = await this.zk.getUsers();
//       // Normalize different return shapes from node-zklib forks
//       let users = []
//       if (Array.isArray(usersRaw)) {
//         users = usersRaw
//       } else if (usersRaw && typeof usersRaw === 'object') {
//         // Common wrappers: { users: [...] }, { data: [...] }, { result: [...] }
//         users = usersRaw.users || usersRaw.data || usersRaw.result || usersRaw.records || []
//       }
//       if (!Array.isArray(users)) {
//         // Not an iterable users list — log the raw value for debugging
//         console.log('[zk] unexpected users value:', usersRaw)
//         logger.debug({ device_id: this.id, usersRaw }, 'Unexpected users shape from getUsers')
//         users = []
//       }
//       for (const u of users) {
//         const key = String(u.uid ?? u.userId ?? u.deviceUserId ?? u.pin ?? '')
//         const name = (u.name || u.FullName || u.nameString || '').trim() || `User ${key}`
//         if (key) userMap.set(key, name)
//       }
//       logger.info({ device_id: this.id, count: userMap.size }, 'Users loaded for device');
//     } catch (e) {
//       logger.debug({ device_id: this.id, err: e }, 'Could not fetch users for device');
//     }

//   // --- FALLBACK: fetch attendance snapshot on connect (helps devices that don't push realtime)
//     try {
//       // try several possible method names for attendance snapshot depending on node-zklib fork
//       const attendanceMethodCandidates = [
//         'getAttendance',
//         'getAttendances',
//         'getAttendanceLogs',
//         'getAttendanceData',
//         'getLogs',
//         'getPunches',
//         'getAllAttendance',
//       ]
//       let attendanceSnapshot = null
//       for (const m of attendanceMethodCandidates) {
//         if (typeof this.zk[m] === 'function') {
//           try {
//             attendanceSnapshot = await this.zk[m]()
//             break
//           } catch (errMethod) {
//             logger.debug({ device_id: this.id, method: m, err: errMethod }, 'Candidate attendance method failed')
//           }
//         }
//       }
//       if (attendanceSnapshot == null) {
//         // no attendance method found — log available keys for debugging
//         const keys = Object.keys(this.zk || {})
//         // also inspect prototype methods (many libs put methods on prototype)
//         let protoKeys = []
//         try {
//           protoKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(this.zk || {})).filter(Boolean)
//         } catch (protoErr) {
//           // ignore
//         }
//         console.log('[zk-debug] no attendance method found for device=%s keys=%o proto=%o', this.id, keys, protoKeys)
//         logger.debug({ device_id: this.id, keys, protoKeys }, 'No attendance snapshot method available on zk instance')
//       }
//       if (attendanceSnapshot && attendanceSnapshot.length) {
//         // always print a concise snapshot line to console for immediate visibility
//         console.log('[snapshot] device=%s records=%d', this.id, attendanceSnapshot.length)
//         logger.info({ device_id: this.id, count: attendanceSnapshot.length }, 'Fetched attendance snapshot on connect');
//         for (const rec of attendanceSnapshot) {
//           try {
//             // Try to normalize record fields from different lib versions
//             // Prefer the Python-style fields: user_id, timestamp, punch
//             const user_id = String(rec.user_id ?? rec.userId ?? rec.uid ?? rec.pin ?? 'unknown');
//             const rawTs = rec.timestamp ?? rec.attendanceTime ?? rec.time ?? rec.dateTime ?? rec.punchTime ?? rec.timeStr ?? new Date();
//             const ts = rawTs instanceof Date ? rawTs : (rawTs && typeof rawTs.toDate === 'function' ? rawTs.toDate() : new Date(String(rawTs)));
//             const timestamp_utc = new Date(ts.getTime() - ts.getTimezoneOffset() * 60000).toISOString().replace('Z', '+00:00');
//             const punch_code = Number(rec.punch ?? rec.type ?? rec.state ?? rec.verify ?? Number.NaN);
//             const event_type = punchToEvent(Number.isNaN(punch_code) ? undefined : punch_code);
//             const user_name = userMap.get(user_id) || `User ${user_id}`;

//             const doc = {
//               device_id: this.id,
//               device_ip: this.ip,
//               device_name: this.name,
//               user_id,
//               user_name,
//               timestamp_utc,
//               punch_code: Number.isNaN(punch_code) ? null : punch_code,
//               event_type,
//               raw: rec,
//               ingested_at_utc: new Date().toISOString().replace('Z', '+00:00'),
//             };

//               try {
//                 const r = await col.insertOne(doc);
//                 logger.info({ device_id: this.id, insertedId: String(r.insertedId), user_id, at: timestamp_utc }, 'Inserted attendance from snapshot');
//                 console.log('[db-insert] snapshot device=%s insertedId=%s user=%s at=%s', this.id, String(r.insertedId), user_id, timestamp_utc)
//                 // update lastSeenTimestamp
//                 try {
//                   const tsDate = new Date(timestamp_utc);
//                   if (!this.lastSeenTimestamp || tsDate > this.lastSeenTimestamp) this.lastSeenTimestamp = tsDate;
//                 } catch (uErr) {}
//               } catch (ie) {
//               if (ie?.code === 11000) {
//                 logger.debug({ device_id: this.id, key: ie?.keyValue }, 'Duplicate snapshot record ignored');
//               } else {
//                 logger.error({ device_id: this.id, err: ie, rec }, 'Failed to insert snapshot record');
//               }
//             }
//           } catch (inner) {
//             logger.error({ device_id: this.id, err: inner, rec }, 'Failed to process snapshot record');
//           }
//         }
//       }
//     } catch (e) {
//       logger.debug({ device_id: this.id, err: e }, 'Could not fetch attendance snapshot on connect');
//     }

//     // start periodic polling for attendance as a fallback (some devices don't emit realtime)
//     try {
//       if (!this._attendancePollId && ATTENDANCE_POLL_MS > 0) {
//         console.log('[zk-debug] starting attendance poll for device=%s every %dms', this.id, ATTENDANCE_POLL_MS)
//         this._attendancePollId = setInterval(async () => {
//           try {
//             // attempt to fetch attendance via same candidate methods
//             const attendanceMethodCandidates = [
//               'getAttendance', 'getAttendances', 'getAttendanceLogs', 'getAttendanceData', 'getLogs', 'getPunches', 'getAllAttendance'
//             ];
//             let snap = null;
//             for (const m of attendanceMethodCandidates) {
//               if (typeof this.zk[m] === 'function') {
//                 try { snap = await this.zk[m](); break; } catch (err) { /* ignore per-method errors */ }
//               }
//             }
//             if (snap && Array.isArray(snap) && snap.length) {
//               console.log('[poll-snapshot] device=%s records=%d', this.id, snap.length)
//               // filter new records by lastSeenTimestamp
//               const newRecs = [];
//               for (const rec of snap) {
//                 try {
//                   const rawTs = rec.timestamp ?? rec.attendanceTime ?? rec.time ?? rec.dateTime ?? rec.punchTime ?? rec.timeStr ?? new Date();
//                   const ts = rawTs instanceof Date ? rawTs : (rawTs && typeof rawTs.toDate === 'function' ? rawTs.toDate() : new Date(String(rawTs)));
//                   if (!this.lastSeenTimestamp || ts > this.lastSeenTimestamp) newRecs.push({rec, ts});
//                 } catch (e) {}
//               }
//               if (newRecs.length) {
//                 logger.info({ device_id: this.id, newCount: newRecs.length }, 'Polled attendance: inserting new records');
//                 for (const {rec, ts} of newRecs) {
//                   try {
//                     const user_id = String(rec.userId ?? rec.uid ?? rec.user_id ?? rec.pin ?? 'unknown');
//                     const timestamp_utc = new Date(ts.getTime() - ts.getTimezoneOffset() * 60000).toISOString().replace('Z', '+00:00');
//                     const punch_code = Number(rec.punch ?? rec.type ?? rec.state ?? rec.verify ?? Number.NaN);
//                     const event_type = punchToEvent(Number.isNaN(punch_code) ? undefined : punch_code);
//                     const user_name = userMap.get(user_id) || `User ${user_id}`;
//                     const doc = { device_id: this.id, device_ip: this.ip, device_name: this.name, user_id, user_name, timestamp_utc, punch_code: Number.isNaN(punch_code) ? null : punch_code, event_type, raw: rec, ingested_at_utc: new Date().toISOString().replace('Z', '+00:00') };
//                     try { const r = await col.insertOne(doc); logger.info({ device_id: this.id, insertedId: String(r.insertedId) }, 'Inserted polled attendance'); }
//                     catch (ie) { if (ie?.code === 11000) logger.debug({ device_id: this.id }, 'Duplicate polled record ignored'); else logger.error({ device_id: this.id, err: ie }, 'Failed to insert polled record'); }
//                     // update lastSeenTimestamp
//                     if (!this.lastSeenTimestamp || ts > this.lastSeenTimestamp) this.lastSeenTimestamp = ts;
//                   } catch (inner) { logger.error({ device_id: this.id, err: inner }, 'Failed to process polled record'); }
//                 }
//               }
//             }
//           } catch (pollErr) {
//             logger.debug({ device_id: this.id, err: pollErr }, 'Attendance poll error');
//           }
//         }, ATTENDANCE_POLL_MS);
//       }
//     } catch (pollStartErr) {
//       logger.debug({ device_id: this.id, err: pollStartErr }, 'Could not start attendance poll timer');
//     }

//     // attach realtime handler
//     await new Promise((resolve) => {
//       // the library gives us a callback for real-time logs
//       this.zk.getRealTimeLogs(async (payload) => {
//         // debug: log the raw realtime payload so we can confirm events arrive
//         try {
//           // print realtime payload to console so it's visible even if pino level hides debug
//           console.log('[realtime] device=%s payload=%o', this.id, payload)
//           logger.debug({ device_id: this.id, payload }, 'Realtime payload received')
//         } catch (e) {
//           // ignore logging errors
//         }
//         try {
//           // Normalize realtime payload fields using Python-style names first
//           const user_id = parseUserId(payload);
//           const timestamp_utc = parseTimestampUTC(payload);
//           const punch_code = Number(payload.punch ?? payload.punch_code ?? payload.type ?? payload.state ?? Number.NaN);
//           const event_type = punchToEvent(Number.isNaN(punch_code) ? undefined : punch_code);
//           const user_name = userMap.get(user_id) || `User ${user_id}`;

//           const doc = {
//             device_id: this.id,
//             device_ip: this.ip,
//             device_name: this.name,
//             user_id,
//             user_name,
//             timestamp_utc,
//             punch_code: Number.isNaN(punch_code) ? null : punch_code,
//             event_type,
//             raw: payload,
//             ingested_at_utc: new Date().toISOString().replace('Z', '+00:00'),
//           };

//           await col.insertOne(doc);
//           logger.info({ device_id: this.id, user_id, event_type, at: timestamp_utc }, 'Stored punch');
//           console.log('[db-insert] realtime device=%s user=%s at=%s', this.id, user_id, timestamp_utc)
//         } catch (e) {
//           if (e?.code === 11000) {
//             logger.debug({ device_id: this.id, key: e?.keyValue }, 'Duplicate punch ignored');
//           } else {
//             logger.error({ device_id: this.id, err: e, payload }, 'Failed to store realtime punch');
//           }
//         }
//       });

//       // some libraries keep the socket open; resolve never called until disconnect
//       // we listen for device disconnect via zk.disconnect or errors thrown by the lib
//       // If the library exposes an 'on' event for errors we'd attach it here; otherwise rely on try/catch
//       // Keep this promise unresolved so runLoop stays alive while connected
//     });
//   }
// }

// async function main() {
//   const mongo = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
//   await mongo.connect();
//   const db = mongo.db(MONGODB_DB);
//   logger.info({ db: MONGODB_DB, uri: MONGODB_URI.replace(/(mongodb\+srv:\/\/)[^@]+@/, '$1****@') }, 'MongoDB connected');

//   // Ensure a dedupe unique index similar to the Python tool
//   try {
//     await db.collection(ATTENDANCE_COLLECTION).createIndex(
//       { device_ip: 1, user_id: 1, timestamp_utc: 1 },
//       { unique: true, name: 'uniq_device_user_ts' }
//     );
//   } catch (idxErr) {
//     logger.debug({ err: idxErr }, 'Could not create unique index on attendance collection (might already exist)');
//   }

//   const workers = new Map();

//   // Sync devices from the devices collection and start/stop workers as needed
//   async function syncDevicesOnce() {
//     const seen = new Set();
//     const docs = await db.collection(DEVICES_COLLECTION).find({}).toArray();
//     for (const device of docs) {
//       const id = String(device._id);
//       seen.add(id);
//       // only consider enabled devices (boolean or missing treated as enabled)
//       const enabled = device.enabled === undefined ? true : Boolean(device.enabled);
//       if (!enabled) {
//         if (workers.has(id)) {
//           logger.info({ device_id: id }, 'Device disabled, stopping worker');
//           try { await workers.get(id).stop(); } catch (e) { logger.debug({ err: e }, 'Error stopping worker'); }
//           workers.delete(id);
//         }
//         continue;
//       }

//       const existing = workers.get(id);
//       const cfgChanged = existing && (
//         existing.ip !== device.ip ||
//         existing.port !== Number(device.port ?? 4370) ||
//         existing.commKey !== Number(device.commKey ?? 0) ||
//         existing.name !== (device.name || `Device ${device.ip}`)
//       );

//       if (existing && cfgChanged) {
//         logger.info({ device_id: id }, 'Device config changed, restarting worker');
//         try { await existing.stop(); } catch (e) { logger.debug({ err: e }, 'Error stopping worker'); }
//         workers.delete(id);
//       }

//       if (!workers.has(id)) {
//         const w = new DeviceWorker(db, device);
//         // expose some runtime fields for simple comparisons above
//         w.ip = device.ip;
//         w.port = Number(device.port ?? 4370);
//         w.commKey = Number(device.commKey ?? 0);
//         w.name = device.name || `Device ${device.ip}`;
//         workers.set(id, w);
//         try {
//           await w.start();
//         } catch (e) {
//           logger.error({ device_id: id, err: e }, 'Failed to start device worker');
//         }
//       }
//     }

//     // remove workers for devices no longer present
//     for (const [id, w] of workers.entries()) {
//       if (!seen.has(id)) {
//         logger.info({ device_id: id }, 'Device removed from DB, stopping worker');
//         try { await w.stop(); } catch (e) { logger.debug({ err: e }, 'Error stopping worker'); }
//         workers.delete(id);
//       }
//     }
//   }

//   // initial sync
//   await syncDevicesOnce();

//   // polling loop
//   const pollTimer = setInterval(async () => {
//     try {
//       await syncDevicesOnce();
//     } catch (e) {
//       logger.error({ err: e }, 'Error during device sync');
//     }
//   }, POLL_INTERVAL_MS);

//   // graceful shutdown
//   const shutdown = async () => {
//     logger.info('Shutting down…');
//     clearInterval(pollTimer);
//     for (const [id, w] of workers.entries()) {
//       try { await w.stop(); } catch (e) { logger.debug({ err: e }, 'Error stopping worker'); }
//     }
//     try { await mongo.close(); } catch (e) { logger.debug({ err: e }, 'Error closing mongo'); }
//     process.exit(0);
//   };
//   process.on('SIGINT', shutdown);
//   process.on('SIGTERM', shutdown);
// }

// main().catch((e) => {
//   // eslint-disable-next-line no-console
//   console.error(e);
//   process.exit(1);
// });
