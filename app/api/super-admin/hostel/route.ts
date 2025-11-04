import { NextResponse } from 'next/server'
import { z } from 'zod'

import { dbConnect } from '@/lib/mongoose'
import Hostel from '@/models/hostel'
import { getUserFromRequest } from '@/lib/auth'

const CreateHostelSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  address: z.string().optional(),
  adminName: z.string().optional(),
  licenseExpiry: z.string().optional(),
    roomsUnlimited: z.boolean().optional(),
    capacityUnlimited: z.boolean().optional(),
  totalRooms: z.coerce.number().int().optional(),
  capacity: z.coerce.number().int().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'super-admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = CreateHostelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 })
    }

    await dbConnect()

    // optional uniqueness check by code or name
    if (parsed.data.code) {
      const exists = await Hostel.findOne({ code: parsed.data.code }).lean()
      if (exists) return NextResponse.json({ error: 'Hostel with that code already exists' }, { status: 409 })
    }

    // Build a clean payload to ensure fields like adminName and licenseExpiry
    // are picked up even if the client used alternative names.
  const d = parsed.data as any
    const createPayload: any = {
      name: d.name,
      code: d.code,
      address: d.address,
      adminName: d.adminName ?? d.admin ?? d.admin_name,
      licenseExpiry: d.licenseExpiry ?? d.license_expiry,
      roomsUnlimited: !!d.roomsUnlimited,
      capacityUnlimited: !!d.capacityUnlimited,
      totalRooms: d.totalRooms ?? d.total_rooms ?? 0,
      capacity: d.capacity ?? 0,
      contactEmail: d.contactEmail ?? d.adminEmail ?? d.contact_email,
      contactPhone: d.contactPhone ?? d.adminPhone ?? d.contact_phone,
    }

      // avoid logging sensitive info; log only non-sensitive fields for debug
      console.log('Create hostel - creating:', {
        name: createPayload.name,
        contactEmail: createPayload.contactEmail,
        adminName: createPayload.adminName,
        licenseExpiry: createPayload.licenseExpiry,
      })

      // generate temporary password, hash it and store hash
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
      // attach hashed password only; never store plain password
      createPayload.passwordHash = passwordHash
      createPayload.passwordSetAt = new Date()

      const created = await Hostel.create(createPayload)

      // Send email to hostel admin (with temporary password) if contactEmail present
      try {
        const { sendHostelCreatedEmail } = await import('@/lib/mailer')
        const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000'
        if (createPayload.contactEmail) {
          // do not log the plain password
          console.log('Sending hostel-created email to', createPayload.contactEmail)
          await sendHostelCreatedEmail({
            to: createPayload.contactEmail,
            hostelName: createPayload.name,
            licenseExpiry: createPayload.licenseExpiry,
            adminName: createPayload.adminName,
            emailForLogin: createPayload.contactEmail,
            loginUrl: `${baseUrl}`,
            plainPassword,
          })
        }
      } catch (mailErr) {
        console.error('Failed to send hostel-created email', mailErr)
      }

      // redact sensitive fields before returning to client
      const result = created.toObject ? created.toObject() : { ...created }
      if (result.passwordHash) delete result.passwordHash
      if (result.passwordSetAt) delete result.passwordSetAt

      console.log('Create hostel - created (id):', result._id)
      return NextResponse.json({ hostel: result }, { status: 201 })
  } catch (err) {
    console.error('Create hostel error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(_req: Request) {
  try {
    await dbConnect()
    const hostels = await Hostel.find().sort({ createdAt: -1 }).lean()
    return NextResponse.json({ hostels })
  } catch (err) {
    console.error('List hostels error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
