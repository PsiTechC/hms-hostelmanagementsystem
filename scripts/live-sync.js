// /* eslint-disable no-console */
// /**
//  * ZKTeco live-sync worker (JavaScript / Node)
//  *
//  * Mirrors your Python app flow:
//  *  - Load .env.local
//  *  - Connect to device
//  *  - Fetch users & attendance (snapshot or periodic)
//  *  - Insert into MongoDB with unique index (device_ip, user_id, timestamp_utc)
//  *  - Generate Excel by month (same status coloring & hours calc)
//  *  - Start/stop live sync polling loop
//  *
//  * Env (.env.local):
//  *   MONGODB_URI=mongodb://localhost:27017
//  *   MONGODB_DB=HMS
//  *   MONGODB_COLLECTION=attendance_logs
//  *   ZK_IP=192.168.1.250
//  *   ZK_PORT=4370
//  *   ZK_COMMKEY=0
//  *   SYNC_INTERVAL_MS=5000
//  *   LOG_LEVEL=info
//  *
//  * Usage:
//  *   node live-sync.js            # one-off snapshot + live sync (ctrl+c to stop)
//  *   node live-sync.js --no-sync  # only snapshot once
//  *
//  * Programmatic:
//  *   const worker = require('./live-sync')
//  *   await worker.fetchData()
//  *   await worker.startLiveSync()
//  *   await worker.generateExcel('2025-10', './Attendance_Report_2025-10.xlsx')
//  */

// require('dotenv').config({ path: process.env.DOTENV_PATH || '.env.local' });

// const { MongoClient } = require('mongodb');
// //const ExcelJS = require('exceljs');

// // ---- ZKTeco SDK (node) ------------------------------------------------------
// // We use node-zklib; swap this block if you use another SDK.
// let ZKLib;
// try {
//   ZKLib = require('node-zklib');
// } catch (e) {
//   console.error('Please install node-zklib: npm i node-zklib');
//   process.exit(1);
// }

// // ---- Config -----------------------------------------------------------------
// const cfg = {
//   mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
//   mongoDbName: process.env.MONGODB_DB || 'HMS',
//   mongoColl: process.env.MONGODB_COLLECTION || 'attendance_logs',
//   ip: process.env.ZK_IP || '192.168.1.250',
//   port: Number(process.env.ZK_PORT || 4370),
//   commKey: Number(process.env.ZK_COMMKEY || 0),
//   syncIntervalMs: Number(process.env.SYNC_INTERVAL_MS || 5000),
// };

// // ---- Globals ----------------------------------------------------------------
// let mongoClient = null;
// let col = null;
// let syncTimer = null;

// // Caches populated by last snapshot (used by Excel generation)
// let lastUsers = []; // [{uid, name}]
// let lastAttendances = []; // [{uid, timestamp: Date, punch: number}]
// let groupedByMonth = {}; // { 'YYYY-MM': { [DateString]: { [uid]: [[Date, punch], ...] } } }

// // ---- Utilities ---------------------------------------------------------------
// const log = (...args) => console.log('[live-sync]', ...args);

// // Unique key doc builder
// function buildDoc(deviceIP, devicePort, att, userMap) {
//   const ts = att.timestamp instanceof Date ? att.timestamp : new Date(att.timestamp);
//   const tsUTC = ts.toISOString();
//   const lookupKey = String(att.uid ?? att.user_id ?? att.userid ?? att.deviceUserId ?? att.userSn ?? '');
//   return {
//     device_ip: deviceIP,
//     device_port: devicePort,
//     user_id: lookupKey,
//     user_name: userMap.get(lookupKey) || `User ${lookupKey}`,
//     timestamp_utc: tsUTC,
//     punch: Number(att.punch ?? att.state ?? 0),
//     raw: {
//       timestamp: ts.toString(),
//       punch: att.punch ?? att.state ?? null,
//     },
//     ingested_at_utc: new Date().toISOString(),
//   };
// }

// // Hours math identical to Python
// const IN_PUNCHES = new Set([0, 3, 4]);
// const OUT_PUNCHES = new Set([1, 2, 5]);

// function minutesToHHMM(totalMinutes) {
//   const h = Math.floor(totalMinutes / 60);
//   const m = totalMinutes % 60;
//   return `${h}:${String(m).padStart(2, '0')}`;
// }

// function computeDailyMinutes(records) {
//   if (!records || !records.length) return 0;

