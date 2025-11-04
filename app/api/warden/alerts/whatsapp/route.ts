import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Student from '@/models/student'
import Hostel from '@/models/hostel'
import Staff from '@/models/staff'
import { MongoClient } from 'mongodb'
import { sendTemplate } from '@/lib/whatsapp'

export const runtime = 'nodejs'

type ReqBody = { hostelId?: string; studentIds?: string[]; date?: string }

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || !['warden', 'hostel-admin'].includes(user.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body: ReqBody = await req.json().catch(() => ({} as ReqBody))

    await dbConnect()

    // resolve hostelId
    let hostelId: any = body.hostelId
    if (!hostelId) {
      // if warden, infer from staff record
      const staff = await Staff.findById(user.id).lean()
      if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
      hostelId = String(staff.hostelId)
    }

    const hostel = await Hostel.findById(hostelId).lean()
    if (!hostel) return NextResponse.json({ error: 'Hostel not found' }, { status: 404 })

    // load students
    const students = body.studentIds && body.studentIds.length
      ? await Student.find({ _id: { $in: body.studentIds } }).lean()
      : await Student.find({ hostelId }).lean()

    const userIds = students.map((s: any) => s.user_id).filter(Boolean)

    // dynamic collection name
    const rawName = String(hostel.name || hostel._id || 'hostel')
    const safeName = rawName.replace(/[^a-zA-Z0-9]/g, '_')
    const collName = `${safeName}_attendance_logs`

    const mongoUri = process.env.MONGODB_URI
    const dbName = process.env.MONGODB_DB
    if (!mongoUri || !dbName) return NextResponse.json({ error: 'Missing DB config' }, { status: 500 })

    // compute date filter in IST (raw.timestamp is IST)
    const reqDate = body.date ? String(body.date) : null
    let datePrefix = null
    if (reqDate) {
      // expect YYYY-MM-DD
      datePrefix = reqDate
    } else {
      // compute today's date in IST
      const now = new Date()
      const istMs = now.getTime() + 5.5 * 60 * 60 * 1000
      const ist = new Date(istMs)
      const y = ist.getFullYear(), m = String(ist.getMonth() + 1).padStart(2, '0'), d = String(ist.getDate()).padStart(2, '0')
      datePrefix = `${y}-${m}-${d}`
    }

    const client = new MongoClient(mongoUri)
    await client.connect()
    try {
      const db = client.db(dbName)
      const coll = db.collection(collName)

      // build user id OR regex as in attendance route
      const query: any = { 'raw.timestamp': { $regex: `^${datePrefix}` } }
      let ors: any[] = []
      if (userIds.length) {
        const uniqueIds = Array.from(new Set(userIds.map((x: any) => String(x).trim()))).filter(Boolean)
        const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        for (const id of uniqueIds) {
          const re = `^\\s*${escapeRegex(id)}\\s*$`
          ors.push({ user_id: { $regex: re } })
          ors.push({ uid: { $regex: re } })
          ors.push({ deviceUserId: { $regex: re } })
        }
        if (ors.length) query.$or = ors
      }

      // execute primary query (date + id filters)
      const attendance = await coll.find(query).sort({ 'raw.timestamp': 1 }).toArray()

      // debug/logging to help diagnose why no candidates found
      try {
        console.debug('[warden/alerts/whatsapp] debug', {
          studentIds: body.studentIds || null,
          studentsFound: students.length,
          userIds,
          collName,
          queryPreview: query,
          attendanceFound: (attendance && attendance.length) || 0,
        })
      } catch (_) {}

      // fallback: if no attendance for datePrefix but we have user id filters, check if there are any matches at all (any date)
      let fallbackCount = 0
      if ((!attendance || attendance.length === 0) && ors.length) {
        try {
          fallbackCount = await coll.countDocuments({ $or: ors })
          if (fallbackCount && process.env.NODE_ENV !== 'production') {
            // add a diagnostic detail to return so caller knows there are matches on other dates
            // (do not treat this as a send candidate)
            // We'll continue processing (which will yield zero results); the debug info helps debugging.
          }
        } catch (e) {
          try { console.debug('[warden/alerts/whatsapp] fallback count error', e) } catch (_) {}
        }
      }

      // group events per user
      const eventsByUser = new Map<string, any[]>()
      for (const a of attendance) {
        const uid = String(a.user_id ?? a.uid ?? a.deviceUserId ?? '').trim()
        if (!uid) continue
        const rawTs = a.raw?.timestamp ?? a.timestamp ?? a.timestamp_utc
        if (!rawTs) continue
        // treat raw.timestamp as IST string like YYYY-MM-DD HH:MM:SS
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

      // diagnostics: collect event keys and per-student match counts for debugging
      const eventsKeys = Array.from(eventsByUser.keys())
      const perStudentMatches = students.map((s: any) => {
        const uid = String(s.user_id ?? '').trim()
        return { studentId: s._id, user_id: s.user_id || null, uidTrim: uid, eventsCount: (eventsByUser.get(uid) || []).length }
      })

      // build a small preview of events per uid for debugging (non-production)
      const eventsPreview: Record<string, Array<{ displayTime: string; type: string; rawPunch?: any }>> = {}
      for (const k of eventsKeys) {
        const arr = (eventsByUser.get(k) || [])
        eventsPreview[k] = arr.slice(0, 10).map((e: any) => ({ displayTime: e.displayTime || null, type: e.type || null, rawPunch: e.raw?.punch }))
      }

      // prepare sends
      const details: any[] = []
      const wardenStaff = await Staff.findById(user.id).lean()
      const wardenName = (wardenStaff && wardenStaff.name) ? wardenStaff.name : (hostel.adminName || 'Warden')
      const wardenPhone = (wardenStaff && wardenStaff.phone) ? wardenStaff.phone : (hostel.contactPhone || '')

      // for each student, determine latest check-in and if late send template
      const results = { totalCandidates: 0, sent: 0, skipped: 0, failed: 0 }
      for (const s of students) {
        const uid = String(s.user_id ?? '').trim()
        const events = (eventsByUser.get(uid) || []).filter(Boolean)
        if (!events.length) continue
        // find latest check-in (reverse to get the last one)
        const allCheckIns = events.filter((e: any) => e.type === 'In')
        if (!allCheckIns.length) continue
        const latestIn = allCheckIns[allCheckIns.length - 1] // get the last check-in
        if (!latestIn) continue

        // compare times HH:MM
        const checkinTime = latestIn.displayTime // HH:MM
        const dateStrParts = latestIn.datePart ? latestIn.datePart.split('-') : []
        const dateDisplay = dateStrParts.length === 3 ? `${dateStrParts[2]}/${dateStrParts[1]}/${dateStrParts[0]}` : datePrefix

        const nightIn = hostel.nightInTime || null
        if (!nightIn) {
          // If nightIn not configured, skip
          details.push({ studentId: s._id, name: s.name, phone: s.guardian?.whatsappPhone || null, status: 'skipped', reason: 'hostel nightIn not configured' })
          results.skipped++
          continue
        }

        const [ciH, ciM] = checkinTime.split(':').map((x: string) => Number(x))
        const [nH, nM] = (nightIn || '00:00').split(':').map((x: string) => Number(x))
        const isLate = ciH > nH || (ciH === nH && ciM > nM)
        if (!isLate) continue

        // send only if guardian whatsapp phone exists
        const guardianName = s.guardian?.name || ''
        const guardianPhone = s.guardian?.whatsappPhone || s.guardian?.primaryPhone || null
        if (!guardianPhone) {
          details.push({ studentId: s._id, name: s.name, phone: null, status: 'skipped', reason: 'missing guardian phone' })
          results.skipped++
          continue
        }

        // build template parameters per mapping
        const params = [
          guardianName || '', // {{1}} guardian name
          s.name || '', // {{2}} student name
          hostel.name || '', // {{3}} hostel name
          checkinTime || '', // {{4}} checkin time
          dateDisplay || '', // {{5}} date
          nightIn || '', // {{6}} night in
          'Late', // {{7}} status
          wardenName || '', // {{8}} warden name
          wardenPhone || '', // {{9}} warden phone
        ]

        results.totalCandidates++

        // Log what we're about to send for debugging
        console.log('[warden/alerts/whatsapp] Sending WhatsApp alert:', {
          to: guardianPhone,
          template: 'hms_alert_1',
          params,
          studentName: s.name,
          checkinTime,
          nightIn
        })

        // send with a small delay (sequential for simplicity)
        try {
          const r = await sendTemplate(String(guardianPhone), 'hms_alert_1', params, { type: 'TEMPLATE_TEXT' })
          console.log('[warden/alerts/whatsapp] WhatsApp API response:', r)
          if (r.status === 'success') {
            results.sent++
            details.push({ studentId: s._id, name: s.name, phone: guardianPhone, status: 'success', result: r.result })
          } else {
            results.failed++
            details.push({ studentId: s._id, name: s.name, phone: guardianPhone, status: 'failure', error: r.error })
          }
        } catch (err: any) {
          results.failed++
          details.push({ studentId: s._id, name: s.name, phone: guardianPhone, status: 'failure', error: err?.message || String(err) })
        }

        // small delay to be polite to API (200ms)
        await new Promise((res) => setTimeout(res, 200))
      }

      const base = { results, details }
      if (process.env.NODE_ENV !== 'production') {
        // include helpful diagnostics in non-production
        // include attendanceFound and fallbackCount from earlier
        // @ts-ignore
        base['diagnostics'] = { attendanceFound: (attendance && attendance.length) || 0, fallbackCount, eventsKeys, perStudentMatches, eventsPreview }
      }
      return NextResponse.json(base)
    } finally {
      try { await client.close() } catch (_) {}
    }
  } catch (err: any) {
    console.error('Warden whatsapp send error', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
