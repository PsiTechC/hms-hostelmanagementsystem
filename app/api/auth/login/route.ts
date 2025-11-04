import { NextResponse } from 'next/server'
//import { NextResponse } from 'next/server'
import { z } from 'zod'
import { signToken } from '@/lib/jwt'
import { dbConnect } from '@/lib/mongoose'
import Hostel from '@/models/hostel'
import Staff from '@/models/staff'
import Student from '@/models/student'

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = LoginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { email, password } = parsed.data

  // Superadmin via environment credential
    const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL
    const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD

    if (!SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD) {
      console.error('SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD not set in env')
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    if (email === SUPERADMIN_EMAIL && password === SUPERADMIN_PASSWORD) {
      const token = signToken({ id: 'superadmin', email, role: 'super-admin' })
      return NextResponse.json({ token, user: { id: 'superadmin', name: 'Super Admin', email, role: 'super-admin' } })
    }

    // If not superadmin, try to authenticate as a hostel-admin using the Hostel model
    await dbConnect()
    // Find by contactEmail (stored as lowercase) and include passwordHash for verification
    const hostel = await Hostel.findOne({ contactEmail: email.toLowerCase() }).select('+passwordHash').lean()
    if (!hostel) {
      // Not a hostel-admin, try staff/warden
      const staff = await Staff.findOne({ email: email.toLowerCase() }).lean()
      if (!staff) {
        // Not staff/warden, try student
        const student = await Student.findOne({ email: email.toLowerCase() }).lean()
        if (!student) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

        const bcrypt = (await import('bcryptjs')).default
        const matchStudent = await bcrypt.compare(password, (student as any).passwordHash || '')
        if (!matchStudent) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

        // Authenticated as student
        const studentId = (student as any)._id?.toString() || 'student'
        const token = signToken({ id: studentId, email, role: 'student' })
        const user = {
          id: studentId,
          name: (student as any).name || 'Student',
          email,
          role: 'student',
          hostelId: (student as any).hostelId,
        }
        return NextResponse.json({ token, user })
      }

      const bcrypt = (await import('bcryptjs')).default
      const matchStaff = await bcrypt.compare(password, (staff as any).passwordHash || '')
      if (!matchStaff) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

      // Authenticated as staff/warden
      const staffId = (staff as any)._id?.toString() || 'staff'
      const token = signToken({ id: staffId, email, role: (staff as any).role || 'staff' })
      const user = {
        id: staffId,
        name: (staff as any).name || 'Staff',
        email,
        role: (staff as any).role || 'staff',
        hostelId: (staff as any).hostelId,
      }
      return NextResponse.json({ token, user })
    }

    const bcrypt = (await import('bcryptjs')).default
    const match = await bcrypt.compare(password, (hostel as any).passwordHash || '')
    if (!match) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Authenticated as hostel-admin — sign token using hostel id as subject
    const hostelId = (hostel as any)._id?.toString() || 'hostel'
    const token = signToken({ id: hostelId, email, role: 'hostel-admin' })
    const user = {
      id: hostelId,
      name: (hostel as any).adminName || (hostel as any).name || 'Hostel Admin',
      email,
      role: 'hostel-admin',
      hostelId,
    }

    return NextResponse.json({ token, user })
  } catch (err) {
    console.error('Login error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
//   const token = signToken({ id: user._id.toString(), email: user.email })

//   return NextResponse.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } })
// }