//   const hasIn = records.some(([, p]) => IN_PUNCHES.has(p));
//   const hasOut = records.some(([, p]) => OUT_PUNCHES.has(p));
//   if (!hasIn && !hasOut) return 0;
//   if (hasIn && !hasOut) return 9 * 60;

//   const sorted = [...records].sort((a, b) => a[0] - b[0]);
//   let currentIn = null;
//   let total = 0;
//   for (const [ts, p] of sorted) {
//     if (IN_PUNCHES.has(p)) {
//       currentIn = ts;
//     } else if (OUT_PUNCHES.has(p)) {
//       if (currentIn) {
//         const delta = Math.floor((ts - currentIn) / 60000);
//         if (delta > 0) total += delta;
//         currentIn = null;
//       }
//     }
//   }
//   return total;
// }

// // Group attendances same as Python
// function groupAttendances(attendances) {
//   // result: { 'YYYY-MM': { dateISO: { [uid]: [[Date, punch], ...] } } }
//   const byMonth = {};
//   for (const a of attendances) {
//     const ts = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
//     const yearMonth = `${ts.getUTCFullYear()}-${String(ts.getUTCMonth() + 1).padStart(2, '0')}`;
//     const dateISO = ts.toISOString().slice(0, 10); // YYYY-MM-DD
//     const uid = String(a.uid ?? a.user_id ?? a.userid);
//     const punch = Number(a.punch ?? a.state ?? 0);

//     byMonth[yearMonth] ??= {};
//     byMonth[yearMonth][dateISO] ??= {};
//     byMonth[yearMonth][dateISO][uid] ??= [];
//     byMonth[yearMonth][dateISO][uid].push([ts, punch]);
//   }
//   return byMonth;
// }

// // ---- Mongo ------------------------------------------------------------------
// async function connectMongo() {
//   if (mongoClient) return;
//   mongoClient = new MongoClient(cfg.mongoUri, { maxPoolSize: 10 });
//   await mongoClient.connect();
//   const db = mongoClient.db(cfg.mongoDbName);
//   col = db.collection(cfg.mongoColl);
//   // Unique index for dedupe
//   try {
//     await col.createIndex(
//       { device_ip: 1, user_id: 1, timestamp_utc: 1 },
//       { unique: true, name: 'uniq_device_user_ts' }
//     );
//   } catch (_) {}
//   log(`MongoDB connected to ${cfg.mongoDbName}/${cfg.mongoColl}`);
// }

// // ---- ZKTeco I/O -------------------------------------------------------------
// async function withZK(fn) {
//   // node-zklib signature
//   const zk = new ZKLib(cfg.ip, cfg.port, 10000, cfg.commKey, 0);
//   try {
//     await zk.createSocket();
//   } catch (e) {
//     throw new Error(`Unable to connect to device ${cfg.ip}:${cfg.port} - ${e.message || e}`);
//   }

//   try {
//     // disable device during bulk ops
//     try { await zk.disableDevice(); } catch (_) {}

//     const result = await fn(zk);

//     try { await zk.enableDevice(); } catch (_) {}
//     try { await zk.disconnect(); } catch (_) {}

//     return result;
//   } catch (e) {
//     try { await zk.enableDevice(); } catch (_) {}
//     try { await zk.disconnect(); } catch (_) {}
//     throw e;
//   }
// }

// async function getUsersAndAttendances() {
//   return withZK(async (zk) => {
//     // SDK differences handled here
//     // Users
//     let users = [];
//     // try a list of possible user-fetch method names (different SDK forks use different names)
//     const userMethods = ['getUsers', 'get_users', 'get_users_list', 'getUsersList', 'get_user_list'];
//     for (const m of userMethods) {
//       if (typeof zk[m] === 'function') {
//         try { users = await zk[m](); break; } catch (e) { /* try next */ }
//       }
//     }
//     if (!Array.isArray(users)) {
//       // try to unwrap common wrapper shapes
//       if (users && typeof users === 'object') {
//         for (const k of ['users','userList','usersList','items','Items','result','data']) {
//           if (Array.isArray(users[k])) { users = users[k]; break; }
//         }
//       }
//       if (!Array.isArray(users) && Array.isArray(zk.users)) users = zk.users;
//       if (!Array.isArray(users)) users = [];
//     }

//     // Attendance logs — try multiple possible method names used by various SDKs
//     let atts = [];
//     const attendanceMethods = [
//       'getAttendances',
//       'getAttendancesList',
//       'getAttendance',
//       'getAttendanceLogs',
//       'getAttendanceData',
//       'getLogs',
//       'getPunches',
//       'getAllAttendance',
//       'get_attendance',
//       'get_attendances',
//     ];

