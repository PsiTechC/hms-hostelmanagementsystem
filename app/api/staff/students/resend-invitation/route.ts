import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Student from '@/models/student'
import Staff from '@/models/staff'

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || !['staff', 'warden', 'hostel-admin', 'super-admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const studentId = body.studentId

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 })
    }

    await dbConnect()

    // Verify staff has access to this student
    let hostelId = user.id
    if (user.role !== 'hostel-admin') {
      const staff = await Staff.findById(user.id).lean()
      if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
      hostelId = String(staff.hostelId)
    }

    // Get the student
    const student: any = await Student.findById(studentId)
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Verify student belongs to same hostel
    if (String(student.hostelId) !== String(hostelId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if student has email
    if (!student.email) {
      return NextResponse.json({ error: 'Student has no email address' }, { status: 400 })
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

    // Update student with new password hash
    student.passwordHash = passwordHash
    student.passwordSetAt = new Date()
    await student.save()

    // Send invitation email
    try {
      const { sendInviteEmail } = await import('@/lib/mailer')
      const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000'

      await sendInviteEmail({
        to: student.email,
        clientName: student.name,
        loginUrl: `${baseUrl}`,
        emailForLogin: student.email,
        plainPassword,
        role: 'student'
      })

      console.log('Student invitation resent to', student.email)

      return NextResponse.json({
        success: true,
        message: 'Invitation sent successfully'
      })
    } catch (mailErr) {
      console.error('Failed to send student invitation email', mailErr)
      // Roll back password change if email fails
      student.passwordHash = undefined
      student.passwordSetAt = undefined
      await student.save()

      return NextResponse.json({
        error: 'Failed to send email. Please check email configuration.'
      }, { status: 500 })
    }
  } catch (err) {
    console.error('Resend invitation error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
