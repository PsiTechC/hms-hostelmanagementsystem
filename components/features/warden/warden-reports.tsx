"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Filter, X, Calendar, LogIn, LogOut, Users, TrendingUp, Clock } from "lucide-react"

type AttendanceRecord = {
  _id?: string
  timestamp_utc?: string
  timestamp?: string
  user_id?: string
  uid?: string
  deviceUserId?: string
  punch?: number
  event_type?: string
  device_ip?: string
  raw?: any
}

type Student = {
  _id: string
  name: string
  user_id?: string
  studentId?: string
  room?: string
  bedNumber?: string
}

export function WardenReports() {
  const [students, setStudents] = useState<Student[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [hostel, setHostel] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterType, setFilterType] = useState<'all' | 'checkin' | 'checkout'>('all')
  const [dateRangeStart, setDateRangeStart] = useState<string>('')
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  // Load attendance data
  useEffect(() => {
    async function loadReportsData() {
      setLoading(true)
      setError(null)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined

        const res = await fetch('/api/warden/attendance', { headers })
        const data = await res.json()

        if (!res.ok) throw new Error(data?.error || 'Failed to load reports data')

        setStudents(data.students || [])
        setAttendance(data.attendance || [])
        setHostel(data.hostel || null)
      } catch (e: any) {
        console.error('Failed to load reports data', e)
        setError(e?.message || 'Failed to load reports data')
      } finally {
        setLoading(false)
      }
    }

    loadReportsData()
  }, [])

  // Process attendance records with type detection
  const processedAttendance = attendance.map((record) => {
    const punch = typeof record.punch !== 'undefined'
      ? Number(record.punch)
      : (String(record.event_type || '').toLowerCase().includes('out') ? 1 : 0)

    const timestamp = record.timestamp_utc || record.timestamp || ''
    const userId = record.user_id || record.uid || record.deviceUserId || ''

    // Find student name from userId
    const student = students.find((s) => {
      const studentUserId = String(s.user_id || '').trim()
      const recordUserId = String(userId).trim()
      return studentUserId === recordUserId
    })

    return {
      ...record,
      type: punch === 0 ? 'checkin' : 'checkout',
      punch,
      timestamp,
      userId,
      studentName: student?.name || 'Unknown',
      studentId: student?.studentId || 'N/A',
      _id: record._id?.toString() || String(Math.random())
    }
  })

  // Filter attendance records
  const filteredAttendance = processedAttendance.filter((record) => {
    // Filter by type (checkin/checkout)
    if (filterType !== 'all' && record.type !== filterType) {
      return false
    }

    // Filter by date range
    if (dateRangeStart || dateRangeEnd) {
      let recordDate: Date | null = null

      if (record.timestamp) {
        recordDate = new Date(record.timestamp)
      }

      if (recordDate) {
        const recordDateOnly = new Date(
          recordDate.getFullYear(),
          recordDate.getMonth(),
          recordDate.getDate()
        )

        if (dateRangeStart) {
          const startDate = new Date(dateRangeStart)
          if (recordDateOnly < startDate) return false
        }

        if (dateRangeEnd) {
          const endDate = new Date(dateRangeEnd)
          if (recordDateOnly > endDate) return false
        }
      }
    }

    return true
  })

  // Calculate statistics
  const totalRecords = filteredAttendance.length
  const totalCheckIns = filteredAttendance.filter(r => r.type === 'checkin').length
  const totalCheckOuts = filteredAttendance.filter(r => r.type === 'checkout').length

  // Calculate unique students who checked in
  const uniqueStudentCheckIns = new Set(
    filteredAttendance
      .filter(r => r.type === 'checkin')
      .map(r => r.userId)
      .filter(Boolean)
  ).size

  // Calculate late entries (if nightInTime is set)
  let lateEntries = 0
  if (hostel?.nightInTime) {
    const [hours, minutes] = hostel.nightInTime.split(':').map(Number)
    filteredAttendance.forEach((record) => {
      if (record.type === 'checkin' && record.timestamp) {
        const recordDate = new Date(record.timestamp)
        const recordHours = recordDate.getHours()
        const recordMinutes = recordDate.getMinutes()
        const recordTimeInMinutes = recordHours * 60 + recordMinutes
        const deadlineInMinutes = hours * 60 + minutes

        if (recordTimeInMinutes > deadlineInMinutes) {
          lateEntries++
        }
      }
    })
  }

  // Format timestamp for display - use raw time from DB directly as string
  const formatTimestamp = (record: any) => {
    // Use the same method as student-information.tsx
    if (record.raw && record.raw.timestamp) {
      return String(record.raw.timestamp)
    } else if (record.timestamp_utc) {
      return String(record.timestamp_utc)
    } else if (record.timestamp) {
      return String(record.timestamp)
    }
    return 'N/A'
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Attendance Reports</h2>
          <p className="text-sm text-muted-foreground">
            Comprehensive attendance reports for all students
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-border bg-transparent"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-4 h-4 mr-2" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-3xl font-bold text-foreground mt-2">{totalRecords}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Check-ins</p>
                <p className="text-3xl font-bold text-green-400 mt-2">{totalCheckIns}</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-3 rounded-lg">
                <LogIn className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Check-outs</p>
                <p className="text-3xl font-bold text-orange-400 mt-2">{totalCheckOuts}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-red-500 p-3 rounded-lg">
                <LogOut className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unique Students</p>
                <p className="text-3xl font-bold text-purple-400 mt-2">{uniqueStudentCheckIns}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-3 rounded-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Late Entries</p>
                <p className="text-3xl font-bold text-yellow-400 mt-2">{lateEntries}</p>
              </div>
              <div className="bg-gradient-to-br from-yellow-500 to-orange-500 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-cyan-400">Filter Options</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterType('all')
                  setDateRangeStart('')
                  setDateRangeEnd('')
                }}
                className="text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as 'all' | 'checkin' | 'checkout')}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-foreground text-sm"
                >
                  <option value="all">All</option>
                  <option value="checkin">Check-in Only</option>
                  <option value="checkout">Check-out Only</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Start Date</label>
                <input
                  type="date"
                  value={dateRangeStart}
                  onChange={(e) => setDateRangeStart(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-foreground text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">End Date</label>
                <input
                  type="date"
                  value={dateRangeEnd}
                  onChange={(e) => setDateRangeEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-foreground text-sm"
                />
              </div>
            </div>

            <div className="mt-3 text-xs text-muted-foreground">
              Showing {filteredAttendance.length} of {processedAttendance.length} records
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Reports Table */}
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-cyan-400">Attendance Records</CardTitle>
          <CardDescription>Detailed attendance history for all students</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="text-center py-8">
              <div className="text-sm text-muted-foreground">Loading reports data...</div>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="text-sm text-red-400">{error}</div>
            </div>
          )}

          {!loading && !error && filteredAttendance.length === 0 && (
            <div className="text-center py-8">
              <div className="text-sm text-muted-foreground">
                {processedAttendance.length > 0
                  ? 'No attendance records match the selected filters.'
                  : 'No attendance records found.'}
              </div>
            </div>
          )}

          {!loading && !error && filteredAttendance.length > 0 && (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredAttendance.map((record) => (
                <div
                  key={record._id}
                  className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-cyan-500/50 transition-all"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className={`p-3 rounded-lg ${
                        record.type === 'checkin'
                          ? 'bg-gradient-to-br from-green-500 to-emerald-500'
                          : 'bg-gradient-to-br from-orange-500 to-red-500'
                      }`}
                    >
                      {record.type === 'checkin' ? (
                        <LogIn className="w-5 h-5 text-white" />
                      ) : (
                        <LogOut className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground">
                        {record.studentName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Student ID: {record.studentId}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-foreground">
                        {record.type === 'checkin' ? 'Check-In' : 'Check-Out'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTimestamp(record)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right ml-4">
                    <div className="text-sm text-muted-foreground">
                      Device: {record.device_ip || 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      User ID: {record.userId || 'N/A'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
