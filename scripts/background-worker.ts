#!/usr/bin/env tsx
/**
 * Background Worker for HMS
 *
 * This worker runs independently from Next.js and handles:
 * 1. Auto-send WhatsApp alerts (cron every 5 minutes)
 * 2. ZKTeco biometric device sync (when enabled)
 *
 * Usage:
 *   Development: tsx scripts/background-worker.ts
 *   Production: node scripts/background-worker.js (after compilation)
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import cron from 'node-cron'
import { MongoClient } from 'mongodb'

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') })

// MongoDB connection
let mongoClient: MongoClient | null = null

async function connectDB() {
  if (mongoClient) return mongoClient

  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI not set in environment')
  }

  mongoClient = new MongoClient(uri)
  await mongoClient.connect()
  console.log('[Background Worker] MongoDB connected')

  return mongoClient
}

// Auto-send WhatsApp cron job
async function runAutoSendCron() {
  try {
    const client = await connectDB()
    const db = client.db(process.env.MONGODB_DB || 'HMS')
    const hostelsCol = db.collection('hostels')
    const studentsCol = db.collection('students')
    const staffCol = db.collection('staffs')

    // Check if midnight (IST) - cleanup sent events
    const now = new Date()
    const istMs = now.getTime() + 5.5 * 60 * 60 * 1000
    const ist = new Date(istMs)
    const hours = ist.getHours()
    const minutes = ist.getMinutes()

    if (hours === 0 && minutes < 5) {
      console.log('[Auto-send Cron] Midnight detected - cleaning up sent events')
      await hostelsCol.updateMany({}, { $set: { sentEventsList: [] } })
      console.log('[Auto-send Cron] Sent events cleaned up for all hostels')
    }

    // Get hostels with backend auto-send enabled
    const hostels = await hostelsCol.find({
      autoSendMode: 'backend',
      autoSendEnabled: true
    }).toArray()

    if (hostels.length === 0) {
      console.log('[Auto-send Cron] No hostels with backend auto-send enabled')
      return
    }

    console.log(`[Auto-send Cron] Processing ${hostels.length} hostels`)

    // Process each hostel
    for (const hostel of hostels) {
      try {
        await processAutoSendForHostel(hostel, db, studentsCol, staffCol)
        // Small delay between hostels
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (err) {
        console.error(`[Auto-send Cron] Error processing hostel ${hostel.name}:`, err)
      }
    }

    console.log('[Auto-send Cron] Completed processing all hostels')
  } catch (err) {
    console.error('[Auto-send Cron] Error:', err)
  }
}

async function processAutoSendForHostel(hostel: any, db: any, studentsCol: any, staffCol: any) {
  const hostelId = String(hostel._id)
  const hostelName = hostel.name || hostelId

  console.log(`[Auto-send] Processing hostel: ${hostelName}`)

  // Check nightInTime
  const nightIn = hostel.nightInTime
  if (!nightIn) {
    console.log(`[Auto-send] Hostel ${hostelName}: nightInTime not configured, skipping`)
    return
  }

  // Load students
  const students = await studentsCol.find({ hostelId: hostel._id }).toArray()
  if (students.length === 0) {
    console.log(`[Auto-send] Hostel ${hostelName}: No students found`)
    return
  }

  const userIds = students.map((s: any) => s.user_id).filter(Boolean)

  // Dynamic collection name for attendance logs
  const rawName = String(hostelName)
  const safeName = rawName.replace(/[^a-zA-Z0-9]/g, '_')
  const collName = `${safeName}_attendance_logs`

  const attendanceColl = db.collection(collName)

  // Compute today's date in IST
  const now = new Date()
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000
  const ist = new Date(istMs)
  const y = ist.getFullYear()
  const m = String(ist.getMonth() + 1).padStart(2, '0')
  const d = String(ist.getDate()).padStart(2, '0')
  const datePrefix = `${y}-${m}-${d}`

  // Build query for today's attendance
  const query: any = { 'raw.timestamp': { $regex: `^${datePrefix}` } }
  const ors: any[] = []

  if (userIds.length) {
    const uniqueIds = Array.from(new Set(userIds.map((x: any) => String(x).trim()))).filter(Boolean)
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    for (const id of uniqueIds) {
      const idStr = String(id) // Ensure id is string
      const re = `^\\s*${escapeRegex(idStr)}\\s*$`
      ors.push({ user_id: { $regex: re } })
      ors.push({ uid: { $regex: re } })
      ors.push({ deviceUserId: { $regex: re } })
    }

    if (ors.length) query.$or = ors
  }

  const attendance = await attendanceColl.find(query).sort({ 'raw.timestamp': 1 }).toArray()

  console.log(`[Auto-send] Hostel ${hostelName}: Found ${attendance.length} attendance records for ${datePrefix}`)

  if (attendance.length === 0) {
    // Update lastAutoSendCheck even if no attendance
    await db.collection('hostels').updateOne(
      { _id: hostel._id },
      { $set: { lastAutoSendCheck: new Date() } }
    )
    return
  }

  // Group events by user
  const eventsByUser = new Map<string, any[]>()

  for (const a of attendance) {
    const uid = String(a.user_id ?? a.uid ?? a.deviceUserId ?? '').trim()
    if (!uid) continue

    const rawTs = a.raw?.timestamp ?? a.timestamp ?? a.timestamp_utc
    if (!rawTs) continue

    const displayTimeMatch = String(rawTs).trim().match(/\d{4}-\d{2}-\d{2}[ T](\d{2}:\d{2})(?::\d{2})?/)
    const displayTime = displayTimeMatch ? displayTimeMatch[1] : String(rawTs)
    const datePartMatch = String(rawTs).trim().match(/^(\d{4}-\d{2}-\d{2})/)
    const datePart = datePartMatch ? datePartMatch[1] : datePrefix

    const punch = typeof a.punch !== 'undefined' ? Number(a.punch) : (String(a.event_type || '').toLowerCase().includes('out') ? 1 : 0)
    const type = punch === 0 ? 'In' : 'Out'

    const arr = eventsByUser.get(uid) || []
    arr.push({ raw: a, displayTime, datePart, type })
    eventsByUser.set(uid, arr)
  }

  // Get sent events list
  const sentEventsList = new Set(
    (hostel.sentEventsList || []).map((e: any) => `${e.studentId}_${e.checkInTime}`)
  )

  // Get warden info
  const wardenStaff = await staffCol.findOne({ hostelId: hostel._id, role: 'warden' })
  const wardenName = wardenStaff?.name || hostel.adminName || 'Warden'
  const wardenPhone = wardenStaff?.phone || hostel.contactPhone || ''

  // Process each student
  const results = { totalCandidates: 0, sent: 0, skipped: 0, failed: 0 }
  const newSentEvents: any[] = []

  for (const student of students) {
    const uid = String(student.user_id ?? '').trim()
    const events = (eventsByUser.get(uid) || []).filter(Boolean)

    if (!events.length) continue

    // Find latest check-in
    const allCheckIns = events.filter((e: any) => e.type === 'In')
    if (!allCheckIns.length) continue

    const latestIn = allCheckIns[allCheckIns.length - 1]
    if (!latestIn) continue

    const checkinTime = latestIn.displayTime
    const dateStrParts = latestIn.datePart ? latestIn.datePart.split('-') : []
    const dateDisplay = dateStrParts.length === 3
      ? `${dateStrParts[2]}/${dateStrParts[1]}/${dateStrParts[0]}`
      : datePrefix

    // Check if late
    const [ciH, ciM] = checkinTime.split(':').map((x: string) => Number(x))
    const [nH, nM] = (nightIn || '00:00').split(':').map((x: string) => Number(x))
    const isLate = ciH > nH || (ciH === nH && ciM > nM)

    if (!isLate) continue

    // Check if already sent
    const eventKey = `${student._id}_${checkinTime}`
    if (sentEventsList.has(eventKey)) {
      console.log(`[Auto-send] Already sent for ${student.name} at ${checkinTime}`)
      continue
    }

    // Check guardian phone
    const guardianName = student.guardian?.name || ''
    const guardianPhone = student.guardian?.whatsappPhone || student.guardian?.primaryPhone || null

    if (!guardianPhone) {
      console.log(`[Auto-send] ${student.name}: No guardian phone, skipping`)
      results.skipped++
      continue
    }

    results.totalCandidates++

    // Build WhatsApp template parameters
    const params = [
      guardianName || '',
      student.name || '',
      hostelName || '',
      checkinTime || '',
      dateDisplay || '',
      nightIn || '',
      'Late',
      wardenName || '',
      wardenPhone || '',
    ]

    console.log(`[Auto-send] Sending WhatsApp for ${student.name} at ${checkinTime}`)

    // Send WhatsApp
    try {
      const result = await sendWhatsAppTemplate(guardianPhone, params)

      if (result.success) {
        results.sent++
        newSentEvents.push({
          studentId: String(student._id),
          checkInTime: checkinTime,
          sentAt: new Date()
        })
        console.log(`[Auto-send] ✓ Sent to ${student.name}`)
      } else {
        results.failed++
        console.error(`[Auto-send] ✗ Failed to send to ${student.name}:`, result.error)
      }
    } catch (err: any) {
      results.failed++
      console.error(`[Auto-send] ✗ Error sending to ${student.name}:`, err.message)
    }

    // Small delay between sends
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  // Update hostel with new sent events
  const updateData: any = { lastAutoSendCheck: new Date() }

  if (newSentEvents.length > 0) {
    await db.collection('hostels').updateOne(
      { _id: hostel._id },
      {
        $push: { sentEventsList: { $each: newSentEvents } },
        $set: updateData
      }
    )
  } else {
    await db.collection('hostels').updateOne(
      { _id: hostel._id },
      { $set: updateData }
    )
  }

  console.log(
    `[Auto-send] Hostel ${hostelName}: Processed ${results.totalCandidates} candidates, ` +
    `sent ${results.sent}, skipped ${results.skipped}, failed ${results.failed}`
  )
}

function normalizePhone(n?: string | null) {
  if (!n) return null
  let s = String(n).trim()
  if (!s) return null
  // remove spaces, dashes, parentheses
  s = s.replace(/[\s()-]/g, '')
  // if starts with 0 and length 11 (0XXXXXXXXXX), drop leading 0 and prefix +91
  if (/^0\d{10}$/.test(s)) s = '+91' + s.slice(1)
  // if 10 digits, assume India
  if (/^\d{10}$/.test(s)) s = '+91' + s
  // if starts with + and digits, keep
  if (/^\+\d{9,15}$/.test(s)) return s
  return null
}

async function sendWhatsAppTemplate(phone: string, params: string[]) {
  try {
    const apiKey = process.env.WHATSAPP_API_KEY
    if (!apiKey) {
      throw new Error('WHATSAPP_API_KEY not configured')
    }

    // Normalize phone number to international format
    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone) {
      return { success: false, error: 'Invalid phone number' }
    }

    const apiUrl = 'https://whatsapp-api-backend-production.up.railway.app/api/send-message'

    const body = {
      to_number: normalizedPhone,
      template_name: 'hms_alert_1',
      parameters: params,
      whatsapp_request_type: 'TEMPLATE',
    }

    console.log('[WhatsApp] Sending to:', normalizedPhone)
    console.log('[WhatsApp] Request body:', JSON.stringify(body))

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body)
    })

    console.log('[WhatsApp] Response status:', response.status)

    if (!response.ok) {
      const text = await response.text()
      console.error('[WhatsApp] API error response:', text)
      return { success: false, error: `HTTP ${response.status} - ${text}` }
    }

    const data = await response.json()
    console.log('[WhatsApp] API success response:', JSON.stringify(data).substring(0, 200))

    return { success: true, data }
  } catch (err: any) {
    console.error('[WhatsApp] Exception:', err?.message || String(err))
    return { success: false, error: err?.message || String(err) }
  }
}

// Main function
async function main() {
  console.log('======================================')
  console.log('HMS Background Worker Starting...')
  console.log('======================================')
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`MongoDB URI: ${process.env.MONGODB_URI?.replace(/mongodb\+srv:\/\/([^@]+)@/, 'mongodb+srv://****@')}`)
  console.log(`MongoDB DB: ${process.env.MONGODB_DB || 'HMS'}`)
  console.log('======================================\n')

  // Connect to MongoDB
  await connectDB()

  // Start auto-send cron (runs every minute for near real-time alerts)
  console.log('[Auto-send Cron] Scheduling job to run every minute...')
  cron.schedule('* * * * *', async () => {
    console.log(`\n[Auto-send Cron] Running at ${new Date().toISOString()}`)
    await runAutoSendCron()
  })

  console.log('[Auto-send Cron] ✓ Scheduler started (* * * * * - every minute)')

  // Run immediately once on startup (optional)
  console.log('\n[Auto-send Cron] Running initial check...')
  await runAutoSendCron()

  console.log('\n======================================')
  console.log('Background Worker Ready')
  console.log('Press Ctrl+C to stop')
  console.log('======================================\n')

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[Background Worker] Shutting down...')

    if (mongoClient) {
      await mongoClient.close()
      console.log('[Background Worker] MongoDB connection closed')
    }

    console.log('[Background Worker] Goodbye!')
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

// Start the worker
main().catch((err) => {
  console.error('[Background Worker] Fatal error:', err)
  process.exit(1)
})
