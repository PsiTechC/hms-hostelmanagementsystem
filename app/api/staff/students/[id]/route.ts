import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Student from '@/models/student'
import Room from '@/models/room'
import Staff from '@/models/staff'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = getUserFromRequest(req)
    if (!user || !['staff', 'warden', 'hostel-admin', 'super-admin'].includes(user.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await dbConnect()
    let hostelId = user.id
    if (user.role !== 'hostel-admin') {
      const staff = await Staff.findById(user.id).lean()
      if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
      hostelId = String(staff.hostelId)
    }

    const sid = params.id
    const student: any = await Student.findById(sid).lean()
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    // ensure the student belongs to the same hostel
    if (String(student.hostelId) !== String(hostelId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // If student has a room reference, fetch room number/name for UI convenience
    if (student.room) {
      try {
        const roomDoc: any = await Room.findById(student.room).lean()
        if (roomDoc) {
          student.roomNumber = roomDoc.number
          student.roomName = roomDoc.name
        }
      } catch (e) {
        console.warn('Failed to resolve room for student', e)
      }
    }

    return NextResponse.json({ student })
  } catch (err) {
    console.error('Get student error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = getUserFromRequest(req)
    if (!user || !['staff', 'warden', 'hostel-admin', 'super-admin'].includes(user.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await dbConnect()
    const sid = params.id
    const student: any = await Student.findById(sid)
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    // ensure same hostel
    let hostelId = user.id
    if (user.role !== 'hostel-admin') {
      const staff = await Staff.findById(user.id).lean()
      if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
      hostelId = String(staff.hostelId)
    }
    if (String(student.hostelId) !== String(hostelId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const contentType = String(req.headers.get('content-type') || '')
    let d: any = {}

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

    const incomingGovSavedFiles: any[] = []

    if (contentType.includes('multipart/form-data')) {
      const form = await (req as any).formData()
      ;[ 'name', 'user_id', 'studentId', 'email', 'phone', 'course', 'year', 'department', 'emergencyContact', 'govIdType', 'govIdValue', 'roomId', 'bedNumber', 'guardianName', 'guardianPhonePrimary', 'guardianPhoneWhatsApp', 'guardianRelationship', 'notificationPreference' ].forEach((k) => {
        const v = form.get(k)
        if (v !== null && typeof v !== 'object') d[k] = String(v)
      })

      // photo
      const photoField = form.get('photo')
      if (photoField && (photoField as any).arrayBuffer) {
        try {
          const file: any = photoField
          const ab = await file.arrayBuffer()
          const buf = Buffer.from(ab)
          const mime = file.type || 'image/jpeg'
          const ext = mime.split('/')[1] || 'jpg'
          const filename = `photo_${randomUUID()}.${ext}`
          fs.writeFileSync(path.join(uploadsDir, filename), buf)
          d.photoUrl = `/uploads/${filename}`
        } catch (e) {
          console.error('Failed to save photo multipart', e)
        }
      }

      const govItems = form.getAll('govFiles') || []
      for (const g of govItems) {
        if (g && (g as any).arrayBuffer) {
          try {
            const file: any = g
            const ab = await file.arrayBuffer()
            const buf = Buffer.from(ab)
            const safeName = (file.name || `gov_${Date.now()}`).replace(/[^a-z0-9.\-\_]/gi, '_')
            const filename = `${randomUUID()}_${safeName}`
            fs.writeFileSync(path.join(uploadsDir, filename), buf)
            incomingGovSavedFiles.push({ filename, url: `/uploads/${filename}`, mime: file.type, uploadedAt: new Date() })
          } catch (e) {
            console.error('Failed to save govId multipart', e)
          }
        }
      }
    } else {
      d = await req.json()
    }

    // if updating user_id, ensure uniqueness
    if (d.user_id && d.user_id !== student.user_id) {
      const exists = await Student.findOne({ user_id: d.user_id }).lean()
      if (exists) return NextResponse.json({ error: 'user_id already exists' }, { status: 409 })
    }

    // Handle room/bed change: if provided and different, try to reserve new bed first
    if (d.roomId && d.bedNumber && (String(d.roomId) !== String(student.room) || String(d.bedNumber) !== String(student.bedNumber))) {
      const mongoose = (await import('mongoose')).default
      const hid = mongoose.Types.ObjectId.isValid(hostelId) ? new mongoose.Types.ObjectId(hostelId) : hostelId
      const filter: any = { _id: d.roomId, hostelId: hid }
      const update: any = { $set: { 'beds.$[b].status': 'occupied' }, $inc: { occupied: 1 } }
      const arrayFilters = [{ 'b.number': String(d.bedNumber), 'b.status': 'vacant' }]
      const result = await Room.updateOne(filter, update, { arrayFilters })
      if (!result || result.modifiedCount === 0) {
        const exists = await Room.findOne({ _id: d.roomId, hostelId: hid }).lean()
        if (!exists) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        const bed = (exists.beds || []).find((b: any) => String(b.number) === String(d.bedNumber))
        if (!bed) return NextResponse.json({ error: 'Bed not found in room' }, { status: 400 })
        return NextResponse.json({ error: 'Bed not vacant' }, { status: 400 })
      }

      // Track allocation history
      // 1. Mark previous allocation as deallocated (if exists)
      if (student.room && student.bedNumber) {
        try {
          // Free previous bed
          await Room.updateOne({ _id: student.room }, { $set: { 'beds.$[b].status': 'vacant' }, $inc: { occupied: -1 } }, { arrayFilters: [{ 'b.number': String(student.bedNumber) }] })

          // Update allocation history: mark the last active allocation as deallocated
          if (!Array.isArray(student.allocationHistory)) {
            student.allocationHistory = []
          }

          // Find the most recent allocation that matches current room/bed and has no deallocatedAt
          const currentAllocation = student.allocationHistory.find(
            (h: any) =>
              String(h.room) === String(student.room) &&
              String(h.bedNumber) === String(student.bedNumber) &&
              !h.deallocatedAt
          )

          if (currentAllocation) {
            currentAllocation.deallocatedAt = new Date()
          } else {
            // If no history entry exists for current allocation, create one and immediately mark as deallocated
            const prevRoom: any = await Room.findById(student.room).lean()
            student.allocationHistory.push({
              room: student.room,
              roomNumber: prevRoom?.number || String(student.room),
              bedNumber: student.bedNumber,
              allocatedAt: student.createdAt || new Date(),
              deallocatedAt: new Date()
            })
          }
        } catch (e) {
          console.warn('Failed to free previous bed or update history', e)
        }
      }

      // 2. Create new allocation history entry
      const newRoom: any = await Room.findById(d.roomId).lean()
      if (!Array.isArray(student.allocationHistory)) {
        student.allocationHistory = []
      }
      student.allocationHistory.push({
        room: d.roomId,
        roomNumber: newRoom?.number || String(d.roomId),
        bedNumber: d.bedNumber,
        allocatedAt: new Date(),
        deallocatedAt: undefined
      })

      // set new allocation
      student.room = d.roomId
      student.bedNumber = d.bedNumber
    }

    // apply other simple fields
    const fields: any = ['name', 'studentId', 'email', 'phone', 'course', 'year', 'department', 'govIdType', 'govIdValue', 'emergencyContact']
    for (const f of fields) {
      if (d[f] !== undefined) (student as any)[f] = d[f]
    }
    if (d.user_id !== undefined) student.user_id = d.user_id
    if (d.photoUrl) student.photoUrl = d.photoUrl

    // guardian
    student.guardian = student.guardian || {}
    if (d.guardianName !== undefined) student.guardian.name = d.guardianName
    if (d.guardianPhonePrimary !== undefined) student.guardian.primaryPhone = d.guardianPhonePrimary
    if (d.guardianPhoneWhatsApp !== undefined) student.guardian.whatsappPhone = d.guardianPhoneWhatsApp
    if (d.guardianRelationship !== undefined) student.guardian.relationship = d.guardianRelationship
    if (d.notificationPreference !== undefined) student.guardian.notificationPreference = d.notificationPreference

    // append any new gov files
    if (!Array.isArray(student.govIdFiles)) student.govIdFiles = []
    if (incomingGovSavedFiles.length) {
      student.govIdFiles = student.govIdFiles.concat(incomingGovSavedFiles)
    }

    await student.save()

    const out: any = student.toObject()
    // augment with room number/name for UI
    if (out.room) {
      try {
        const roomDoc: any = await Room.findById(out.room).lean()
        if (roomDoc) {
          out.roomNumber = roomDoc.number
          out.roomName = roomDoc.name
        }
      } catch (e) {}
    }

    return NextResponse.json({ student: out })
  } catch (err) {
    console.error('Update student error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = getUserFromRequest(req)
    if (!user || !['staff', 'warden', 'hostel-admin', 'super-admin'].includes(user.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await dbConnect()
    const sid = params.id
    const student: any = await Student.findById(sid)
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    // ensure same hostel
    let hostelId = user.id
    if (user.role !== 'hostel-admin') {
      const staff = await Staff.findById(user.id).lean()
      if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
      hostelId = String(staff.hostelId)
    }
    if (String(student.hostelId) !== String(hostelId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // If student had allocation, try to free the bed and mark as deallocated in history
    if (student.room && student.bedNumber) {
      try {
        // coerce hostelId to ObjectId when possible to ensure we only touch rooms in this hostel
        const mongoose = (await import('mongoose')).default
        const hid = mongoose.Types.ObjectId.isValid(hostelId) ? new mongoose.Types.ObjectId(hostelId) : hostelId

        const res = await Room.updateOne(
          { _id: student.room, hostelId: hid },
          { $set: { 'beds.$[b].status': 'vacant' }, $inc: { occupied: -1 } },
          { arrayFilters: [{ 'b.number': String(student.bedNumber) }] }
        )

        // Mark current allocation as deallocated in history
        if (!Array.isArray(student.allocationHistory)) {
          student.allocationHistory = []
        }

        const currentAllocation = student.allocationHistory.find(
          (h: any) =>
            String(h.room) === String(student.room) &&
            String(h.bedNumber) === String(student.bedNumber) &&
            !h.deallocatedAt
        )

        if (currentAllocation) {
          currentAllocation.deallocatedAt = new Date()
          await student.save()
        }

        // // guard: don't allow occupied to go negative
        // if (res && (res.modifiedCount || res.nModified) !== 0) {
        //   try {
        //     await Room.updateOne({ _id: student.room, occupied: { $lt: 0 } }, { $set: { occupied: 0 } })
        //   } catch (e) {
        //     // non-fatal
        //   }
        // }
      } catch (e) {
        console.warn('Failed to free bed during student delete', e)
      }
    }

    await Student.deleteOne({ _id: sid })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete student error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
