import { NextResponse } from 'next/server'
import { dbConnect } from '@/lib/mongoose'
import Hostel from '@/models/hostel'
import Student from '@/models/student'
import Device from '@/models/device'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'super-admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await dbConnect()

    // totals
    const [hostelsCount, studentsCount, devicesCount] = await Promise.all([
      Hostel.countDocuments(),
      Student.countDocuments(),
      Device.countDocuments(),
    ])

    // hostel distribution: students per hostel (aggregate + lookup)
    const distribution = await Student.aggregate([
      { $group: { _id: '$hostelId', count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'hostels',
          localField: '_id',
          foreignField: '_id',
          as: 'hostel',
        },
      },
      { $unwind: { path: '$hostel', preserveNullAndEmptyArrays: true } },
      { $project: { hostelId: '$_id', hostelName: { $ifNull: ['$hostel.name', 'Unknown'] }, count: 1 } },
      { $sort: { count: -1 } },
    ])

    // measure a simple DB roundtrip to approximate API/DB response time
    const t0 = Date.now()
    await Hostel.findOne().lean()
    const t1 = Date.now()
    const approxDbRoundtripMs = t1 - t0

    // Try to get serverStatus/opcounters for DB load if available
    let dbStatus: any = null
    try {
      // mongoose connection db.admin() is available after dbConnect()
      const mongoose = (await import('mongoose')).default || (await import('mongoose'))
      const conn = (mongoose && mongoose.connection) || null
      const db = conn && conn.db
      if (db && typeof db.admin === 'function') {
        const admin = db.admin()
        const serverStatus = await admin.serverStatus()
        dbStatus = {
          connections: serverStatus.connections || null,
          opcounters: serverStatus.opcounters || null,
          uptime: serverStatus.uptime || null,
        }
      }
    } catch (err) {
      // ignore; not critical
      console.warn('Could not read serverStatus:', err)
    }

    return NextResponse.json({
      totals: { hostels: hostelsCount, students: studentsCount, devices: devicesCount },
      hostelDistribution: distribution.map((d: any) => ({ name: d.hostelName || 'Unknown', students: d.count })),
      systemHealth: { approxDbRoundtripMs, dbStatus },
    })
  } catch (err) {
    console.error('Dashboard metrics error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
