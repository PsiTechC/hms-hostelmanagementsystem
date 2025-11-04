import { NextResponse } from 'next/server'

import { dbConnect } from '@/lib/mongoose'
import Hostel from '@/models/hostel'
import Room from '@/models/room'
import Student from '@/models/student'
import Staff from '@/models/staff'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await dbConnect()

    const hostels = await Hostel.find().sort({ createdAt: -1 }).lean()

    const results: any[] = []

    for (const h of hostels) {
      const hostelId = String(h._id)

      // rooms for this hostel
      const rooms = await Room.find({ hostelId: hostelId }).lean()

      // students count for hostel
      const totalStudents = await Student.countDocuments({ hostelId: hostelId })

      // staff for hostel
      const staffDocs = await Staff.find({ hostelId: hostelId }).lean()
      const staffCount = Array.isArray(staffDocs) ? staffDocs.length : 0
      const staffRoles: Record<string, number> = {}
      ;(staffDocs || []).forEach((s: any) => {
        const r = (s.role || 'staff').trim() || 'staff'
        staffRoles[r] = (staffRoles[r] || 0) + 1
      })

      // compute bed-level stats
      let totalBeds = 0
      let occupiedBeds = 0
      const roomsMapped = (rooms || []).map((r: any) => {
        const bedCount = Array.isArray(r.beds) && r.beds.length > 0 ? r.beds.length : (r.capacity || 0)
        const occ = typeof r.occupied === 'number' ? r.occupied : (r.beds ? r.beds.filter((b: any) => b.status === 'occupied').length : 0)
        totalBeds += bedCount
        occupiedBeds += occ
        return {
          _id: r._id,
          number: r.number,
          name: r.name,
          capacity: r.capacity || bedCount,
          beds: r.beds || [],
          occupied: occ,
          bedCount,
          available: bedCount - occ,
        }
      })

      results.push({
        _id: h._id,
        name: h.name,
        code: h.code,
        address: h.address,
        adminName: h.adminName,
        contactEmail: h.contactEmail,
        contactPhone: h.contactPhone,
        licenseExpiry: h.licenseExpiry,
        roomsUnlimited: !!h.roomsUnlimited,
        capacityUnlimited: !!h.capacityUnlimited,
        totalRooms: rooms.length,
        capacity: h.capacity ?? totalBeds,
        totalBeds,
        occupiedBeds,
        availableBeds: totalBeds - occupiedBeds,
        totalStudents,
        staffCount,
        staffRoles,
        rooms: roomsMapped,
      })
    }

    return NextResponse.json({ hostels: results })
  } catch (err) {
    console.error('Hostel reports error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
