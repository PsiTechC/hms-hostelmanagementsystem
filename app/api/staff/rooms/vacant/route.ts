import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Room from '@/models/room'

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || !['staff', 'warden', 'hostel-admin', 'super-admin'].includes(user.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await dbConnect()
    // resolve hostelId: token id is hostelId for hostel-admins, but for staff/warden token id is staff id
    let hostelId = user.id
    if (user.role !== 'hostel-admin') {
      const Staff = (await import('@/models/staff')).default
      const staff = await Staff.findById(user.id).lean()
      if (!staff) return NextResponse.json({ rooms: [] })
  hostelId = String(staff.hostelId)
    }
    const rooms = await Room.find({ hostelId }).lean()
    const result = rooms.map((r: any) => ({
      _id: r._id,
      number: r.number,
      name: r.name,
      capacity: r.capacity,
      occupied: r.occupied,
      vacantBeds: (r.beds || []).filter((b: any) => b.status === 'vacant').map((b: any) => b.number),
    }))
    return NextResponse.json({ rooms: result })
  } catch (err) {
    console.error('Vacant rooms error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
