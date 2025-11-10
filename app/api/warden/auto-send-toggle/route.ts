import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { dbConnect } from '@/lib/mongoose'
import Hostel from '@/models/hostel'
import Staff from '@/models/staff'

export const runtime = 'nodejs'

// GET: Get current auto-send settings
export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || !['warden', 'hostel-admin'].includes(user.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await dbConnect()

    // Resolve hostelId
    let hostelId: any = user.id
    if (user.role !== 'hostel-admin') {
      const staff = await Staff.findById(user.id).lean()
      if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
      hostelId = String(staff.hostelId)
    }

    const hostel = await Hostel.findById(hostelId).lean()
    if (!hostel) return NextResponse.json({ error: 'Hostel not found' }, { status: 404 })

    return NextResponse.json({
      autoSendMode: hostel.autoSendMode || 'frontend',
      autoSendEnabled: hostel.autoSendEnabled || false,
      lastAutoSendCheck: hostel.lastAutoSendCheck || null,
      nightInTime: hostel.nightInTime || null
    })
  } catch (err: any) {
    console.error('Auto-send toggle GET error', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}

// POST: Update auto-send settings
export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || !['warden', 'hostel-admin'].includes(user.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const { enabled, mode } = body

    if (typeof enabled !== 'boolean' && !mode) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    await dbConnect()

    // Resolve hostelId
    let hostelId: any = user.id
    if (user.role !== 'hostel-admin') {
      const staff = await Staff.findById(user.id).lean()
      if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
      hostelId = String(staff.hostelId)
    }

    const hostel = await Hostel.findById(hostelId)
    if (!hostel) return NextResponse.json({ error: 'Hostel not found' }, { status: 404 })

    // Update settings
    if (typeof enabled === 'boolean') {
      hostel.autoSendEnabled = enabled
      console.log(`[Auto-send Toggle] Hostel ${hostel.name}: autoSendEnabled = ${enabled}`)
    }

    if (mode && ['frontend', 'backend', 'disabled'].includes(mode)) {
      hostel.autoSendMode = mode
      console.log(`[Auto-send Toggle] Hostel ${hostel.name}: autoSendMode = ${mode}`)
    }

    await hostel.save()

    return NextResponse.json({
      success: true,
      autoSendMode: hostel.autoSendMode,
      autoSendEnabled: hostel.autoSendEnabled
    })
  } catch (err: any) {
    console.error('Auto-send toggle POST error', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
