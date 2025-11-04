import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Room from '@/models/room'

const UpdateSchema = z.object({
  number: z.string().min(1).optional(),
  name: z.string().optional(),
  capacity: z.coerce.number().int().min(1).optional(),
  beds: z.array(z.object({ number: z.string(), status: z.string().optional() })).optional(),
})

export async function PATCH(req: Request, { params }: { params: { id?: string } }) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'hostel-admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const id = params.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 })
    await dbConnect()
    const room = await Room.findById(id)
    if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (room.hostelId.toString() !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const d: any = parsed.data
    if (d.number !== undefined) room.number = d.number
    if (d.name !== undefined) room.name = d.name
    if (d.capacity !== undefined) room.capacity = d.capacity
    if (d.beds !== undefined) room.beds = d.beds
    // recalc occupied if necessary
    room.occupied = room.beds.filter((b) => b.status === 'occupied').length
    await room.save()
    return NextResponse.json({ room })
  } catch (err) {
    console.error('Update room error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id?: string } }) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'hostel-admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const id = params.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    await dbConnect()
    const room = await Room.findById(id)
    if (!room) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (room.hostelId.toString() !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await Room.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete room error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
