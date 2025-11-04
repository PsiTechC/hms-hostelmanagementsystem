import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Staff from '@/models/staff'
import { sendInviteEmail } from '@/lib/mailer'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'hostel-admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const id = params.id
    const body = await req.json()
    const name = body.name ? String(body.name).trim() : undefined
    const role = body.role ? String(body.role).trim().toLowerCase() : undefined
    const email = body.email ? String(body.email).trim().toLowerCase() : undefined
    const phone = body.phone ? String(body.phone).trim() : undefined

    if (role && !['staff', 'warden'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

    await dbConnect()
    const doc = await Staff.findById(id)
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // ensure same hostel
    if (String(doc.hostelId) !== String(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // detect email change to optionally send invite
    let plainPassword: string | undefined = undefined
    if (email && email !== doc.email) {
      // generate temporary password
      const genPassword = (len = 10) => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
        let password = ''
        for (let i = 0; i < len; i++) password += chars.charAt(Math.floor(Math.random() * chars.length))
        return password
      }
      plainPassword = genPassword(10)
      const bcrypt = (await import('bcryptjs')).default
      doc.passwordHash = await bcrypt.hash(plainPassword, 12)
      doc.passwordSetAt = new Date()
    }

    if (name !== undefined) doc.name = name
    if (role !== undefined) doc.role = role
    if (email !== undefined) doc.email = email
    if (phone !== undefined) doc.phone = phone

    await doc.save()

    // send invite email if email changed
    if (plainPassword && email) {
      try {
        const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000'
        await sendInviteEmail({ to: email, clientName: doc.name, loginUrl: `${baseUrl}`, emailForLogin: email, plainPassword, role: doc.role })
      } catch (e) {
        console.error('Failed to send invite email on update', e)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Hostel-admin staff PATCH error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'hostel-admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const id = params.id
    await dbConnect()
    const doc = await Staff.findById(id)
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (String(doc.hostelId) !== String(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await Staff.deleteOne({ _id: id })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Hostel-admin staff DELETE error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
