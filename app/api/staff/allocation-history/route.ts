import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Student from '@/models/student'
import Staff from '@/models/staff'

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || !['staff', 'warden', 'hostel-admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await dbConnect()

    // Determine hostelId based on user role
    let hostelId = user.id
    if (user.role !== 'hostel-admin') {
      const staff = await Staff.findById(user.id).lean()
      if (!staff) {
        return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
      }
      hostelId = String(staff.hostelId)
    }

    console.log('Fetching allocation history for hostelId:', hostelId)

    // Fetch all students with allocation history, limit to recent 5 allocations per student
    const students = await Student.find(
      { hostelId },
      {
        name: 1,
        studentId: 1,
        allocationHistory: 1
      }
    ).lean()

    console.log('Found students with allocation data:', students.length)

    // Build a flat list of all allocation history entries
    const allHistory: any[] = []

    for (const student of students) {
      console.log(`Student ${student.name} has ${student.allocationHistory?.length || 0} allocation history entries`)

      if (student.allocationHistory && student.allocationHistory.length > 0) {
        // Sort allocation history by allocatedAt in descending order
        const sortedHistory = [...student.allocationHistory]
          .sort((a, b) => {
            const dateA = new Date(a.allocatedAt).getTime()
            const dateB = new Date(b.allocatedAt).getTime()
            return dateB - dateA
          })
          // Take only the 5 most recent allocations per student
          .slice(0, 5)

        for (const entry of sortedHistory) {
          console.log(`Adding history entry: ${student.name} - Room ${entry.roomNumber}, Bed ${entry.bedNumber}`)
          allHistory.push({
            studentId: student._id,
            studentName: student.name,
            studentIdNumber: student.studentId,
            roomNumber: entry.roomNumber,
            bedNumber: entry.bedNumber,
            allocatedAt: entry.allocatedAt,
            deallocatedAt: entry.deallocatedAt,
          })
        }
      }
    }

    console.log('Total allocation history entries:', allHistory.length)

    // Sort all history by allocatedAt descending to show most recent first
    allHistory.sort((a, b) => {
      const dateA = new Date(a.allocatedAt).getTime()
      const dateB = new Date(b.allocatedAt).getTime()
      return dateB - dateA
    })

    return NextResponse.json({ history: allHistory })
  } catch (err) {
    console.error('Allocation history GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
