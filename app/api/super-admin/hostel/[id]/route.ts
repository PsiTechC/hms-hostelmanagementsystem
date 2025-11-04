import { NextResponse } from 'next/server'
import { z } from 'zod'
import { dbConnect } from '@/lib/mongoose'
import Hostel from '@/models/hostel'
import { getUserFromRequest } from '@/lib/auth'

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  adminName: z.string().optional(),
  licenseExpiry: z.string().optional(),
  roomsUnlimited: z.boolean().optional(),
  capacityUnlimited: z.boolean().optional(),
  totalRooms: z.coerce.number().int().optional(),
  capacity: z.coerce.number().int().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
})

export async function PATCH(req: Request, { params }: { params: { id?: string } }) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'super-admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const id = params.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 })

    await dbConnect()

    const d: any = parsed.data
    const updatePayload: any = {}
    if (d.name !== undefined) updatePayload.name = d.name
    if (d.address !== undefined) updatePayload.address = d.address
    if (d.adminName !== undefined) updatePayload.adminName = d.adminName
    if (d.licenseExpiry !== undefined) updatePayload.licenseExpiry = d.licenseExpiry
    if (d.roomsUnlimited !== undefined) updatePayload.roomsUnlimited = !!d.roomsUnlimited
    if (d.capacityUnlimited !== undefined) updatePayload.capacityUnlimited = !!d.capacityUnlimited
    if (d.totalRooms !== undefined) updatePayload.totalRooms = d.totalRooms
    if (d.capacity !== undefined) updatePayload.capacity = d.capacity
    if (d.contactEmail !== undefined) updatePayload.contactEmail = d.contactEmail
    if (d.contactPhone !== undefined) updatePayload.contactPhone = d.contactPhone

    const updated = await Hostel.findByIdAndUpdate(id, updatePayload, { new: true }).lean()
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const result = { ...(updated as any) }
    if (result.passwordHash) delete result.passwordHash
    if (result.passwordSetAt) delete result.passwordSetAt

    return NextResponse.json({ hostel: result })
  } catch (err) {
    console.error('Update hostel error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: Request, { params }: { params: { id?: string } }) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'super-admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const id = params.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await dbConnect()
    const found = await Hostel.findById(id).lean()
    if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const result: any = { ...found }
    if (result.passwordHash) delete result.passwordHash
    if (result.passwordSetAt) delete result.passwordSetAt

    return NextResponse.json({ hostel: result })
  } catch (err) {
    console.error('Get hostel error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id?: string } }) {
  try {
    const user = getUserFromRequest(_req)
    if (!user || user.role !== 'super-admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const id = params.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await dbConnect()
    const deleted = await Hostel.findByIdAndDelete(id).lean()
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete hostel error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
// import { NextResponse } from 'next/server'
// import { dbConnect } from '@/lib/mongoose'
// import Hostel from '@/models/hostel'
// import { getUserFromRequest } from '@/lib/auth'

// export async function DELETE(req: Request, { params }: { params: { id: string } }) {
//   try {
//     const user = getUserFromRequest(req)
//     if (!user || user.role !== 'super-admin') {
//       return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
//     }

//     await dbConnect()
//     const deleted = await Hostel.findByIdAndDelete(params.id)
//     if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
//     return NextResponse.json({ ok: true })
//   } catch (err) {
//     console.error('Delete hostel error', err)
//     return NextResponse.json({ error: 'Internal error' }, { status: 500 })
//   }
// }
