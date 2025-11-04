"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Calendar, Users, MapPin, Bell, Clock } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { StudentProfile } from "@/components/features/student/student-profile"
import { StudentAttendance } from "@/components/features/student/student-attendance"

interface StudentDashboardProps {
  activeSection: string
}

export function StudentDashboard({ activeSection }: StudentDashboardProps) {
  // Render profile component when profile section is active
  if (activeSection === "profile") {
    return <StudentProfile />
  }

  // Render attendance component when attendance section is active
  if (activeSection === "attendance") {
    return <StudentAttendance />
  }
  const [selectedTab, setSelectedTab] = useState("overview")
  const [roomData, setRoomData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Attendance data state
  const [attendanceData, setAttendanceData] = useState<any[]>([
    { week: "Week 1", percentage: 0 },
    { week: "Week 2", percentage: 0 },
    { week: "Week 3", percentage: 0 },
    { week: "Week 4", percentage: 0 },
    { week: "Week 5", percentage: 0 },
    { week: "Week 6", percentage: 0 },
  ])
  const [attendanceLoading, setAttendanceLoading] = useState(false)

  // Access events state
  const [accessEvents, setAccessEvents] = useState<any[]>([])
  const [accessLoading, setAccessLoading] = useState(false)

  // Load attendance data and calculate weekly percentages
  useEffect(() => {
    async function loadAttendanceData() {
      setAttendanceLoading(true)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined

        const res = await fetch('/api/student/attendance', { headers })
        const data = await res.json()

        if (!res.ok) throw new Error(data?.error || 'Failed to load attendance')

        const records = data.attendance || []

        // Calculate weekly attendance percentages for the last 6 weeks
        const now = new Date()
        const weeklyData = []

        for (let i = 5; i >= 0; i--) {
          const weekStart = new Date(now)
          weekStart.setDate(now.getDate() - (i * 7) - now.getDay())
          weekStart.setHours(0, 0, 0, 0)

          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekStart.getDate() + 6)
          weekEnd.setHours(23, 59, 59, 999)

          // Count check-ins for this week
          const weekRecords = records.filter((r: any) => {
            if (!r.timestamp) return false
            const recordDate = new Date(r.timestamp)
            return recordDate >= weekStart && recordDate <= weekEnd && r.type === 'checkin'
          })

          // Calculate percentage (assuming 7 days = 100%)
          const percentage = Math.min(100, Math.round((weekRecords.length / 7) * 100))

          weeklyData.push({
            week: `Week ${6 - i}`,
            percentage,
            count: weekRecords.length
          })
        }

        setAttendanceData(weeklyData)
      } catch (e: any) {
        console.error('Failed to load attendance data', e)
      } finally {
        setAttendanceLoading(false)
      }
    }

    if (activeSection === 'overview') {
      loadAttendanceData()
    }
  }, [activeSection])

  // Load room data initially and when room tab is selected
  useEffect(() => {
    async function loadRoomData() {
      setLoading(true)
      setError(null)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined

        const res = await fetch('/api/student/room', { headers })
        const data = await res.json()

        if (!res.ok) throw new Error(data?.error || 'Failed to load room data')

        setRoomData(data)
      } catch (e: any) {
        console.error('Failed to load room data', e)
        setError(e?.message || 'Failed to load room data')
      } finally {
        setLoading(false)
      }
    }

    // Load on mount for header stats and when room tab is opened
    if (activeSection === 'overview' || selectedTab === 'room') {
      loadRoomData()
    }
  }, [activeSection, selectedTab])

  // Load access events when access tab is selected
  useEffect(() => {
    async function loadAccessEvents() {
      setAccessLoading(true)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined

        const res = await fetch('/api/student/attendance', { headers })
        const data = await res.json()

        if (!res.ok) throw new Error(data?.error || 'Failed to load access events')

        const records = data.attendance || []

        // Get the 5 most recent access events
        const recentEvents = records.slice(-5).reverse()

        setAccessEvents(recentEvents)
      } catch (e: any) {
        console.error('Failed to load access events', e)
        setAccessEvents([])
      } finally {
        setAccessLoading(false)
      }
    }

    if (selectedTab === 'access') {
      loadAccessEvents()
    }
  }, [selectedTab])


  // const leaveRequests = [
  //   { id: 1, startDate: "2024-02-01", endDate: "2024-02-05", reason: "Medical", status: "Approved", days: 5 },
  //   { id: 2, startDate: "2024-01-20", endDate: "2024-01-22", reason: "Family Emergency", status: "Approved", days: 3 },
  //   { id: 3, startDate: "2024-02-10", endDate: "2024-02-12", reason: "Personal", status: "Pending", days: 3 },
  // ]

  // const notifications = [
  //   {
  //     id: 1,
  //     title: "Late Entry Alert",
  //     message: "You entered at 10:30 PM (30 mins late)",
  //     date: "2024-01-14",
  //     read: false,
  //   },
  //   {
  //     id: 2,
  //     title: "Leave Approved",
  //     message: "Your leave request for Feb 1-5 has been approved",
  //     date: "2024-01-13",
  //     read: true,
  //   },
  //   {
  //     id: 3,
  //     title: "Room Inspection",
  //     message: "Room inspection scheduled for Jan 20 at 2:00 PM",
  //     date: "2024-01-12",
  //     read: true,
  //   },
  //   { id: 4, title: "Fee Reminder", message: "Hostel fee payment due by Jan 31", date: "2024-01-10", read: true },
  // ]

  return (
    <div className="p-6 space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all glow-accent-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Attendance %</p>
                <p className="text-3xl font-bold text-foreground mt-2">98.5%</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all glow-accent-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Leave Balance</p>
                <p className="text-3xl font-bold text-foreground mt-2">12 Days</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all glow-accent-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Night-In Time</p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {loading ? '...' : (roomData?.hostel?.nightInTime || 'Not Set')}
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all glow-accent-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unread Alerts</p>
                <p className="text-3xl font-bold text-foreground mt-2">1</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-red-500 p-3 rounded-lg">
                <Bell className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {["overview", "room", "access"].map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`px-4 py-2 font-medium transition-colors ${
              selectedTab === tab
                ? "text-cyan-400 border-b-2 border-cyan-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {selectedTab === "overview" && (
        <div className="space-y-6">
          <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-cyan-400">Attendance Trend</CardTitle>
              <CardDescription>Your weekly attendance percentage</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="week" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" domain={[90, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} />
                  <Line type="monotone" dataKey="percentage" stroke="#00d4ff" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Room Details Tab */}
      {selectedTab === "room" && (
        <div className="space-y-6">
          <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-cyan-400">Room Details</CardTitle>
              <CardDescription>Your room information and roommates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading && (
                <div className="text-sm text-muted-foreground">Loading room data...</div>
              )}

              {error && (
                <div className="text-sm text-red-400">{error}</div>
              )}

              {!loading && !error && !roomData?.room && (
                <div className="text-sm text-muted-foreground">No room assigned yet.</div>
              )}

              {!loading && !error && roomData?.room && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <p className="text-xs text-muted-foreground mb-2">Room Number</p>
                      <p className="text-2xl font-bold text-cyan-400">{roomData.room.number}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <p className="text-xs text-muted-foreground mb-2">Hostel</p>
                      <p className="text-2xl font-bold text-cyan-400">{roomData.hostel?.name || 'N/A'}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <p className="text-xs text-muted-foreground mb-2">Bed Number</p>
                      <p className="text-2xl font-bold text-cyan-400">{roomData.bedNumber || 'N/A'}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                      <p className="text-xs text-muted-foreground mb-2">Room Type</p>
                      <p className="text-2xl font-bold text-cyan-400">
                        {roomData.room.type || `Shared (${roomData.room.capacity} Beds)`}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-cyan-400" />
                      Your Roommates ({roomData.roommates?.length || 0})
                    </h3>

                    {roomData.roommates && roomData.roommates.length > 0 ? (
                      <div className="space-y-3">
                        {roomData.roommates.map((roommate: any, idx: number) => (
                          <div key={idx} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                            <p className="font-semibold text-foreground">{roommate.name}</p>
                            <p className="text-xs text-muted-foreground">Student ID: {roommate.studentId}</p>
                            <p className="text-xs text-muted-foreground">Bed: {roommate.bedNumber}</p>
                            <p className="text-xs text-muted-foreground">Phone: {roommate.phone}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No roommates in this room.</div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Access Events Tab */}
      {selectedTab === "access" && (
        <div className="space-y-6">
          <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-cyan-400">Recent Access Events</CardTitle>
              <CardDescription>Your 5 most recent entry and exit records</CardDescription>
            </CardHeader>
            <CardContent>
              {accessLoading && (
                <div className="text-sm text-muted-foreground">Loading access events...</div>
              )}

              {!accessLoading && accessEvents.length === 0 && (
                <div className="text-sm text-muted-foreground">No access events found.</div>
              )}

              {!accessLoading && accessEvents.length > 0 && (
                <div className="space-y-3">
                  {accessEvents.map((event, idx) => {
                    const eventDate = new Date(event.timestamp)
                    const formattedDate = eventDate.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })
                    const formattedTime = eventDate.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                    const isCheckIn = event.type === 'checkin'

                    return (
                      <div
                        key={event._id || idx}
                        className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`p-2 rounded-lg ${isCheckIn ? "bg-green-500/20" : "bg-blue-500/20"}`}
                          >
                            <MapPin className={`w-5 h-5 ${isCheckIn ? "text-green-400" : "text-blue-400"}`} />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">
                              {isCheckIn ? 'Check-In' : 'Check-Out'} - {formattedDate}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formattedTime}
                              {event.device_ip && ` • IP: ${event.device_ip}`}
                            </p>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-400">
                          Recorded
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Leave Requests Tab
      {selectedTab === "leave" && (
        <div className="space-y-6">
          <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-cyan-400">Leave Requests</CardTitle>
              <CardDescription>Your leave history and pending requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {leaveRequests.map((leave) => (
                  <div key={leave.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-foreground">{leave.reason}</p>
                        <p className="text-sm text-muted-foreground">
                          {leave.startDate} to {leave.endDate} ({leave.days} days)
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded text-xs font-semibold ${
                          leave.status === "Approved"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {leave.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )} */}

      {/* Notifications Tab
      {selectedTab === "notifications" && (
        <div className="space-y-6">
          <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-cyan-400">Notifications Archive</CardTitle>
              <CardDescription>All your system notifications and alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`rounded-lg p-4 border flex items-start gap-4 ${
                      notif.read ? "bg-slate-800/30 border-slate-700" : "bg-cyan-500/10 border-cyan-500/50"
                    }`}
                  >
                    <div className={`p-2 rounded-lg flex-shrink-0 ${notif.read ? "bg-slate-700" : "bg-cyan-500/20"}`}>
                      <Bell className={`w-5 h-5 ${notif.read ? "text-slate-400" : "text-cyan-400"}`} />
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold ${notif.read ? "text-slate-300" : "text-foreground"}`}>
                        {notif.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">{notif.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">{notif.date}</p>
                    </div>
                    {!notif.read && <div className="w-2 h-2 bg-cyan-400 rounded-full flex-shrink-0 mt-2" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )} */}
    </div>
  )
}
