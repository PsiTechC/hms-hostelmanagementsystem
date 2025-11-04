import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Student from '@/models/student'
import Hostel from '@/models/hostel'
import { MongoClient } from 'mongodb'

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'student') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await dbConnect()

    // Get the student's data to get their user_id, studentId, and hostelId
    const student = await Student.findById(user.id).lean()
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Get hostel to determine the attendance collection name
    const hostel = await Hostel.findById((student as any).hostelId).lean()
    if (!hostel) {
      return NextResponse.json({ error: 'Hostel not found' }, { status: 404 })
    }

    // Build candidate IDs from student record
    const candidates = new Set<string>()
    const pushId = (v: any) => {
      if (v || v === 0) candidates.add(String(v).trim())
    }
    pushId((student as any).user_id)
    pushId((student as any).studentId)

    // Build dynamic collection name from hostel name
    const rawName = String((hostel as any).name || (hostel as any)._id || 'hostel')
    const safeName = rawName.replace(/[^a-zA-Z0-9]/g, '_')
    const collName = `${safeName}_attendance_logs`

    // Query attendance from the dynamic collection
    const mongoUri = process.env.MONGODB_URI
    const dbName = process.env.MONGODB_DB
    if (!mongoUri || !dbName) {
      return NextResponse.json({ error: 'Missing DB config' }, { status: 500 })
    }

    const client = new MongoClient(mongoUri)
    await client.connect()
    try {
      const db = client.db(dbName)
      const coll = db.collection(collName)

      // Build query to match student's IDs
      const uniqueIds = Array.from(candidates).filter(Boolean)
      const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const ors: any[] = []
      for (const id of uniqueIds) {
        const re = `^\\s*${escapeRegex(id)}\\s*$`
        ors.push({ user_id: { $regex: re } })
        ors.push({ uid: { $regex: re } })
        ors.push({ deviceUserId: { $regex: re } })
      }

      const query = ors.length ? { $or: ors } : {}

      // Fetch all attendance records for this student, sorted by timestamp (newest first)
      const studentLogs = await coll.find(query).sort({ timestamp_utc: -1 }).limit(5000).toArray()

      // Sort oldest to newest for display
      studentLogs.reverse()

      // Format response
      const attendance = studentLogs.map((log: any) => {
        let timestamp = null
        if (log.raw?.timestamp) {
          timestamp = log.raw.timestamp
        } else if (log.timestamp_utc) {
          timestamp = log.timestamp_utc
        } else if (log.timestamp) {
          timestamp = log.timestamp
        }

        const punch = typeof log.punch !== 'undefined'
          ? Number(log.punch)
          : (String(log.event_type || '').toLowerCase().includes('out') ? 1 : 0)

        return {
          _id: log._id?.toString() || String(Math.random()),
          timestamp,
          type: punch === 0 ? 'checkin' : 'checkout',
          punch,
          device_ip: log.device_ip,
          user_id: log.user_id || log.uid || log.deviceUserId,
          event_type: log.event_type,
          raw: log.raw
        }
      })

      return NextResponse.json({ attendance })
    } finally {
      try { await client.close() } catch (_) {}
    }
  } catch (err) {
    console.error('Student attendance GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
