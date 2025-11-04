import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Device from '@/models/device'

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'hostel-admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

  await dbConnect()
  // Use Device model to query devices for this hostel
  const docs = await Device.find({ hostelId: user.id }).lean()
  return NextResponse.json({ devices: docs })
  } catch (err) {
    console.error('Hostel-admin devices GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'hostel-admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const name = String(body.name || '').trim()
    const ip = String(body.ip || '').trim()
    const port = body.port ? Number(body.port) : 4370

    if (!name || !ip) {
      return NextResponse.json({ error: 'Missing name or ip' }, { status: 400 })
    }

    await dbConnect()
    const newDoc = new Device({ name, ip, port, enabled: true, hostelId: user.id })
    const saved = await newDoc.save()
    return NextResponse.json({ insertedId: saved._id })
  } catch (err) {
    console.error('Hostel-admin devices POST error', err)
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
    const id = String(body.id || body._id || '')
    const updates: any = {}
    if (body.name !== undefined) updates.name = String(body.name).trim()
    if (body.ip !== undefined) updates.ip = String(body.ip).trim()
    if (body.port !== undefined) updates.port = Number(body.port)
    if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled)

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await dbConnect()
    const doc = await Device.findOneAndUpdate({ _id: id, hostelId: user.id }, { $set: updates }, { new: true })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true, device: doc })
  } catch (err) {
    console.error('Hostel-admin devices PATCH error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'hostel-admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const id = String(body.id || body._id || '')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await dbConnect()
    const doc = await Device.findOneAndDelete({ _id: id, hostelId: user.id })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Hostel-admin devices DELETE error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
