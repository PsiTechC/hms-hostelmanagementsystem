"use client"

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Home, AlertCircle, TrendingUp } from 'lucide-react'
import { RoomManagement } from '@/components/features/hostel-admin/room-management'
import { StaffManagement } from '@/components/features/hostel-admin/staff-management'
import { HostelSettings } from '@/components/features/hostel-admin/hostel-settings'
import { Devices } from '@/components/features/hostel-admin/devices'
import { StudentInformation } from '@/components/features/staff/student-information'

interface HostelAdminDashboardProps {
  activeSection: string
}

export function HostelAdminDashboard({ activeSection }: HostelAdminDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalStudents, setTotalStudents] = useState<number>(0)
  const [occupiedRooms, setOccupiedRooms] = useState<number>(0)
  const [totalRooms, setTotalRooms] = useState<number>(0)
  const [lateEntries, setLateEntries] = useState<number>(0)

  useEffect(() => {
    // only run stats fetch when on the default overview section
    if (activeSection && activeSection !== 'overview') return // other sections render their own components
    let cancelled = false
    async function loadStats() {
      setLoading(true)
      setError(null)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined

        // Fetch students, rooms, and attendance in parallel
        const [studentsRes, roomsRes, attendanceRes] = await Promise.all([
          fetch('/api/staff/students', { headers }),
          fetch('/api/hostel-admin/rooms', { headers }),
          fetch('/api/warden/attendance', { headers }),
        ])

        if (!studentsRes.ok) throw new Error(`Students API ${studentsRes.status}`)
        if (!roomsRes.ok) throw new Error(`Rooms API ${roomsRes.status}`)
        if (!attendanceRes.ok) throw new Error(`Attendance API ${attendanceRes.status}`)

        const studentsData = await studentsRes.json()
        const roomsData = await roomsRes.json()
        const attendanceData = await attendanceRes.json()

        if (cancelled) return

        const students = Array.isArray(studentsData.students) ? studentsData.students : []
        const rooms = Array.isArray(roomsData.rooms) ? roomsData.rooms : []
        const attendance = Array.isArray(attendanceData.attendance) ? attendanceData.attendance : []

        setTotalStudents(students.length)
        const totalR = rooms.length
        setTotalRooms(totalR)
        const occR = rooms.filter((r: any) => Number(r.occupied || 0) > 0).length
        setOccupiedRooms(occR)

        // Compute late entries today: count unique students who have an In (punch 0) event today after nightInTime
        const hostelNight = attendanceData.hostel?.nightInTime || '22:00'
        const todayIso = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
        const lateStudentSet = new Set<string>()
        for (const ev of attendance) {
          try {
            const rawTs = ev?.raw?.timestamp || ev?.timestamp || ev?.displayTime || ''
            const datePart = String(rawTs).slice(0, 10)
            if (datePart !== todayIso) continue

            const punch = ev?.raw?.punch ?? ev?.punch
            const isIn = punch === 0 || String(ev?.type || '').toLowerCase() === 'in' || String(ev?.event || '').toLowerCase() === 'in'
            if (!isIn) continue

            // get time hh:mm
            let timeStr = null
            if (ev?.displayTime && typeof ev.displayTime === 'string') timeStr = ev.displayTime
            else if (ev?.raw?.timestamp) {
              const t = String(ev.raw.timestamp).split('T')[1] || String(ev.raw.timestamp).split(' ')[1] || ''
              timeStr = t.slice(0,5)
            }
            if (!timeStr) continue

            // compare time strings
            if (timeStr > hostelNight) {
              const uid = (ev?.user_id || ev?.uid || ev?.deviceUserId || ev?.userId || '').toString().trim()
              if (uid) lateStudentSet.add(uid)
            }
          } catch (e) {
            // ignore parse errors for individual events
          }
        }
        setLateEntries(lateStudentSet.size)
      } catch (err: any) {
        console.error('Failed to load hostel admin stats', err)
        if (!cancelled) setError(err.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadStats()
    return () => { cancelled = true }
  }, [activeSection])

  if (activeSection === 'rooms') return <RoomManagement />
  if (activeSection === 'students') return <StudentInformation />
  if (activeSection === 'staff') return <StaffManagement />
  if (activeSection === 'settings') return <HostelSettings />
  if (activeSection === 'devices') return <Devices />

  const stats = [
    { label: 'Total Students', value: loading ? '—' : String(totalStudents), icon: Users, color: 'from-blue-500 to-cyan-500' },
    { label: 'Occupied Rooms', value: loading ? '—' : `${occupiedRooms}/${totalRooms}`, icon: Home, color: 'from-green-500 to-emerald-500' },
    { label: 'Late Entries Today', value: loading ? '—' : String(lateEntries), icon: AlertCircle, color: 'from-orange-500 to-red-500' },
    { label: 'Occupancy Rate', value: loading ? '—' : `${totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0}%`, icon: TrendingUp, color: 'from-purple-500 to-pink-500' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon
          return (
            <Card key={idx} className="border-border bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all glow-accent-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-bold text-foreground mt-2">{stat.value}</p>
                  </div>
                  <div className={`bg-gradient-to-br ${stat.color} p-3 rounded-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-cyan-400">{activeSection.replace('-', ' ').toUpperCase()}</CardTitle>
          <CardDescription>Hostel administration features</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-red-400">{error}</p> : <p className="text-muted-foreground">Detailed management tools coming soon.</p>}
          {/* Recent activities panel */}
          <RecentActivities />
        </CardContent>
      </Card>
    </div>
  )
}

function RecentActivities() {
  const [events, setEvents] = useState<Array<{ id: string; type: string; message: string; ts: string }>>([])
  const studentsRef = useRef<Set<string>>(new Set())
  const roomsRef = useRef<Record<string, Set<string>> | null>(null)
  const devicesRef = useRef<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement | null>(null)

  // helper to push event (keep max 200)
  function pushEvent(ev: { type: string; message: string }) {
    const e = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type: ev.type, message: ev.message, ts: new Date().toISOString() }
    setEvents((s) => {
      const next = s.concat(e)
      if (next.length > 200) next.splice(0, next.length - 200)
      return next
    })
  }

  // single fetch to build recent activities; no polling
  useEffect(() => {
    let mounted = true

    async function initialLoad() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined

        const allEvents: Array<{ id: string; type: string; message: string; ts: string }> = []

        // students: use createdAt field if present
        try {
          const res = await fetch('/api/staff/students', { headers })
          if (res.ok) {
            const data = await res.json()
            const list = Array.isArray(data.students) ? data.students : []
            for (const s of list) {
              if (s.createdAt) {
                allEvents.push({ id: `stu-${s._id}`, type: 'student', message: `Student: ${s.name || s._id}`, ts: new Date(s.createdAt).toISOString() })
              }
            }
          }
        } catch (_) {}

        // rooms
        try {
          const res = await fetch('/api/hostel-admin/rooms', { headers })
          if (res.ok) {
            const data = await res.json()
            const list = Array.isArray(data.rooms) ? data.rooms : []
            for (const r of list) {
              if (r.createdAt) allEvents.push({ id: `room-${r._id}`, type: 'room', message: `Room: ${r.number || r._id}`, ts: new Date(r.createdAt).toISOString() })
              // treat bed additions as separate events if bed has createdAt
              if (Array.isArray(r.beds)) {
                for (const b of r.beds) {
                  if (b.createdAt) allEvents.push({ id: `bed-${r._id}-${b.number}`, type: 'bed', message: `Bed ${b.number} in ${r.number || r._id}`, ts: new Date(b.createdAt).toISOString() })
                }
              }
            }
          }
        } catch (_) {}

        // devices
        try {
          const res = await fetch('/api/hostel-admin/devices', { headers })
          if (res.ok) {
            const data = await res.json()
            const list = Array.isArray(data.devices) ? data.devices : []
            for (const d of list) {
              if (d.createdAt) allEvents.push({ id: `dev-${d._id}`, type: 'device', message: `Device: ${d.name || d._id}`, ts: new Date(d.createdAt).toISOString() })
            }
          }
        } catch (_) {}

        if (!mounted) return

        // sort newest first and take top 50
        allEvents.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
        setEvents(allEvents.slice(0, 50))
      } catch (e) {
        // ignore
      }
    }

    initialLoad()
    return () => { mounted = false }
  }, [])

  return (
    <div className="mt-6">
      <h4 className="text-sm font-semibold text-foreground mb-2">Recent activities</h4>
      <div ref={containerRef} className="h-56 overflow-y-auto border border-border rounded p-3 bg-muted">
        {events.length === 0 ? (
          <div className="text-xs text-muted-foreground">No recent activity</div>
        ) : (
          <div className="space-y-3">
            {events.map((ev) => {
              const dt = new Date(ev.ts)
              const day = String(dt.getDate()).padStart(2, '0')
              const month = String(dt.getMonth() + 1).padStart(2, '0')
              const year = String(dt.getFullYear())
              const dateStr = `${day}/${month}/${year}`
              const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              const label = ev.type === 'student' ? 'Student' : ev.type === 'room' ? 'Room' : ev.type === 'bed' ? 'Bed' : ev.type === 'device' ? 'Device' : 'Event'
              const bg = ev.type === 'student' ? 'bg-blue-500' : ev.type === 'room' ? 'bg-green-500' : ev.type === 'bed' ? 'bg-emerald-500' : ev.type === 'device' ? 'bg-purple-500' : 'bg-slate-500'
              return (
                <div key={ev.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ${bg}`}>{label.charAt(0)}</div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{ev.message}</div>
                      <div className="text-xs text-muted-foreground">{dateStr} · {timeStr}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground ml-4">{label}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