//     let rawAtt = null;
//     for (const m of attendanceMethods) {
//       if (typeof zk[m] === 'function') {
//         try { rawAtt = await zk[m](); break; } catch (e) { /* try next */ }
//       }
//     }
//     if (!rawAtt) {
//       throw new Error('No getAttendances()/getAttendance() found on SDK');
//     }

//     // unwrap array-like responses (some SDKs return { attendances: [...] })
//     if (Array.isArray(rawAtt)) {
//       atts = rawAtt;
//     } else if (rawAtt && typeof rawAtt === 'object') {
//       // common wrapper keys
//       for (const k of ['attendances','attendance','logs','records','data','result','list','items','Items']) {
//         if (Array.isArray(rawAtt[k])) { atts = rawAtt[k]; break; }
//       }
//       if (!atts.length) {
//         // fallback: try to coerce object values to array
//         try { atts = Array.from(rawAtt); } catch (_) { atts = [] }
//       }
//     }

//     // Normalize field names to {uid, timestamp, punch}
//     atts = atts.map((a) => ({
//       uid: a.uid ?? a.userId ?? a.user_id ?? a.userid ?? a.deviceUserId ?? a.userSn,
//       timestamp: a.timestamp ?? a.recordTime ?? a.time ?? a.attendanceTime ?? new Date(),
//       punch: a.state ?? a.punch ?? a.punch_code ?? a.type ?? 0,
//     }));

//     return { users, attendances: atts };
//   });
// }

// // ---- Core Ops ---------------------------------------------------------------
// async function fetchData() {
//   await connectMongo();
//   log('Fetching data from device...');
//   const { users, attendances } = await getUsersAndAttendances();

//   // Build user map (uid -> name)
//   const userMap = new Map();
//   // helper: register multiple possible id keys for the same user name
//   function registerUserKeys(map, u, name) {
//     const keys = ['uid', 'userId', 'user_id', 'userid', 'deviceUserId', 'userSn', 'pin'];
//     for (const k of keys) {
//       if (Object.prototype.hasOwnProperty.call(u, k) && u[k] != null && String(u[k]) !== '') {
//         try { map.set(String(u[k]), name); } catch (_) {}
//       }
//     }
//     // also register numeric uid if present in u.uid-like props
//     const primary = u.uid ?? u.userId ?? u.user_id ?? u.userid ?? u.deviceUserId ?? u.userSn ?? u.pin;
//     if (primary != null && String(primary) !== '') map.set(String(primary), name);
//   }

//   for (const u of users) {
//     const uidRaw = u.uid ?? u.userId ?? u.user_id ?? u.userid ?? u.deviceUserId ?? u.userSn ?? u.pin ?? '';
//     const uid = uidRaw != null ? String(uidRaw) : '';
//     const name = (u.name || u.FullName || u.nameString || u.userName || u.user_name || '').trim() || (uid ? `User ${uid}` : '');
//     registerUserKeys(userMap, u, name);
//   }
//   // Fill orphan users from attendance
//   for (const a of attendances) {
//     const uid = String(a.uid ?? a.user_id ?? a.userid ?? a.deviceUserId ?? a.userSn ?? '');
//     if (!userMap.has(uid)) userMap.set(uid, `Unknown ${uid}`);
//   }

//   // Insert idempotently
//   let inserted = 0;
//   for (const att of attendances) {
//     const doc = buildDoc(cfg.ip, cfg.port, att, userMap);
//     try {
//       await col.insertOne(doc);
//       inserted += 1;
//     } catch (e) {
//       if (e && e.code === 11000) {
//         // duplicate
//       } else {
//         log('Insert error:', e.message || e);
//       }
//     }
//   }
//   log(`Inserted ${inserted} attendance records`);

//   // Cache for Excel/report
//   lastUsers = [...userMap.entries()].map(([uid, name]) => ({ uid, name }));
//   lastAttendances = attendances.map((a) => ({
//     uid: String(a.uid ?? a.user_id ?? a.userid ?? a.deviceUserId ?? a.userSn ?? ''),
//     timestamp: a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp),
//     punch: Number(a.punch ?? 0),
//   }));
//   groupedByMonth = groupAttendances(lastAttendances);

//   const months = Object.keys(groupedByMonth).sort();
//   log(`Data fetched. Months available: ${months.join(', ') || 'None'}`);
//   return { users: lastUsers, months, groupedByMonth };
// }

