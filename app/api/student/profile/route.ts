import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Student from '@/models/student'
import Hostel from '@/models/hostel'
import Room from '@/models/room'

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'student') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await dbConnect()

    // Get the student's complete data
    const student = await Student.findById(user.id).lean()
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Get hostel details
    const hostel = await Hostel.findById(student.hostelId).lean()

    // Get room details if student has a room
    let room = null
    if (student.room) {
      room = await Room.findById(student.room).lean()
    }

    // Build response with all student details
    const response = {
      personalInfo: {
        name: student.name,
        studentId: student.studentId,
        userId: student.user_id,
        email: student.email,
        phone: student.phone,
        emergencyContact: student.emergencyContact,
      },
      academicInfo: {
        course: student.course,
        year: student.year,
        department: student.department,
      },
      hostelInfo: {
        hostelName: hostel?.name || 'N/A',
        roomNumber: room?.number || 'Not Assigned',
        bedNumber: student.bedNumber || 'Not Assigned',
        roomCapacity: room?.capacity || 0,
        floor: room?.floor || 'N/A',
      },
      guardianInfo: {
        name: student.guardian?.name || 'N/A',
        primaryPhone: student.guardian?.primaryPhone || 'N/A',
        whatsappPhone: student.guardian?.whatsappPhone || 'N/A',
        relationship: student.guardian?.relationship || 'N/A',
        notificationPreference: student.guardian?.notificationPreference || 'N/A',
      },
      documents: {
        photoUrl: student.photoUrl || null,
        govIdType: student.govIdType || 'N/A',
        govIdValue: student.govIdValue || 'N/A',
        govIdFiles: student.govIdFiles || [],
      },
      allocationHistory: (student.allocationHistory || []).map((entry: any) => ({
        roomNumber: entry.roomNumber,
        bedNumber: entry.bedNumber,
        allocatedAt: entry.allocatedAt,
        deallocatedAt: entry.deallocatedAt,
      })),
      accountInfo: {
        createdAt: student.createdAt,
        updatedAt: student.updatedAt,
      }
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Student profile GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
