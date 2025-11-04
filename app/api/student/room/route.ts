import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Student from '@/models/student'
import Room from '@/models/room'
import Hostel from '@/models/hostel'

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'student') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await dbConnect()

    // Get the student's data
    const student = await Student.findById(user.id).lean()
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // If student doesn't have a room assigned
    if (!student.room) {
      return NextResponse.json({
        student: {
          name: student.name,
          studentId: student.studentId,
          email: student.email,
        },
        room: null,
        roommates: [],
        hostel: null
      })
    }

    // Get room details
    const room = await Room.findById(student.room).lean()
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Get hostel details
    const hostel = await Hostel.findById(student.hostelId).lean()

    // Get all roommates (students in the same room, excluding current student)
    const roommates = await Student.find({
      room: student.room,
      _id: { $ne: student._id }
    })
    .select('name studentId phone email bedNumber')
    .lean()

    // Build response
    const response = {
      student: {
        name: student.name,
        studentId: student.studentId,
        email: student.email,
        phone: student.phone,
        course: student.course,
        year: student.year,
        department: student.department,
      },
      room: {
        _id: room._id,
        number: room.number || String(room._id),
        capacity: room.capacity || 0,
        occupied: room.occupied || 0,
        floor: room.floor,
        type: room.type,
      },
      bedNumber: student.bedNumber,
      hostel: {
        name: hostel?.name || 'Unknown',
        nightInTime: hostel?.nightInTime || null,
      },
      roommates: roommates.map((rm: any) => ({
        name: rm.name,
        studentId: rm.studentId || 'N/A',
        phone: rm.phone || 'N/A',
        email: rm.email || 'N/A',
        bedNumber: rm.bedNumber || 'N/A',
      }))
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Student room GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
