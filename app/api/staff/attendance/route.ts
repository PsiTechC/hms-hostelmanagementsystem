// import { NextResponse } from 'next/server'
// import { getUserFromRequest } from '@/lib/auth'
// import { dbConnect } from '@/lib/mongoose'
// import Student from '@/models/student'
// import Hostel from '@/models/hostel'
// import Staff from '@/models/staff'
// import { MongoClient } from 'mongodb'

// // GET: returns { hostel, students, attendance }
// export async function GET(req: Request) {
//   try {
//     const user = getUserFromRequest(req)
//     if (!user || !['staff', 'warden', 'hostel-admin', 'super-admin'].includes(user.role))
//       return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

//     await dbConnect()

//     // resolve hostelId (same logic as students route)
//     let hostelId: any = user.id
//     if (user.role !== 'hostel-admin') {
//       const staff = await Staff.findById(user.id).lean()
//       if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
//       hostelId = String(staff.hostelId)
//     }

//     // load hostel document to get hostel name (used to pick the attendance collection)
//     const hostel = await Hostel.findById(hostelId).lean()
//     if (!hostel) return NextResponse.json({ error: 'Hostel not found' }, { status: 404 })

//     // fetch students for this hostel (user_id required to match attendance)
//     const students = await Student.find({ hostelId }).select('name user_id studentId room bedNumber').lean()
//     const userIds = students.map((s: any) => s.user_id).filter(Boolean)

//     // Build dynamic collection name from hostel name. Keep it safe: replace spaces and non-alphanumeric with '_'
//     const rawName = String(hostel.name || hostel._id || 'hostel')
//     const safeName = rawName.replace(/[^a-zA-Z0-9]/g, '_')
//     const collName = `${safeName}_attendance_logs`

//     // Query attendance from the dynamic collection
//     const mongoUri = process.env.MONGODB_URI
//     const dbName = process.env.MONGODB_DB
//     if (!mongoUri || !dbName) return NextResponse.json({ error: 'Missing DB config' }, { status: 500 })

//     const client = new MongoClient(mongoUri)
//     await client.connect()
//     try {
//       const db = client.db(dbName)
//       const coll = db.collection(collName)
//       // limit to recent 2000 records to avoid huge payloads; filter by known user_ids
//       const query: any = {}
//       if (userIds.length) query.user_id = { $in: userIds }
//       const attendance = await coll.find(query).sort({ timestamp_utc: -1 }).limit(2000).toArray()

//       return NextResponse.json({ hostel: { name: hostel.name, nightInTime: hostel.nightInTime || null }, students, attendance })
//     } finally {
//       try { await client.close() } catch (_) {}
//     }
//   } catch (err) {
//     console.error('Staff attendance GET error', err)
//     return NextResponse.json({ error: 'Internal error' }, { status: 500 })
//   }
// }
