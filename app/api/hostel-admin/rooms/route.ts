import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Room from '@/models/room'

const CreateSchema = z.object({
  number: z.string().min(1),
  name: z.string().optional(),
  capacity: z.coerce.number().int().min(1).optional(),
  beds: z.array(z.object({ number: z.string(), status: z.string().optional() })).optional(),
})

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)
    // allow hostel-admin, staff, warden and super-admin to LIST rooms
    if (!user || !['hostel-admin', 'staff', 'warden', 'super-admin'].includes(user.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await dbConnect()

    let hostelId: any = null
    if (user.role === 'hostel-admin') {
      hostelId = user.id
    } else if (user.role === 'super-admin') {
      // super-admin: return all rooms
      const roomsAll = await Room.find({}).lean()
      return NextResponse.json({ rooms: roomsAll })
    } else {
      // staff or warden: resolve hostelId from Staff record
      const Staff = (await import('@/models/staff')).default
      const staff = await Staff.findById(user.id).lean()
      if (!staff) return NextResponse.json({ rooms: [] })
      hostelId = String(staff.hostelId)
    }

    const rooms = await Room.find({ hostelId }).lean()
    return NextResponse.json({ rooms })
  } catch (err) {
    console.error('List rooms error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'hostel-admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = await req.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 })
    await dbConnect()
    const d: any = parsed.data
    const room = await Room.create({
      hostelId: user.id,
      number: d.number,
      name: d.name,
      capacity: d.capacity ?? (d.beds ? d.beds.length : 1),
      beds: d.beds ?? Array.from({ length: d.capacity ?? 1 }, (_, i) => ({ number: String(i + 1), status: 'vacant' })),
      occupied: 0,
    })
    return NextResponse.json({ room }, { status: 201 })
  } catch (err) {
    console.error('Create room error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
