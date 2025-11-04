import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Hostel from '@/models/hostel'

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'hostel-admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = ChangePasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 })
    }

    const { currentPassword, newPassword } = parsed.data
    await dbConnect()

    const hostelId = user.id
    const hostel = await Hostel.findById(hostelId).select('+passwordHash')
    if (!hostel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const bcrypt = (await import('bcryptjs')).default
    const match = await bcrypt.compare(currentPassword, (hostel as any).passwordHash || '')
    if (!match) {
      return NextResponse.json({ error: 'Current password incorrect' }, { status: 401 })
    }

    const newHash = await bcrypt.hash(newPassword, 12)
    ;(hostel as any).passwordHash = newHash
    ;(hostel as any).passwordSetAt = new Date()
    await hostel.save()

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Change password error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
