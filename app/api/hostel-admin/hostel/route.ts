import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Hostel from '@/models/hostel'

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'hostel-admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const hostelId = user.id
    await dbConnect()
    const hostel = await Hostel.findById(hostelId).lean()
    if (!hostel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Ensure sensitive fields are not returned
    const result = { ...(hostel as any) }
    if (result.passwordHash) delete result.passwordHash
    if (result.passwordSetAt) delete result.passwordSetAt

    return NextResponse.json({ hostel: result })
  } catch (err) {
    console.error('Hostel-admin GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'hostel-admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    // only allow updating specific fields for now
    const allowed: any = {}
    if (body.nightInTime !== undefined) allowed.nightInTime = String(body.nightInTime || '')

    if (Object.keys(allowed).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    const hostelId = user.id
    await dbConnect()
    const hostel = await Hostel.findById(hostelId)
    if (!hostel) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // apply allowed updates
    for (const k of Object.keys(allowed)) (hostel as any)[k] = allowed[k]
    await hostel.save()

    const result = { ...(hostel as any).toObject() }
    if (result.passwordHash) delete result.passwordHash
    if (result.passwordSetAt) delete result.passwordSetAt
    return NextResponse.json({ hostel: result })
  } catch (err) {
    console.error('Hostel-admin PATCH error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
