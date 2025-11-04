import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Student from '@/models/student'

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'student') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { currentPassword, newPassword } = body

    // Validate inputs
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters long' }, { status: 400 })
    }

    await dbConnect()

    // Get the student
    const student = await Student.findById(user.id)
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Verify current password
    const bcrypt = (await import('bcryptjs')).default
    const isMatch = await bcrypt.compare(currentPassword, (student as any).passwordHash || '')
    if (!isMatch) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    // Hash the new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12)

    // Update the password using set method
    student.set('passwordHash', newPasswordHash)
    student.set('passwordSetAt', new Date())
    await student.save()

    console.log('Password changed successfully for student:', student.name)

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully'
    })
  } catch (err) {
    console.error('Change password error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