// async function liveSyncOnce() {
//   await connectMongo();
//   try {
//     const { users, attendances } = await getUsersAndAttendances();

//     const userMap = new Map();
//     function registerUserKeys(map, u, name) {
//       const keys = ['uid', 'userId', 'user_id', 'userid', 'deviceUserId', 'userSn', 'pin'];
//       for (const k of keys) {
//         if (Object.prototype.hasOwnProperty.call(u, k) && u[k] != null && String(u[k]) !== '') {
//           try { map.set(String(u[k]), name); } catch (_) {}
//         }
//       }
//       const primary = u.uid ?? u.userId ?? u.user_id ?? u.userid ?? u.deviceUserId ?? u.userSn ?? u.pin;
//       if (primary != null && String(primary) !== '') map.set(String(primary), name);
//     }

//     for (const u of users) {
//       const uidRaw = u.uid ?? u.userId ?? u.user_id ?? u.userid ?? u.deviceUserId ?? u.userSn ?? u.pin ?? '';
//       const uid = uidRaw != null ? String(uidRaw) : '';
//       const name = (u.name || u.FullName || u.nameString || u.userName || u.user_name || '').trim() || (uid ? `User ${uid}` : '');
//       registerUserKeys(userMap, u, name);
//     }

//     // Fill orphan users from attendance so we can show a friendly name when users list misses an entry
//     for (const a of attendances) {
//       const uid = String(a.uid ?? a.user_id ?? a.userid ?? a.deviceUserId ?? a.userSn ?? '');
//       if (uid && !userMap.has(uid)) userMap.set(uid, `Unknown ${uid}`);
//     }

//     let inserted = 0;
//     for (const att of attendances) {
//       const doc = buildDoc(cfg.ip, cfg.port, att, userMap);
//       try {
//         await col.insertOne(doc);
//         inserted += 1;
//       } catch (e) {
//         if (e && e.code === 11000) {
//           // duplicate
//         } else {
//           log('Live insert error:', e.message || e);
//         }
//       }
//     }
//     if (inserted) log(`Live sync inserted ${inserted} records`);

//     // keep caches fresh (optional)
//     const merged = [...(lastAttendances || []), ...attendances.map(a => ({
//       uid: String(a.uid ?? a.user_id ?? a.userid ?? a.deviceUserId ?? a.userSn ?? ''),
//       timestamp: a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp),
//       punch: Number(a.punch ?? 0),
//     }))];
//     lastAttendances = merged;
//     groupedByMonth = groupAttendances(lastAttendances);
//   } catch (e) {
//     log('Live sync error:', e.message || e);
//   }
// }

// async function startLiveSync() {
//   if (syncTimer) return;
//   log(`Live sync started (every ${cfg.syncIntervalMs} ms)`);
//   syncTimer = setInterval(() => {
//     // run and log errors internally
//     liveSyncOnce();
//   }, cfg.syncIntervalMs);
// }

// async function stopLiveSync() {
//   if (syncTimer) {
//     clearInterval(syncTimer);
//     syncTimer = null;
//     log('Live sync stopped');
//   }
// }

// // // ---- Excel Export -----------------------------------------------------------
// // /**
// //  * generateExcel('YYYY-MM', '/path/to/file.xlsx')
// //  */
// // async function generateExcel(yearMonth, outputPath) {
// //   if (!groupedByMonth || !groupedByMonth[yearMonth]) {
// //     throw new Error('Fetch data first or invalid month.');
// //   }

// //   // Users sorted by name
// //   const userList = [...(lastUsers || [])].sort((a, b) =>
// //     a.name.localeCompare(b.name)
// //   );

// //   const [Y, M] = yearMonth.split('-').map(Number);
// //   const numDays = new Date(Y, M, 0).getDate(); // days in month

// //   const wb = new ExcelJS.Workbook();
// //   const ws = wb.addWorksheet(yearMonth);

// //   // Header styles
// //   const headFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8C00' } };
// //   const headFont = { bold: true, color: { argb: 'FFFFFFFF' } };
// //   const center = { vertical: 'middle', horizontal: 'center' };

// //   ws.getCell('A1').value = 'Name';
// //   Object.assign(ws.getCell('A1'), { font: headFont });
// //   ws.getCell('A1').fill = headFill;
// //   ws.getCell('A1').alignment = center;

