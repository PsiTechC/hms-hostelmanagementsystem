#!/usr/bin/env tsx
/**
 * ZKTeco Device Sync Worker for HMS
 *
 * This worker runs independently and handles:
 * 1. Multi-device connection monitoring (ping/health check)
 * 2. Live attendance sync from ZKTeco biometric devices
 * 3. Automatic reconnection on device disconnects
 * 4. Per-hostel/organization dynamic collections
 *
 * Features:
 * - Reads device configurations from MongoDB `devices` collection
 * - Hot-add/remove devices without restart
 * - Realtime event capture + polling fallback
 * - Idempotent inserts (unique index: device_ip, user_id, timestamp_utc)
 * - Per-organization attendance collections (e.g., HostelA_attendance_logs)
 *
 * Usage:
 *   Development: tsx watch scripts/zk-device-worker.ts
 *   Production: tsx scripts/zk-device-worker.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { MongoClient, Db, Collection } from 'mongodb'
// Testing zkteco-js instead of node-zklib for complete attendance data
const Zkteco = require('zkteco-js');

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') })

// Configuration
const MONGODB_URI = process.env.MONGODB_URI
const MONGODB_DB = process.env.MONGODB_DB || 'HMS'
const DEVICES_COLLECTION = 'devices'
const ATTENDANCE_POLL_MS = Number(process.env.ZK_POLL_INTERVAL_MS || 5000) // Poll every 5 seconds
const DEVICE_LIST_POLL_MS = Number(process.env.ZK_DEVICE_LIST_POLL_MS || 15000) // Check for new devices every 15 seconds
const RECONNECT_INTERVAL_MS = 10000 // Try reconnecting every 10 seconds

// Punch codes (matching Python logic)
const IN_PUNCHES = new Set([0, 3, 4])
const OUT_PUNCHES = new Set([1, 2, 5])

// MongoDB connection
let mongoClient: MongoClient | null = null

interface Device {
  _id: any
  hostelId: any
  ip: string
  port?: number
  commKey?: number
  enabled?: boolean
  lastSeen?: Date
  online?: boolean
  syncing?: boolean
}

interface Hostel {
  _id: any
  name: string
}

interface DeviceWorker {
  device: Device
  zk: any
  pollTimer: NodeJS.Timeout | null
  lastSeen: Date | null
  lastSnapCount: number
  userMap: Map<string, string>
  failureCount: number
  stop: () => Promise<void>
}

// Active workers map
const workers = new Map<string, DeviceWorker>()
const reconnectTimers = new Map<string, NodeJS.Timeout>()
const deviceUserSnMaps = new Map<string, Map<number, { userId: string; name: string }>>()

async function connectDB() {
  if (mongoClient) return mongoClient

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI not set in environment')
  }

  mongoClient = new MongoClient(MONGODB_URI)
  await mongoClient.connect()
  console.log('[ZK Worker] MongoDB connected')

  return mongoClient
}

function sanitizeHostelName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_')
}

async function getCollectionNameForDevice(device: Device, db: any): Promise<string> {
  try {
    if (!device.hostelId) {
      console.warn(`[ZK Worker] Device ${device._id} has no hostelId, using default collection`)
      return 'default_attendance_logs'
    }

    // Fetch hostel to get its name
    const hostelsCol = db.collection('hostels')
    const hostel = await hostelsCol.findOne({ _id: device.hostelId })

    if (!hostel || !hostel.name) {
      console.warn(`[ZK Worker] Hostel not found for device ${device._id}, using default collection`)
      return 'default_attendance_logs'
    }

    const sanitizedName = sanitizeHostelName(hostel.name)
    return `${sanitizedName}_attendance_logs`
  } catch (err) {
    console.error('[ZK Worker] Error fetching hostel name:', err)
    return 'default_attendance_logs'
  }
}

function toUTCISOString(dateLike: any): string {
  let d = dateLike
  if (!(d instanceof Date)) {
    if (d && typeof d === 'object' && typeof d.toDate === 'function') {
      d = d.toDate()
    } else {
      d = new Date(String(d))
    }
  }
  return d.toISOString()
}

function formatRawTimestamp(dateLike: any): string {
  // Format as "YYYY-MM-DD HH:MM:SS" to match Python script format
  let d = dateLike
  if (!(d instanceof Date)) {
    if (d && typeof d === 'object' && typeof d.toDate === 'function') {
      d = d.toDate()
    } else {
      d = new Date(String(d))
    }
  }

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function resolvePunchCode(obj: any): number {
  if (!obj || typeof obj !== 'object') return NaN

  const candidates = ['punch', 'punch_code', 'type', 'state', 'verify', 'verifyMode', 'att_flag', 'punchState']
  for (const k of candidates) {
    if (obj[k] !== undefined && obj[k] !== null) {
      const v = obj[k]
      if (typeof v === 'number' && !isNaN(v)) return v
      if (typeof v === 'string') {
        const s = v.toLowerCase().trim()
        if (s.includes('in') || s.includes('checkin')) return 0
        if (s.includes('out') || s.includes('checkout')) return 1
        const n = Number(s.replace(/[^0-9.-]/g, ''))
        if (!isNaN(n)) return n
      }
    }
  }
  return NaN
}

function punchToEventType(code: number): string {
  if (isNaN(code)) return 'unknown'
  if (IN_PUNCHES.has(code)) return 'In'
  if (OUT_PUNCHES.has(code)) return 'Out'
  return 'unknown'
}

function unwrapList(x: any): any[] {
  if (Array.isArray(x)) return x
  if (x && typeof x === 'object') {
    for (const k of ['attendances', 'attendance', 'logs', 'records', 'data', 'result']) {
      if (Array.isArray(x[k])) return x[k]
    }
  }
  return []
}

async function ensureUniqueIndex(col: Collection) {
  try {
    const existing = await col.indexes()
    const hasIndex = existing.some((ix) => {
      const k = ix.key || {}
      return k.device_ip === 1 && k.user_id === 1 && k.timestamp_utc === 1
    })

    if (!hasIndex) {
      await col.createIndex(
        { device_ip: 1, user_id: 1, timestamp_utc: 1 },
        { unique: true, name: 'uniq_device_user_ts' }
      )
      console.log(`[ZK Worker] Created unique index on collection`)
    }
  } catch (err) {
    console.error('[ZK Worker] Error creating unique index:', err)
  }
}

async function insertAttendanceRecord(
  col: Collection,
  deviceIp: string,
  devicePort: number,
  rec: any,
  userMap: Map<string, string>,
  debugLog: boolean = false
): Promise<boolean> {
  try {
    // Log first few records for debugging to understand node-zklib structure
    if (debugLog) {
      console.log(`[ZK Worker] Raw attendance record from node-zklib:`, JSON.stringify(rec, null, 2))
      console.log(`[ZK Worker] Available keys:`, Object.keys(rec))
    }

    // zkteco-js library returns:
    // - user_id: String user identifier (need to map to actual userId from users)
    // - sn: Sequential number (can be used for user lookup)
    // - record_time: Timestamp
    // - type: Verification type (1=fingerprint, etc.) - NOT the punch code!
    // - state: The actual punch state code (0/3/4=in, 1/2/5=out) - THIS is what we need!

    // Extract user_id - zkteco-js uses 'user_id' field
    let user_id = String(
      rec.user_id ??        // zkteco-js field
      rec.deviceUserId ??   // node-zklib field
      rec.userId ??
      rec.uid ??
      rec.pin ??
      'unknown'
    )

    // Try to map numeric user_id (like "1") to actual userId (like "PSI00004")
    // by using the sn field to lookup in user records
    if (rec.sn !== undefined && rec.sn !== null) {
      const userSnMap = deviceUserSnMaps.get(deviceIp)
      if (userSnMap && userSnMap.has(rec.sn)) {
        const userData = userSnMap.get(rec.sn)!
        user_id = String(userData.userId || user_id)

        if (debugLog) {
          console.log(`[ZK Worker] Found sn ${rec.sn} → userId: ${user_id}, name: ${userData.name}`)
        }
      } else if (debugLog) {
        console.log(`[ZK Worker] sn ${rec.sn} not found in userSnMap (map size: ${userSnMap?.size || 0})`)
      }
    }

    // zkteco-js returns record_time (note the underscore)
    const rawTs = rec.record_time ?? rec.recordTime ?? rec.timestamp ?? rec.attendanceTime ?? rec.time ?? rec.dateTime ?? rec.punchTime ?? new Date()

    // Use the same format as raw.timestamp for consistency
     const timestamp_utc = formatRawTimestamp(rawTs)
       // const timestamp_utc = toUTCISOString(rawTs)


    // Extract punch code from zkteco-js
    // CRITICAL: 'state' is the punch code, 'type' is the verification method!
    // state: 0/3/4 = Check-in, 1/2/5 = Check-out
    let punch: number = 0 // Default to 0 (check-in) like Python script

    // Prioritize 'state' field first (zkteco-js), then fall back to other fields
    const attState = rec.state ?? rec.attState ?? rec.punch ?? rec.punch_code ?? rec.checkType ?? rec.type

    if (attState !== undefined && attState !== null) {
      if (typeof attState === 'number' && !isNaN(attState)) {
        punch = attState
      } else if (typeof attState === 'string') {
        const parsed = parseInt(attState, 10)
        if (!isNaN(parsed)) {
          punch = parsed
        }
      }
    }

    // Get user name from map, matching Python's approach
    const user_name = userMap.get(user_id) || rec.name || rec.userName || rec.user_name || `User ${user_id}`

    if (debugLog) {
      console.log(`[ZK Worker] Extracted user_id: "${user_id}"`)
      console.log(`[ZK Worker] Extracted punch: ${punch}`)
      console.log(`[ZK Worker] Extracted user_name: "${user_name}"`)
      console.log(`[ZK Worker] UserMap size: ${userMap.size}`)
      console.log(`[ZK Worker] UserMap has user_id "${user_id}": ${userMap.has(user_id)}`)
      if (userMap.size > 0 && userMap.size < 10) {
        console.log(`[ZK Worker] Full userMap:`, Array.from(userMap.entries()))
      }
    }

    const doc = {
      device_ip: deviceIp,
      device_port: devicePort,
      user_id,
      user_name,
      timestamp_utc,
      punch,
      raw: {
        timestamp: formatRawTimestamp(rawTs),
        punch: punch,
      },
      ingested_at_utc: formatRawTimestamp(new Date()),
    }

    await col.insertOne(doc)
    return true
  } catch (err: any) {
    if (err.code === 11000) {
      // Duplicate key - already exists, skip
      return false
    }
    throw err
  }
}

async function startDeviceWorker(device: Device, db: Db, devicesCol: Collection) {
  const deviceId = String(device._id)
  const deviceIp = device.ip
  const devicePort = device.port || 4370
  const deviceCommKey = device.commKey || 0

  console.log(`[ZK Worker] Starting worker for device ${deviceId} (${deviceIp}:${devicePort})`)

  // Get the attendance collection for this device's hostel
  const collName = await getCollectionNameForDevice(device, db)
  const attendanceCol = db.collection(collName)
  await ensureUniqueIndex(attendanceCol)

  console.log(`[ZK Worker] Device ${deviceId} will sync to collection: ${collName}`)

  const zk = new Zkteco(deviceIp, devicePort, 10000, 4000)
  const userMap = new Map<string, string>()
  let lastSeen: Date | null = null
  let lastSnapCount = 0
  let failureCount = 0
  let pollTimer: NodeJS.Timeout | null = null

  const stopWorker = async () => {
    console.log(`[ZK Worker] Stopping worker for device ${deviceId}`)
    if (pollTimer) clearInterval(pollTimer)
    try {
      await zk.disconnect()
    } catch (err) {
      // Ignore disconnect errors
    }
    workers.delete(deviceId)
  }

  try {
    // Connect to device
    await zk.createSocket()
    console.log(`[ZK Worker] Connected to device ${deviceId}`)

    // Register worker
    workers.set(deviceId, {
      device,
      zk,
      pollTimer,
      lastSeen,
      lastSnapCount,
      userMap,
      failureCount,
      stop: stopWorker,
    })

    // Update device status
    await devicesCol.updateOne(
      { _id: device._id },
      { $set: { online: true, syncing: true, lastSeen: new Date() } }
    )

    // Socket event handlers
    if (zk.socket) {
      zk.socket.on('close', async () => {
        console.log(`[ZK Worker] Device ${deviceId} socket closed`)
        await devicesCol.updateOne(
          { _id: device._id },
          { $set: { online: false, syncing: false } }
        )
        await stopWorker()
        scheduleReconnect(device, db, devicesCol)
      })

      zk.socket.on('error', async (err: Error) => {
        console.error(`[ZK Worker] Device ${deviceId} socket error:`, err.message)
        await devicesCol.updateOne(
          { _id: device._id },
          { $set: { online: false, syncing: false } }
        )
        await stopWorker()
        scheduleReconnect(device, db, devicesCol)
      })
    }

    // Seed lastSeen from database
    try {
      const last = await attendanceCol
        .find({ device_ip: deviceIp })
        .sort({ timestamp_utc: -1 })
        .limit(1)
        .toArray()
      if (last[0]?.timestamp_utc) {
        lastSeen = new Date(last[0].timestamp_utc)
      }
      const count = await attendanceCol.countDocuments({ device_ip: deviceIp })
      lastSnapCount = count || 0
    } catch (err) {
      console.error(`[ZK Worker] Failed to seed lastSeen for ${deviceId}:`, err)
    }

    // Load users
    try {
      const rawUsers = await zk.getUsers()
      const users = unwrapList(rawUsers)
      console.log(`[ZK Worker] Raw users response type:`, typeof rawUsers, Array.isArray(rawUsers) ? 'array' : 'object')
      console.log(`[ZK Worker] Unwrapped users count:`, users.length)

      if (users.length > 0) {
        console.log(`[ZK Worker] First user sample for device ${deviceId}:`, JSON.stringify(users[0], null, 2))
        console.log(`[ZK Worker] First user keys:`, Object.keys(users[0]))
      }

      // Build comprehensive user mappings
      // zkteco-js attendance records use 'sn' field which corresponds to user's uid
      // We need to map sn → userId (PSI00XXX format)
      const userSnMap = new Map<number, any>() // sn/uid → { userId, name }

      for (const u of users) {
        const name = (u.name || u.userName || u.user_name || '').trim()
        const userId = u.userId ?? u.user_id ?? u.uid ?? ''

        // zkteco-js: Store by uid (which matches attendance record's sn field)
        if (u.uid !== undefined && u.uid !== null) {
          userSnMap.set(u.uid, { userId, name })
        }

        // Also store by userSn if present (for node-zklib compatibility)
        if (u.userSn !== undefined && u.userSn !== null) {
          userSnMap.set(u.userSn, { userId, name })
        }

        // Also create string-based mappings for all ID types
        const idFields = [
          String(u.uid ?? ''),
          String(u.userId ?? ''),
          String(u.user_id ?? ''),
          String(u.deviceUserId ?? ''),
          String(u.userSn ?? ''),
          String(u.pin ?? ''),
          String(u.cardNo ?? ''),
          String(u.cardno ?? ''),  // zkteco-js uses lowercase 'cardno'
        ]

        for (const id of idFields) {
          if (id && id !== '' && id !== 'undefined' && id !== 'null') {
            const resolvedName = name || `User ${userId || id}`
            userMap.set(id, resolvedName)
          }
        }

        // CRITICAL: Store by userId as primary key (e.g., "PSI00004")
        if (userId && String(userId) !== '') {
          userMap.set(String(userId), name || `User ${userId}`)
        }
      }

      // Store userSnMap in module-level map for attendance processing
      deviceUserSnMaps.set(deviceIp, userSnMap)

      console.log(`[ZK Worker] Loaded ${userMap.size} entries in userMap, ${userSnMap.size} entries in userSnMap`)
      console.log(`[ZK Worker] UserSnMap sample:`, Array.from(userSnMap.entries()).slice(0, 3))
      if (userMap.size > 0) {
        const firstEntries = Array.from(userMap.entries()).slice(0, 5)
        console.log(`[ZK Worker] Sample user map entries:`, firstEntries)
      }
    } catch (err) {
      console.error(`[ZK Worker] Failed to load users for ${deviceId}:`, err)
    }

    // Initial bulk snapshot
    try {
      if (typeof zk.disableDevice === 'function') await zk.disableDevice()

      const methods = ['getAttendance', 'getAttendances', 'getAttendanceLogs', 'getAllAttendance']
      let snapshot: any[] = []
      for (const method of methods) {
        if (typeof (zk as any)[method] === 'function') {
          try {
            snapshot = unwrapList(await (zk as any)[method]())
            if (snapshot.length) break
          } catch (err) {
            // Try next method
          }
        }
      }

      if (snapshot.length) {
        console.log(`[ZK Worker] Fetched ${snapshot.length} records for device ${deviceId}`)
        console.log(`[ZK Worker] First record full structure:`, JSON.stringify(snapshot[0], null, 2))
        console.log(`[ZK Worker] All keys in first record:`, Object.keys(snapshot[0]))

        let inserted = 0
        let recordIndex = 0
        for (const rec of snapshot) {
          try {
            // Enable debug logging for first 5 records to see variations
            const debugLog = recordIndex < 5
            const success = await insertAttendanceRecord(attendanceCol, deviceIp, devicePort, rec, userMap, debugLog)
            if (success) {
              inserted++
              const ts = new Date(toUTCISOString(rec.timestamp ?? rec.attendanceTime ?? new Date()))
              if (!lastSeen || ts > lastSeen) lastSeen = ts
            }
            recordIndex++
          } catch (err) {
            console.error(`[ZK Worker] Failed to insert snapshot record:`, err)
          }
        }
        console.log(`[ZK Worker] Inserted ${inserted} new records for device ${deviceId}`)
        lastSnapCount = snapshot.length
      }
    } catch (err) {
      console.error(`[ZK Worker] Snapshot fetch failed for ${deviceId}:`, err)
    } finally {
      if (typeof zk.enableDevice === 'function') await zk.enableDevice()
    }

    // Setup realtime listener
    try {
      zk.getRealTimeLogs(async (payload: any) => {
        try {
          console.log(`[ZK Worker] Realtime event from ${deviceId}:`, payload.user_id ?? payload.userId)
          await insertAttendanceRecord(attendanceCol, deviceIp, devicePort, payload, userMap)
          const ts = new Date(toUTCISOString(payload.timestamp ?? payload.attendanceTime ?? new Date()))
          if (!lastSeen || ts > lastSeen) lastSeen = ts
          await devicesCol.updateOne(
            { _id: device._id },
            { $set: { lastSeen: new Date(), online: true, syncing: true } }
          )
        } catch (err) {
          console.error(`[ZK Worker] Realtime event processing failed:`, err)
        }
      })
    } catch (err) {
      console.error(`[ZK Worker] Realtime listener setup failed for ${deviceId}:`, err)
    }

    // Polling fallback
    if (ATTENDANCE_POLL_MS > 0) {
      pollTimer = setInterval(async () => {
        try {
          const methods = ['getAttendance', 'getAttendances', 'getAttendanceLogs', 'getAllAttendance']
          let snap: any[] = []
          for (const method of methods) {
            if (typeof (zk as any)[method] === 'function') {
              try {
                snap = unwrapList(await (zk as any)[method]())
                if (snap.length) break
              } catch (err) {
                // Try next method
              }
            }
          }

          if (!snap.length) return

          // Detect new records
          const parsed = snap.map((rec) => {
            const rawTs = rec.timestamp ?? rec.attendanceTime ?? rec.time ?? new Date()
            let ts: Date
            try {
              ts = new Date(toUTCISOString(rawTs))
            } catch (err) {
              ts = new Date()
            }
            return { rec, ts }
          })

          const snapCount = snap.length
          const delta = snapCount - lastSnapCount
          let newOnes: Array<{ rec: any; ts: Date }> = []

          if (delta > 0) {
            newOnes = parsed.slice(-delta)
            console.log(`[ZK Worker] Detected ${delta} new records by count for ${deviceId}`)
          } else {
            newOnes = parsed.filter(({ ts }) => !lastSeen || ts > lastSeen)
          }

          if (!newOnes.length) {
            lastSnapCount = snapCount
            await devicesCol.updateOne(
              { _id: device._id },
              { $set: { online: true, syncing: false, lastSeen: new Date() } }
            )
            return
          }

          let inserted = 0
          for (const { rec, ts } of newOnes) {
            try {
              const success = await insertAttendanceRecord(attendanceCol, deviceIp, devicePort, rec, userMap)
              if (success) {
                inserted++
                if (!lastSeen || ts > lastSeen) lastSeen = ts
              }
            } catch (err) {
              console.error(`[ZK Worker] Failed to insert poll record:`, err)
            }
          }

          if (inserted > 0) {
            console.log(`[ZK Worker] Inserted ${inserted} new records for device ${deviceId}`)
          }
          lastSnapCount = snapCount
          failureCount = 0 // Reset failure count on success

          await devicesCol.updateOne(
            { _id: device._id },
            { $set: { syncing: false, online: true, lastSeen: new Date() } }
          )
        } catch (err) {
          failureCount++
          console.error(`[ZK Worker] Poll error for ${deviceId} (failure ${failureCount}):`, err)

          if (failureCount >= 3) {
            console.log(`[ZK Worker] Device ${deviceId} failed ${failureCount} times, marking offline`)
            await devicesCol.updateOne(
              { _id: device._id },
              { $set: { online: false, syncing: false } }
            )
            await stopWorker()
            scheduleReconnect(device, db, devicesCol)
          }
        }
      }, ATTENDANCE_POLL_MS)

      // Store pollTimer in worker
      const worker = workers.get(deviceId)
      if (worker) worker.pollTimer = pollTimer
    }
  } catch (err) {
    console.error(`[ZK Worker] Failed to connect to device ${deviceId}:`, err)
    await devicesCol.updateOne(
      { _id: device._id },
      { $set: { online: false, syncing: false } }
    )
    await stopWorker()
    scheduleReconnect(device, db, devicesCol)
  }
}

function scheduleReconnect(device: Device, db: Db, devicesCol: Collection) {
  const deviceId = String(device._id)
  if (reconnectTimers.has(deviceId)) return // Already scheduled

  console.log(`[ZK Worker] Scheduling reconnect for device ${deviceId}`)

  const timer = setInterval(async () => {
    console.log(`[ZK Worker] Attempting to reconnect device ${deviceId}`)
    const deviceIp = device.ip
    const devicePort = device.port || 4370
    const deviceCommKey = device.commKey || 0

    const tester = new Zkteco(deviceIp, devicePort, 5000, 2000)
    try {
      await tester.createSocket()
      console.log(`[ZK Worker] Reconnect successful for device ${deviceId}`)
      await tester.disconnect()

      // Clear reconnect timer
      clearInterval(timer)
      reconnectTimers.delete(deviceId)

      // Restart worker
      await startDeviceWorker(device, db, devicesCol)
    } catch (err) {
      console.log(`[ZK Worker] Reconnect failed for device ${deviceId}, will retry...`)
      try {
        await tester.disconnect()
      } catch (err) {
        // Ignore
      }
    }
  }, RECONNECT_INTERVAL_MS)

  reconnectTimers.set(deviceId, timer)
}

async function main() {
  console.log('======================================')
  console.log('ZKTeco Device Sync Worker Starting...')
  console.log('======================================')
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`MongoDB URI: ${MONGODB_URI?.replace(/mongodb\+srv:\/\/([^@]+)@/, 'mongodb+srv://****@')}`)
  console.log(`MongoDB DB: ${MONGODB_DB}`)
  console.log(`Poll Interval: ${ATTENDANCE_POLL_MS}ms`)
  console.log(`Device List Poll: ${DEVICE_LIST_POLL_MS}ms`)
  console.log('======================================\n')

  // Connect to MongoDB
  const client = await connectDB()
  const db = client.db(MONGODB_DB)
  const devicesCol = db.collection(DEVICES_COLLECTION)

  // Track current devices
  const currentDevices = new Map<string, Device>()

  // Initial device load
  console.log('[ZK Worker] Loading devices from database...')
  const devices = await devicesCol.find({ enabled: { $ne: false } }).toArray()
  console.log(`[ZK Worker] Found ${devices.length} enabled devices`)

  for (const device of devices) {
    const deviceId = String(device._id)
    currentDevices.set(deviceId, device as any)
    await startDeviceWorker(device as any, db, devicesCol)
  }

  // Poll for device changes (hot-add/remove/update)
  const devicePollTimer = setInterval(async () => {
    try {
      const fresh = await devicesCol.find({ enabled: { $ne: false } }).toArray()
      const freshMap = new Map<string, Device>()

      for (const d of fresh) {
        const id = String(d._id)
        freshMap.set(id, d as any)

        // Start new devices
        if (!currentDevices.has(id)) {
          console.log(`[ZK Worker] New device detected: ${id}`)
          await startDeviceWorker(d as any, db, devicesCol)
        } else {
          // Check if device config changed
          const prev = currentDevices.get(id)!
          const prevSig = `${prev.ip}:${prev.port}:${prev.commKey}:${prev.enabled}:${prev.hostelId}`
          const newSig = `${d.ip}:${d.port || 4370}:${d.commKey || 0}:${d.enabled}:${d.hostelId}`

          if (prevSig !== newSig) {
            console.log(`[ZK Worker] Device ${id} config changed, restarting...`)
            const worker = workers.get(id)
            if (worker) {
              await worker.stop()
            }
            await startDeviceWorker(d as any, db, devicesCol)
          }
        }
      }

      // Stop removed/disabled devices
      for (const [id, prev] of currentDevices) {
        if (!freshMap.has(id)) {
          console.log(`[ZK Worker] Device ${id} removed or disabled, stopping...`)
          const worker = workers.get(id)
          if (worker) {
            await worker.stop()
          }
          // Clear reconnect timer if exists
          if (reconnectTimers.has(id)) {
            clearInterval(reconnectTimers.get(id)!)
            reconnectTimers.delete(id)
          }
        }
      }

      // Update current devices map
      currentDevices.clear()
      for (const [id, d] of freshMap) {
        currentDevices.set(id, d)
      }
    } catch (err) {
      console.error('[ZK Worker] Device poll error:', err)
    }
  }, DEVICE_LIST_POLL_MS)

  console.log('\n======================================')
  console.log('ZKTeco Device Sync Worker Ready')
  console.log('Press Ctrl+C to stop')
  console.log('======================================\n')

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[ZK Worker] Shutting down...')

    // Stop device poll timer
    clearInterval(devicePollTimer)

    // Stop all workers
    for (const [id, worker] of workers) {
      try {
        await worker.stop()
      } catch (err) {
        console.error(`[ZK Worker] Error stopping worker ${id}:`, err)
      }
    }

    // Clear all reconnect timers
    for (const [id, timer] of reconnectTimers) {
      clearInterval(timer)
    }
    reconnectTimers.clear()

    // Close MongoDB
    if (mongoClient) {
      await mongoClient.close()
      console.log('[ZK Worker] MongoDB connection closed')
    }

    console.log('[ZK Worker] Goodbye!')
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

// Start the worker
main().catch((err) => {
  console.error('[ZK Worker] Fatal error:', err)
  process.exit(1)
})
