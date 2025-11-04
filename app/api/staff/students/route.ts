import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Student from '@/models/student'
import Room from '@/models/room'
import Staff from '@/models/staff'
import path from 'path'
import { saveFileToLocal, saveBase64ToLocal } from '@/lib/file-storage'

const CreateSchema = z.object({
  name: z.string().min(1),
  user_id: z.string().optional(),
  studentId: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  course: z.string().optional(),
  year: z.string().optional(),
  department: z.string().optional(),
  emergencyContact: z.string().optional(),
  // either photoUrl or photoData can be provided; photoData is base64 payload
  photoUrl: z.string().optional(),
  photoData: z.string().optional(),
  govIdType: z.string().optional(),
  govIdValue: z.string().optional(),
  // govIdFiles: array of { filename, mime, data }
  govIdFiles: z.array(z.object({ filename: z.string(), mime: z.string(), data: z.string() })).optional(),
  guardianName: z.string().optional(),
  guardianPhonePrimary: z.string().optional(),
  guardianPhoneWhatsApp: z.string().optional(),
  guardianRelationship: z.string().optional(),
  notificationPreference: z.union([z.literal('whatsapp'), z.literal('email'), z.literal('both')]).optional(),
  roomId: z.string().optional(),
  bedNumber: z.string().optional(),
})

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || !['staff', 'warden', 'hostel-admin', 'super-admin'].includes(user.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await dbConnect()
    let hostelId = user.id
    if (user.role !== 'hostel-admin') {
      const staff = await Staff.findById(user.id).lean()
      if (!staff) return NextResponse.json({ students: [] })
  hostelId = String(staff.hostelId)
    }
    const students = await Student.find({ hostelId }).lean()
    return NextResponse.json({ students })
  } catch (err) {
    console.error('List students error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || !['staff', 'warden', 'hostel-admin', 'super-admin'].includes(user.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const contentType = String(req.headers.get('content-type') || '')
    await dbConnect()
    let d: any = {}

    if (contentType.includes('multipart/form-data')) {
      // parse multipart form data using Web Request formData API
      const form = await (req as any).formData()
      ;[ 'name', 'user_id', 'studentId', 'email', 'phone', 'course', 'year', 'department', 'emergencyContact', 'govIdType', 'govIdValue', 'roomId', 'bedNumber', 'guardianName', 'guardianPhonePrimary', 'guardianPhoneWhatsApp', 'guardianRelationship', 'notificationPreference' ].forEach((k) => {
        const v = form.get(k)
        if (v !== null && typeof v !== 'object') d[k] = String(v)
      })

      // handle files
      // photo file field name: photo
      const photoField = form.get('photo')
      if (photoField && (photoField as any).arrayBuffer) {
        try {
          const file: any = photoField
          const url = await saveFileToLocal(file, 'students')
          d.photoUrl = url
        } catch (e) {
          console.error('Failed to save photo multipart', e)
        }
      }

      // govIdFiles - allow multiple
      const govSavedFiles: any[] = []
      const govItems = form.getAll('govFiles') || []
      for (const g of govItems) {
        if (g && (g as any).arrayBuffer) {
          try {
            const file: any = g
            const url = await saveFileToLocal(file, 'students')
            govSavedFiles.push({ filename: path.basename(url), url, mime: file.type, uploadedAt: new Date() })
          } catch (e) {
            console.error('Failed to save govId multipart', e)
          }
        }
      }
      d.govIdFiles = govSavedFiles
    } else {
      const body = await req.json()
      const parsed = CreateSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 })
      d = parsed.data
    }
    // enforce uniqueness of user_id if provided
    if (d.user_id) {
      const exists = await Student.findOne({ user_id: d.user_id }).lean()
      if (exists) return NextResponse.json({ error: 'user_id already exists' }, { status: 409 })
    }
    let hostelId = user.id
    if (user.role !== 'hostel-admin') {
      const staff = await Staff.findById(user.id).lean()
      if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
  hostelId = String(staff.hostelId)
    }

  // If allocation provided, attempt atomic reservation of the bed
    if (d.roomId && d.bedNumber) {
      // Use updateOne with arrayFilters to atomically mark the specific bed occupied
      // Coerce hostelId to ObjectId when possible to avoid mismatches
      const mongoose = (await import('mongoose')).default
      const hid = mongoose.Types.ObjectId.isValid(hostelId) ? new mongoose.Types.ObjectId(hostelId) : hostelId
      const filter: any = { _id: d.roomId, hostelId: hid }
      const update: any = { $set: { 'beds.$[b].status': 'occupied' }, $inc: { occupied: 1 } }
      const arrayFilters = [{ 'b.number': String(d.bedNumber), 'b.status': 'vacant' }]
      const result = await Room.updateOne(filter, update, { arrayFilters })
      if (!result || result.modifiedCount === 0) {
        // Provide helpful error message by inspecting existence
        const exists = await Room.findOne({ _id: d.roomId, hostelId: hid }).lean()
        if (!exists) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        const bed = (exists.beds || []).find((b: any) => String(b.number) === String(d.bedNumber))
        if (!bed) return NextResponse.json({ error: 'Bed not found in room' }, { status: 400 })
        return NextResponse.json({ error: 'Bed not vacant' }, { status: 400 })
      }
    }

    // handle file uploads sent as base64 data in `photoData` and `govIdFiles`
    let savedPhotoUrl = d.photoUrl
    if (d.photoData) {
      try {
        // use helper that writes base64 to configured UPLOAD_DIR and returns public URL
        const url = await saveBase64ToLocal(d.photoData, 'students')
        savedPhotoUrl = url
      } catch (e) {
        console.error('Failed to save photoData', e)
      }
    }

    const savedGovFiles: any[] = []
    if (Array.isArray(d.govIdFiles)) {
      for (const f of d.govIdFiles) {
        try {
          // f.data expected as data:<mime>;base64,<data>
          if (!f || !f.data) continue
          const url = await saveBase64ToLocal(f.data, 'students', f.filename || undefined)
          savedGovFiles.push({ filename: path.basename(url), url, mime: f.mime || undefined, uploadedAt: new Date() })
        } catch (e) {
          console.error('Failed to save govId file', e)
        }
      }
    }

    // If gov files were already saved in the multipart branch above, d.govIdFiles
    // will contain entries with `url`/`filename` etc. In that case, include them
    // in the savedGovFiles array so they get persisted to the Student document.
    if (savedGovFiles.length === 0 && Array.isArray(d.govIdFiles)) {
      for (const f of d.govIdFiles) {
        if (f && f.url) savedGovFiles.push(f)
      }
    }

    // Prepare allocation history for initial room assignment
    const allocationHistory: any[] = []
    if (d.roomId && d.bedNumber) {
      const allocatedRoom: any = await Room.findById(d.roomId).lean()
      allocationHistory.push({
        room: d.roomId,
        roomNumber: allocatedRoom?.number || String(d.roomId),
        bedNumber: d.bedNumber,
        allocatedAt: new Date(),
        deallocatedAt: undefined
      })
    }

    // Generate temporary password if email is provided
    let plainPassword: string | undefined = undefined
    let passwordHash: string | undefined = undefined
    let passwordSetAt: Date | undefined = undefined
    if (d.email) {
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

    const student = await Student.create({
      hostelId,
      name: d.name,
      user_id: d.user_id,
      studentId: d.studentId,
      email: d.email,
      phone: d.phone,
      course: d.course,
      year: d.year,
      department: d.department,
      emergencyContact: d.emergencyContact,
      photoUrl: savedPhotoUrl,
      govIdFiles: savedGovFiles,
      govIdType: d.govIdType,
      govIdValue: d.govIdValue,
      guardian: {
        name: d.guardianName,
        primaryPhone: d.guardianPhonePrimary,
        whatsappPhone: d.guardianPhoneWhatsApp,
        relationship: d.guardianRelationship,
        notificationPreference: d.notificationPreference,
      },
      room: d.roomId,
      bedNumber: d.bedNumber,
      allocationHistory,
      passwordHash,
      passwordSetAt,
      role: 'student',
    })

    // Send invitation email to student if email was provided
    if (d.email && plainPassword) {
      try {
        const { sendInviteEmail } = await import('@/lib/mailer')
        const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000'
        await sendInviteEmail({
          to: d.email,
          clientName: d.name,
          loginUrl: `${baseUrl}`,
          emailForLogin: d.email,
          plainPassword,
          role: 'student'
        })
        console.log('Student invitation email sent to', d.email)
      } catch (mailErr) {
        console.error('Failed to send student invitation email', mailErr)
      }
    }

    return NextResponse.json({ student }, { status: 201 })
  } catch (err) {
    console.error('Create student error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