// //   for (let day = 1; day <= numDays; day++) {
// //     const col = day + 1; // B is day 1
// //     const c = ws.getCell(1, col);
// //     c.value = day;
// //     c.font = headFont;
// //     c.fill = headFill;
// //     c.alignment = center;
// //   }

// //   const totalCol = numDays + 2;
// //   ws.getCell(1, totalCol).value = 'Total';
// //   ws.getCell(1, totalCol).font = headFont;
// //   ws.getCell(1, totalCol).fill = headFill;
// //   ws.getCell(1, totalCol).alignment = center;

// //   ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

// //   // Colors
// //   const fillPresent = { type: 'pattern', pattern: 'solid', fgColor: { argb: '00FF00' } };
// //   const fillHalfDay = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } };
// //   const fillAbsent = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0000' } };

// //   let row = 2;
// //   for (const { uid, name } of userList) {
// //     ws.getCell(row, 1).value = name;

// //     let monthlyTotal = 0;

// //     for (let day = 1; day <= numDays; day++) {
// //       const dateISO = `${yearMonth}-${String(day).padStart(2, '0')}`;
// //       const records = (groupedByMonth[yearMonth][dateISO]?.[uid]) || [];

// //       const ins = records.filter(([, p]) => IN_PUNCHES.has(p)).map(([ts]) => ts).sort((a, b) => a - b);
// //       const outs = records.filter(([, p]) => OUT_PUNCHES.has(p)).map(([ts]) => ts).sort((a, b) => a - b);

// //       const hasIn = ins.length > 0;
// //       const hasOut = outs.length > 0;

// //       let status = 'A';
// //       let fill = fillAbsent;
// //       if (hasIn && hasOut) {
// //         status = 'P';
// //         fill = fillPresent;
// //       } else if (hasIn || hasOut) {
// //         status = 'HD';
// //         fill = fillHalfDay;
// //       }

// //       const dailyMin = computeDailyMinutes(records);
// //       monthlyTotal += dailyMin;

// //       const firstInTxt = hasIn ? `${ins[0].getHours().toString().padStart(2, '0')}:${ins[0].getMinutes().toString().padStart(2, '0')}` : '-';
// //       const lastOutTxt = hasOut ? `${outs[outs.length - 1].getHours().toString().padStart(2, '0')}:${outs[outs.length - 1].getMinutes().toString().padStart(2, '0')}` : '-';
// //       const hrsTxt = minutesToHHMM(dailyMin);

// //       const col = day + 1;
// //       const cell = ws.getCell(row, col);
// //       cell.value = `${status}\nIn: ${firstInTxt}\nOut: ${lastOutTxt}\nHrs: ${hrsTxt}`;
// //       cell.fill = fill;
// //       cell.alignment = { horizontal: 'center', vertical: 'top', wrapText: true };
// //     }

// //     ws.getCell(row, totalCol).value = minutesToHHMM(monthlyTotal);
// //     ws.getCell(row, totalCol).alignment = center;
// //     ws.getCell(row, totalCol).font = { bold: true };

// //     row += 1;
// //   }

// //   // Column widths
// //   ws.getColumn(1).width = 20;
// //   for (let d = 1; d <= numDays; d++) {
// //     ws.getColumn(d + 1).width = 14;
// //   }
// //   ws.getColumn(totalCol).width = 12;

// //   // Row heights
// //   for (let r = 2; r < row; r++) {
// //     ws.getRow(r).height = 48;
// //   }

// //   await wb.xlsx.writeFile(outputPath);
// //   log(`Excel saved to ${outputPath}`);
// // }

// // ---- Exports (for programmatic usage) ---------------------------------------
// module.exports = {
//   fetchData,
//   startLiveSync,
//   stopLiveSync,
//   liveSyncOnce,
//  /// generateExcel,
//   _config: cfg,
// };

// // ---- CLI entry --------------------------------------------------------------
// if (require.main === module) {
//   (async () => {
//     try {
//       await fetchData();

//       if (process.argv.includes('--no-sync')) {
//         log('Snapshot complete (no live sync requested).');
//         return;
//       }

//       await startLiveSync();

//       // graceful shutdown
//       const cleanup = async () => {
//         await stopLiveSync();
//         if (mongoClient) await mongoClient.close().catch(() => {});
//         process.exit(0);
//       };
//       process.on('SIGINT', cleanup);
//       process.on('SIGTERM', cleanup);
//     } catch (e) {
//       console.error(e);
//       process.exit(1);
//     }
//   })();
// }
