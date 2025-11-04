import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Staff from '@/models/staff'
import { sendInviteEmail } from '@/lib/mailer'

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'hostel-admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await dbConnect()
    const docs = await Staff.find({ hostelId: user.id }).lean()
    return NextResponse.json({ staff: docs })
  } catch (err) {
    console.error('Hostel-admin staff GET error', err)
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
    const role = body.role ? String(body.role).trim().toLowerCase() : undefined
  const email = body.email ? String(body.email).trim().toLowerCase() : undefined
    const phone = body.phone ? String(body.phone).trim() : undefined

    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })
    if (role && !['staff', 'warden'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

    await dbConnect()

    // generate temporary password if email provided (we will email credentials)
    let plainPassword: string | undefined = undefined
    let passwordHash: string | undefined = undefined
    let passwordSetAt: Date | undefined = undefined
    if (email) {
      const genPassword = (len = 10) => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
        let password = ''
        for (let i = 0; i < len; i++) password += chars.charAt(Math.floor(Math.random() * chars.length))
        return password
      }
      plainPassword = genPassword(10)
      const bcrypt = (await import('bcryptjs')).default
      passwordHash = await bcrypt.hash(plainPassword, 12)
      passwordSetAt = new Date()
    }

    const newDoc = new Staff({ name, role, email, phone, hostelId: user.id, passwordHash, passwordSetAt })
    const saved = await newDoc.save()

    // send invite email if email was provided
    if (email && plainPassword) {
      try {
        const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000'
        await sendInviteEmail({ to: email, clientName: name, loginUrl: `${baseUrl}`, emailForLogin: email, plainPassword, role })
      } catch (mailErr) {
        console.error('Failed to send invite email', mailErr)
      }
    }

    return NextResponse.json({ insertedId: saved._id })
  } catch (err) {
    console.error('Hostel-admin staff POST error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
