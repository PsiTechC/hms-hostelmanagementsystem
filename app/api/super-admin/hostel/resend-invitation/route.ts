import { NextResponse } from 'next/server'
import { z } from 'zod'

import { dbConnect } from '@/lib/mongoose'
import Hostel from '@/models/hostel'
import { getUserFromRequest } from '@/lib/auth'

const ResendInvitationSchema = z.object({
  hostelId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = ResendInvitationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 })
    }

    await dbConnect()

    // Find the hostel
    const hostel = await Hostel.findById(parsed.data.hostelId)
    if (!hostel) {
      return NextResponse.json({ error: 'Hostel not found' }, { status: 404 })
    }

    if (!hostel.contactEmail) {
      return NextResponse.json({ error: 'No contact email found for this hostel' }, { status: 400 })
    }

    // Generate new temporary password
    const genPassword = (len = 12) => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
      let password = ''
      for (let i = 0; i < len; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return password
    }

    const plainPassword = genPassword(12)
    const bcrypt = (await import('bcryptjs')).default
    const passwordHash = await bcrypt.hash(plainPassword, 12)

    // Update hostel with new password hash
    hostel.passwordHash = passwordHash
    hostel.passwordSetAt = new Date()
    await hostel.save()

    // Send invitation email
    try {
      const { sendHostelCreatedEmail } = await import('@/lib/mailer')
      const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000'

      console.log('Resending invitation email to', hostel.contactEmail)
      await sendHostelCreatedEmail({
        to: hostel.contactEmail,
        hostelName: hostel.name,
        licenseExpiry: hostel.licenseExpiry,
        adminName: hostel.adminName,
        emailForLogin: hostel.contactEmail,
        loginUrl: `${baseUrl}`,
        plainPassword,
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
