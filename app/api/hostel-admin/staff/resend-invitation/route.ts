import { NextResponse } from 'next/server'
import { z } from 'zod'

import { dbConnect } from '@/lib/mongoose'
import Staff from '@/models/staff'
import { getUserFromRequest } from '@/lib/auth'
import { sendInviteEmail } from '@/lib/mailer'

const ResendInvitationSchema = z.object({
  staffId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'hostel-admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = ResendInvitationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 })
    }

    await dbConnect()

    // Find the staff member
    const staffMember = await Staff.findById(parsed.data.staffId)
    if (!staffMember) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    }

    // Verify the staff member belongs to this hostel admin
    if (staffMember.hostelId?.toString() !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!staffMember.email) {
      return NextResponse.json({ error: 'No email found for this staff member' }, { status: 400 })
    }

    // Generate new temporary password
    const genPassword = (len = 10) => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
      let password = ''
      for (let i = 0; i < len; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return password
    }

    const plainPassword = genPassword(10)
    const bcrypt = (await import('bcryptjs')).default
    const passwordHash = await bcrypt.hash(plainPassword, 12)

    // Update staff member with new password hash
    staffMember.passwordHash = passwordHash
    staffMember.passwordSetAt = new Date()
    await staffMember.save()

    // Send invitation email
    try {
      const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000'

      console.log('Resending invitation email to', staffMember.email)
      await sendInviteEmail({
        to: staffMember.email,
        clientName: staffMember.name,
        loginUrl: `${baseUrl}`,
        emailForLogin: staffMember.email,
        plainPassword,
        role: staffMember.role,
      })

      return NextResponse.json({
        success: true,
        message: 'Invitation resent successfully'
      }, { status: 200 })
    } catch (mailErr) {
      console.error('Failed to send invitation email', mailErr)
      return NextResponse.json({
        error: 'Failed to send email, but password was updated'
      }, { status: 500 })
    }
  } catch (err) {
    console.error('Resend invitation error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
