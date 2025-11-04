import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Staff from '@/models/staff'
import Hostel from '@/models/hostel'

const ChangeSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = ChangeSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

    const { currentPassword, newPassword } = parsed.data

    // Authenticate caller via token
    const user = getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await dbConnect()

    const bcrypt = (await import('bcryptjs')).default

    // Staff / Warden change
    if (user.role === 'staff' || user.role === 'warden') {
      const staff = await Staff.findById(user.id).select('+passwordHash')
      if (!staff) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      // If a password is already set, verify currentPassword
      if (staff.passwordHash) {
        if (!currentPassword) return NextResponse.json({ error: 'Current password required' }, { status: 400 })
        const ok = await bcrypt.compare(currentPassword, staff.passwordHash || '')
        if (!ok) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
      }

      const hashed = await bcrypt.hash(newPassword, 10)
      staff.passwordHash = hashed
      staff.passwordSetAt = new Date()
      await staff.save()

      return NextResponse.json({ success: true })
    }

    // Hostel-admin change (hostel record stores the admin password)
    if (user.role === 'hostel-admin') {
      const hostel = await Hostel.findById(user.id).select('+passwordHash')
      if (!hostel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      if (hostel.passwordHash) {
        if (!currentPassword) return NextResponse.json({ error: 'Current password required' }, { status: 400 })
        const ok = await bcrypt.compare(currentPassword, hostel.passwordHash || '')
        if (!ok) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
      }

      const hashed = await bcrypt.hash(newPassword, 10)
      hostel.passwordHash = hashed
      hostel.passwordSetAt = new Date()
      await hostel.save()

      return NextResponse.json({ success: true })
    }

    // Super-admin credentials are environment-based — cannot change via this route
    return NextResponse.json({ error: 'Cannot change password for this account via API' }, { status: 403 })
  } catch (err) {
    console.error('Change password error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
