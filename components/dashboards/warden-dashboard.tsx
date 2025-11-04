"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserCheck, Bell, Users, TrendingDown } from "lucide-react"
import { AttendanceMonitoring } from "@/components/features/warden/attendance-monitoring"
import { AlertsConfiguration } from "@/components/features/warden/alerts-configuration"
import { StudentInformation } from "@/components/features/staff/student-information"
import WardenSettings from "@/components/features/warden/warden-settings"
import { WardenReports } from "@/components/features/warden/warden-reports"

interface WardenDashboardProps {
  activeSection: string
}

export function WardenDashboard({ activeSection }: WardenDashboardProps) {
  const [students, setStudents] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [hostel, setHostel] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true)
      setError(null)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined

        const res = await fetch('/api/warden/attendance', { headers })
        const data = await res.json()

        if (!res.ok) throw new Error(data?.error || 'Failed to load attendance data')

        setStudents(data.students || [])
        setAttendance(data.attendance || [])
        setHostel(data.hostel || null)
      } catch (e: any) {
        console.error('Failed to load dashboard data', e)
        setError(e?.message || 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    // Load data when on overview section (default dashboard view)
    if (activeSection === 'overview' || activeSection === 'dashboard') {
      loadDashboardData()
    }
  }, [activeSection])

  // Calculate statistics from attendance data
  const totalStudents = students.length

  // Get today's date range (start and end of today in local timezone)
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

  // Filter today's attendance records
  const todayAttendance = attendance.filter((record: any) => {
    const recordDate = record.timestamp_utc ? new Date(record.timestamp_utc) : (record.timestamp ? new Date(record.timestamp) : null)
    return recordDate && recordDate >= todayStart && recordDate <= todayEnd
  })

  // Get unique user IDs who checked in today (punch=0 or event_type contains 'in')
  const checkedInToday = new Set<string>()
  todayAttendance.forEach((record: any) => {
    const punch = typeof record.punch !== 'undefined' ? Number(record.punch) : (String(record.event_type || '').toLowerCase().includes('out') ? 1 : 0)
    if (punch === 0) { // Check-in
      const userId = record.user_id || record.uid || record.deviceUserId
      if (userId) checkedInToday.add(String(userId).trim())
    }
  })

  // Count late entries (assuming nightInTime is the deadline)
  let lateEntries = 0
  if (hostel?.nightInTime) {
    const [hours, minutes] = hostel.nightInTime.split(':').map(Number)
    todayAttendance.forEach((record: any) => {
      const punch = typeof record.punch !== 'undefined' ? Number(record.punch) : (String(record.event_type || '').toLowerCase().includes('out') ? 1 : 0)
      if (punch === 0) { // Check-in
        const recordDate = record.timestamp_utc ? new Date(record.timestamp_utc) : (record.timestamp ? new Date(record.timestamp) : null)
        if (recordDate) {
          const recordHours = recordDate.getHours()
          const recordMinutes = recordDate.getMinutes()
          const recordTimeInMinutes = recordHours * 60 + recordMinutes
          const deadlineInMinutes = hours * 60 + minutes

          if (recordTimeInMinutes > deadlineInMinutes) {
            lateEntries++
          }
        }
      }
    })
  }

  const presentToday = checkedInToday.size
  const absent = totalStudents - presentToday

  const stats = [
    { label: "Present Today", value: loading ? "..." : String(presentToday), icon: UserCheck, color: "from-green-500 to-emerald-500" },
    { label: "Absent", value: loading ? "..." : String(absent), icon: TrendingDown, color: "from-red-500 to-pink-500" },
    { label: "Late Entries", value: loading ? "..." : String(lateEntries), icon: Bell, color: "from-orange-500 to-yellow-500" },
    { label: "Total Students", value: loading ? "..." : String(totalStudents), icon: Users, color: "from-blue-500 to-cyan-500" },
  ]

  if (activeSection === "attendance") {
    return <AttendanceMonitoring />
  }

  if (activeSection === "alerts") {
    return <AlertsConfiguration />
  }

  if (activeSection === "students") {
    return <StudentInformation />
  }

  if (activeSection === "reports") {
    return <WardenReports />
  }

  if (activeSection === "settings") {
    return <WardenSettings />
  }

  return (
    <div className="p-6 space-y-6">
      {loading && (
        <div className="text-sm text-muted-foreground">Loading dashboard data...</div>
      )}
      {error && (
        <div className="text-sm text-red-400">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon
          return (
            <Card
              key={idx}
              className="border-border bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all glow-accent-sm"
            >
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
          <CardTitle className="text-cyan-400">{activeSection.replace("-", " ").toUpperCase()}</CardTitle>
          <CardDescription>Warden operations dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Real-time monitoring features coming soon.</p>
        </CardContent>
      </Card>
    </div>
  )
}
