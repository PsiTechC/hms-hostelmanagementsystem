"use client"

import { useEffect, useState } from "react"
import { AddStudentPage } from "@/components/features/staff/add-student-page"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Edit2, Eye, Trash2, Filter, X, Mail, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type VacantRoom = { _id: string; number: string; name?: string; vacantBeds: string[] }

type Student = {
  _id: string
  user_id?: string
  name?: string
  studentId?: string
  email?: string
  phone?: string
  course?: string
  year?: string
  department?: string
  emergencyContact?: string
  guardian?: { name?: string; primaryPhone?: string; whatsappPhone?: string; relationship?: string; notificationPreference?: string }
  documents?: string[]
  hostelId?: string
  photoUrl?: string
  govIdType?: string
  govIdValue?: string
  govIdFiles?: Array<{ filename?: string; url?: string; mime?: string; uploadedAt?: string }>
  room?: string
  roomNumber?: string
  roomName?: string
  bedNumber?: string
  createdAt?: string
  updatedAt?: string
}

export function StudentInformation() {
  const [students, setStudents] = useState<Student[]>([])

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentsError, setStudentsError] = useState<string | null>(null)
  const [attendanceHistory, setAttendanceHistory] = useState<any[] | null>(null)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceError, setAttendanceError] = useState<string | null>(null)

  // Invite resend state
  const [resendingInvite, setResendingInvite] = useState<string | null>(null)

  // Custom alert dialog state
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertType, setAlertType] = useState<"success" | "error" | "confirm">("success")
  const [alertMessage, setAlertMessage] = useState("")
  const [confirmAction, setConfirmAction] = useState<null | (() => Promise<void>)>(null)

  // Attendance filters
  const [filterType, setFilterType] = useState<'all' | 'checkin' | 'checkout'>('all')
  const [dateRangeStart, setDateRangeStart] = useState<string>('')
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  // load students (extracted so parent can refresh after adding)
  async function loadStudents() {
    setStudentsLoading(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/staff/students', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const data = await res.json()
      if (!res.ok) {
        console.error('Failed to load students', data)
        setStudentsError(data?.error || 'Failed to load students')
        setStudents([])
      } else {
        setStudents(data.students || [])
        setStudentsError(null)
      }
    } catch (e) {
      console.error('Failed to fetch students', e)
      setStudentsError('Network error')
      setStudents([])
    } finally {
      setStudentsLoading(false)
    }
  }

  useEffect(() => { loadStudents() }, [])

  // Handle resend invitation
  async function handleResendInvite(studentId: string, studentEmail: string) {
    if (!studentEmail) {
      setAlertType('error')
      setAlertMessage('This student has no email address on file.')
      setAlertOpen(true)
      return
    }

    // Show confirmation dialog
    setAlertType('confirm')
    setAlertMessage('Send a new invitation email with a new password to this student?')
    setConfirmAction(() => async () => {
      setResendingInvite(studentId)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const res = await fetch('/api/staff/students/resend-invitation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ studentId })
        })

        const data = await res.json()

        if (!res.ok) {
          console.error('Failed to resend invitation', data)
          setAlertType('error')
          setAlertMessage(data?.error || 'Failed to send invitation')
        } else {
          setAlertType('success')
          setAlertMessage('Invitation sent successfully! The student will receive an email with their new password.')
        }
        setAlertOpen(true)
      } catch (e) {
        console.error('Resend invitation failed', e)
        setAlertType('error')
        setAlertMessage('Network error. Please try again.')
        setAlertOpen(true)
      } finally {
        setResendingInvite(null)
        setConfirmAction(null)
      }
    })
    setAlertOpen(true)
  }

  // when a student is selected, load their attendance history (calls warden attendance endpoint then filters)
  useEffect(() => {
    let active = true
    async function loadHistory() {
      if (!selectedStudent) {
        setAttendanceHistory(null)
        setAttendanceError(null)
        setAttendanceLoading(false)
        return
      }
      setAttendanceLoading(true)
      setAttendanceError(null)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const res = await fetch('/api/warden/attendance', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const data = await res.json()
        if (!res.ok) {
          if (!active) return
          setAttendanceError(data?.error || 'Failed to load attendance')
          setAttendanceHistory([])
          return
        }

        const rawAttend = data.attendance || []

        // build candidate ids from student record
        const candidates = new Set<string>()
        const pushId = (v: any) => { if (v || v === 0) candidates.add(String(v).trim()) }
        pushId(selectedStudent.user_id)
        pushId(selectedStudent.studentId)

        const matches = rawAttend.filter((a: any) => {
          const u = String(a.user_id ?? a.uid ?? a.deviceUserId ?? '').trim()
          if (!u) return false
          if (candidates.has(u)) return true
          // also try case-insensitive / trimmed compare with any candidate
          for (const c of Array.from(candidates)) {
            if (!c) continue
            if (u.toLowerCase() === c.toLowerCase()) return true
          }
          return false
        })

        // sort oldest -> newest
        matches.sort((x: any, y: any) => {
          const tx = x.raw?.timestamp ? new Date(String(x.raw.timestamp)) : new Date(x.timestamp_utc || x.timestamp || 0)
          const ty = y.raw?.timestamp ? new Date(String(y.raw.timestamp)) : new Date(y.timestamp_utc || y.timestamp || 0)
          return tx.getTime() - ty.getTime()
        })

        if (!active) return
        setAttendanceHistory(matches)
      } catch (e) {
        console.error('Failed to load attendance history', e)
        if (!active) return
        setAttendanceError('Network error')
        setAttendanceHistory([])
      } finally {
        if (active) setAttendanceLoading(false)
      }
    }
    loadHistory()
    return () => { active = false }
  }, [selectedStudent])

  // Filter attendance history
  const filteredAttendance = attendanceHistory ? attendanceHistory.filter((a) => {
    // Filter by type (checkin/checkout)
    if (filterType !== 'all') {
      const punch = typeof a.punch !== 'undefined' ? Number(a.punch) : (String(a.event_type || '').toLowerCase().includes('out') ? 1 : 0)
      const type = punch === 0 ? 'checkin' : 'checkout'
      if (type !== filterType) return false
    }

    // Filter by date range
    if (dateRangeStart || dateRangeEnd) {
      let recordDate: Date | null = null

      if (a.raw && a.raw.timestamp) {
        recordDate = new Date(a.raw.timestamp)
      } else if (a.timestamp_utc) {
        recordDate = new Date(a.timestamp_utc)
      } else if (a.timestamp) {
        recordDate = new Date(a.timestamp)
      }

      if (recordDate) {
        const recordDateOnly = new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate())

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
  }) : null

  // show full-page add-student view
  const [showAddPage, setShowAddPage] = useState(false)
  const [editInitialStudent, setEditInitialStudent] = useState<any | null>(null)
  const [editStudentId, setEditStudentId] = useState<string | null>(null)

  if (showAddPage) {
    return (
      <AddStudentPage
        initialStudent={editInitialStudent || undefined}
        studentId={editStudentId || undefined}
        onBack={() => { setShowAddPage(false); setEditInitialStudent(null); setEditStudentId(null); loadStudents() }}
        onSaved={() => { setShowAddPage(false); setEditInitialStudent(null); setEditStudentId(null); loadStudents() }}
      />
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Student Information</h2>
          <p className="text-sm text-muted-foreground">Manage student profiles and documents</p>
        </div>
        
          <div className="flex items-center gap-2">
            <Button
              className="bg-cyan-500 hover:bg-cyan-600 text-black flex items-center gap-2"
              onClick={() => { setEditInitialStudent(null); setEditStudentId(null); setShowAddPage(true) }}
            >
              <Plus className="w-4 h-4" />
              Add Student
            </Button>
          </div>
      </div>

      {selectedStudent ? (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-cyan-400">{selectedStudent.name}</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="border-border bg-transparent"
                onClick={() => setSelectedStudent(null)}
              >
                Back
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-bold text-cyan-400 mb-4">Personal Details</h3>
                    <div className="space-y-3">
                      {selectedStudent.photoUrl && (
                        <div>
                          <p className="text-xs text-muted-foreground">Photo</p>
                          <img src={selectedStudent.photoUrl} alt="student photo" className="w-32 h-32 object-cover rounded mt-2" />
                        </div>
                      )}

                      <div>
                        <p className="text-xs text-muted-foreground">User ID</p>
                        <p className="text-sm font-semibold text-foreground">{(selectedStudent as any).user_id || selectedStudent.studentId || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="text-sm font-semibold text-foreground">{selectedStudent.email || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="text-sm font-semibold text-foreground">{selectedStudent.phone || '—'}</p>
                      </div>
                        {selectedStudent.guardian && (
                          <div className="mt-3">
                            <h4 className="text-sm font-semibold text-foreground">Guardian</h4>
                            <div className="text-sm">
                              <div className="text-xs text-muted-foreground">Name</div>
                              <div className="font-semibold text-foreground">{selectedStudent.guardian.name || '—'}</div>
                              <div className="text-xs text-muted-foreground mt-1">Primary Phone</div>
                              <div className="font-semibold text-foreground">{selectedStudent.guardian.primaryPhone || '—'}</div>
                              <div className="text-xs text-muted-foreground mt-1">WhatsApp</div>
                              <div className="font-semibold text-foreground">{selectedStudent.guardian.whatsappPhone || '—'}</div>
                              <div className="text-xs text-muted-foreground mt-1">Relationship</div>
                              <div className="font-semibold text-foreground">{selectedStudent.guardian.relationship || '—'}</div>
                              <div className="text-xs text-muted-foreground mt-1">Notification</div>
                              <div className="font-semibold text-foreground">{selectedStudent.guardian.notificationPreference || '—'}</div>
                            </div>
                          </div>
                        )}
                    </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-cyan-400 mb-4">Academic Information</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Course</p>
                    <p className="text-sm font-semibold text-foreground">{selectedStudent.course}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Year</p>
                    <p className="text-sm font-semibold text-foreground">{selectedStudent.year}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Department</p>
                    <p className="text-sm font-semibold text-foreground">{selectedStudent.department}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-cyan-400 mb-4">Emergency Contact</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Contact Number</p>
                    <p className="text-sm font-semibold text-foreground">{selectedStudent.emergencyContact || '—'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-cyan-400 mb-4">Government ID</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">ID Type</p>
                  <p className="text-sm font-semibold text-foreground">{selectedStudent.govIdType || '—'}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-cyan-400 mb-4">Documents</h3>
              <div className="grid grid-cols-2 gap-3">
                {/* Show govt id files first if present */}
                {(selectedStudent.govIdFiles || []).map((f, idx) => (
                  <div key={`gov-${idx}`} className="p-3 bg-slate-800/50 rounded-lg text-sm text-foreground">
                    <a className="text-cyan-300 underline" href={f.url} target="_blank" rel="noreferrer">{f.filename || f.url}</a>
                    <div className="text-xs text-muted-foreground mt-1">{f.mime || ''}</div>
                  </div>
                ))}
                {/* Then any generic documents */}
                {(selectedStudent.documents || []).map((doc, idx) => (
                  <div key={`doc-${idx}`} className="p-3 bg-slate-800/50 rounded-lg text-sm text-foreground">
                    {doc}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-cyan-400 mb-4">Allocation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Room</p>
                  <p className="text-sm font-semibold text-foreground">{selectedStudent.roomNumber || selectedStudent.room || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bed</p>
                  <p className="text-sm font-semibold text-foreground">{selectedStudent.bedNumber || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Allocated On</p>
                  <p className="text-sm font-semibold text-foreground">{selectedStudent.createdAt ? new Date(selectedStudent.createdAt).toLocaleString() : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Room Name</p>
                  <p className="text-sm font-semibold text-foreground">{selectedStudent.roomName || '—'}</p>
                </div>
              </div>
            </div>

            

            <div>
              <h3 className="text-lg font-bold text-cyan-400 mb-4">Record</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm font-semibold text-foreground">{selectedStudent.createdAt ? new Date(selectedStudent.createdAt).toLocaleString() : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Updated</p>
                  <p className="text-sm font-semibold text-foreground">{selectedStudent.updatedAt ? new Date(selectedStudent.updatedAt).toLocaleString() : '—'}</p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyan-400">Attendance History</h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border bg-transparent"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </div>

              {showFilters && (
                <div className="mb-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-foreground">Filter Options</h4>
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
                    Showing {filteredAttendance?.length || 0} of {attendanceHistory?.length || 0} records
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {attendanceLoading && <div className="text-sm text-muted-foreground">Loading attendance...</div>}
                {attendanceError && <div className="text-sm text-red-400">{attendanceError}</div>}
                {!attendanceLoading && !attendanceError && (!filteredAttendance || filteredAttendance.length === 0) && (
                  <div className="text-sm text-muted-foreground">
                    {attendanceHistory && attendanceHistory.length > 0
                      ? 'No attendance records match the selected filters.'
                      : 'No attendance records found for this student.'}
                  </div>
                )}

                {!attendanceLoading && filteredAttendance && filteredAttendance.length > 0 && (
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                    {filteredAttendance.slice().reverse().map((a, idx) => {
                      // derive display time
                      let display = ''
                      if (a.raw && a.raw.timestamp) {
                        display = String(a.raw.timestamp)
                      } else if (a.timestamp_utc) {
                        try {
                          display = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(a.timestamp_utc))
                        } catch (_) {
                          display = String(a.timestamp_utc)
                        }
                      } else if (a.timestamp) {
                        display = String(a.timestamp)
                      }

                      const punch = typeof a.punch !== 'undefined' ? Number(a.punch) : (String(a.event_type || '').toLowerCase().includes('out') ? 1 : 0)
                      const type = punch === 0 ? 'In' : 'Out'

                      return (
                        <div key={a._id || idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                          <div>
                            <div className="text-sm font-semibold text-foreground">{type}</div>
                            <div className="text-xs text-muted-foreground">{display}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Device: {a.device_ip || '—'}</div>
                            <div className="text-xs text-muted-foreground">Source ID: {(a.user_id || a.uid || a.deviceUserId) || '—'}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {students.map((student) => (
            <Card key={student._id} className="border-border bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-foreground">{student.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">Phone: {student.phone}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="text-sm font-semibold text-cyan-400">{student.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Course</p>
                        <p className="text-sm font-semibold text-cyan-400">{student.course}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Year</p>
                        <p className="text-sm font-semibold text-cyan-400">{student.year}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Department</p>
                        <p className="text-sm font-semibold text-cyan-400">{student.department}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border bg-transparent hover:bg-cyan-500/20 hover:text-cyan-400"
                      onClick={async () => {
                        try {
                          const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
                          const res = await fetch(`/api/staff/students/${student._id}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
                          const data = await res.json()
                          if (!res.ok) {
                            console.error('Failed to load student details', data)
                          } else {
                            setSelectedStudent(data.student)
                          }
                        } catch (e) {
                          console.error('Failed to fetch student details', e)
                        }
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border bg-transparent hover:bg-blue-500/20 hover:text-blue-400"
                      onClick={async () => {
                        try {
                          const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
                          const res = await fetch(`/api/staff/students/${student._id}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
                          const data = await res.json()
                          if (!res.ok) {
                            console.error('Failed to load student details', data)
                          } else {
                            // open AddStudentPage in edit mode with fetched student
                            setEditInitialStudent(data.student)
                            setEditStudentId(student._id)
                            setShowAddPage(true)
                          }
                        } catch (e) {
                          console.error('Failed to fetch student details', e)
                        }
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border bg-transparent hover:bg-cyan-500/20 hover:text-cyan-400"
                      onClick={() => handleResendInvite(student._id, student.email || '')}
                      disabled={resendingInvite === student._id}
                      title="Send Invitation Email"
                    >
                      {resendingInvite === student._id ? (
                        <span className="w-4 h-4 inline-block animate-spin">⏳</span>
                      ) : (
                        <Mail className="w-4 h-4 text-cyan-400" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border bg-transparent hover:bg-red-500/20 hover:text-red-400"
                      onClick={() => {
                        // Show confirmation dialog
                        setAlertType('confirm')
                        setAlertMessage('Are you sure you want to permanently delete this student?')
                        setConfirmAction(() => async () => {
                          try {
                            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
                            const res = await fetch(`/api/staff/students/${student._id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : undefined })
                            if (!res.ok) {
                              const data = await res.json().catch(() => ({}))
                              console.error('Failed to delete student', data)
                              setAlertType('error')
                              setAlertMessage(data?.error || 'Failed to delete student')
                            } else {
                              // refresh list
                              await loadStudents()
                              setAlertType('success')
                              setAlertMessage('Student deleted successfully.')
                            }
                            setAlertOpen(true)
                          } catch (e) {
                            console.error('Delete failed', e)
                            setAlertType('error')
                            setAlertMessage('Network error. Failed to delete student.')
                            setAlertOpen(true)
                          } finally {
                            setConfirmAction(null)
                          }
                        })
                        setAlertOpen(true)
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Custom Alert Dialog */}
      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent
          className={`${
            alertType === "success"
              ? "border-green-500"
              : alertType === "error"
              ? "border-red-500"
              : "border-yellow-500"
          } border-2 bg-background`}
        >
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              {alertType === "success" && <CheckCircle2 className="w-6 h-6 text-green-500" />}
              {alertType === "error" && <XCircle className="w-6 h-6 text-red-500" />}
              {alertType === "confirm" && <AlertTriangle className="w-6 h-6 text-yellow-500" />}
              <AlertDialogTitle
                className={
                  alertType === "success"
                    ? "text-green-500"
                    : alertType === "error"
                    ? "text-red-500"
                    : "text-yellow-500"
                }
              >
                {alertType === "success"
                  ? "Success"
                  : alertType === "error"
                  ? "Error"
                  : "Please Confirm"}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-foreground/80 mt-2">
              {alertMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {alertType === "confirm" ? (
              <>
                <AlertDialogCancel
                  onClick={() => {
                    setConfirmAction(null)
                    setAlertOpen(false)
                  }}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    setAlertOpen(false)
                    if (confirmAction) await confirmAction()
                  }}
                  className="bg-yellow-600 text-white hover:bg-yellow-700"
                >
                  Confirm
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction
                onClick={() => setAlertOpen(false)}
                className={
                  alertType === "success"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-red-600 text-white hover:bg-red-700"
                }
              >
                OK
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


// "use client"

// import { useEffect, useState } from "react"
// import { AddStudentPage } from "@/components/features/staff/add-student-page"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
// import {
//   Plus,
//   Edit2,
//   Eye,
//   Trash2,
//   Filter,
//   X,
//   Mail,
//   CheckCircle2,
//   XCircle,
//   AlertTriangle,
// } from "lucide-react"
// import {
//   AlertDialog,
//   AlertDialogAction,
//   AlertDialogCancel,
//   AlertDialogContent,
//   AlertDialogDescription,
//   AlertDialogFooter,
//   AlertDialogHeader,
//   AlertDialogTitle,
// } from "@/components/ui/alert-dialog"

// type Guardian = {
//   name?: string
//   primaryPhone?: string
//   whatsappPhone?: string
//   relationship?: string
//   notificationPreference?: string
// }

// type GovIdFile = { filename?: string; url?: string; mime?: string; uploadedAt?: string }

// type Student = {
//   _id: string
//   user_id?: string
//   name?: string
//   studentId?: string
//   email?: string
//   phone?: string
//   course?: string
//   year?: string
//   department?: string
//   emergencyContact?: string
//   guardian?: Guardian
//   documents?: string[]
//   hostelId?: string
//   photoUrl?: string
//   govIdType?: string
//   govIdValue?: string
//   govIdFiles?: GovIdFile[]
//   room?: string
//   roomNumber?: string
//   roomName?: string
//   bedNumber?: string
//   createdAt?: string
//   updatedAt?: string
// }

// export function StudentInformation() {
//   const [students, setStudents] = useState<Student[]>([])
//   const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
//   const [resendingInvite, setResendingInvite] = useState<string | null>(null)

//   // Attendance-related state
//   const [attendanceHistory, setAttendanceHistory] = useState<any[] | null>(null)
//   const [attendanceLoading, setAttendanceLoading] = useState(false)
//   const [attendanceError, setAttendanceError] = useState<string | null>(null)

//   const [filterType, setFilterType] = useState<"all" | "checkin" | "checkout">("all")
//   const [dateRangeStart, setDateRangeStart] = useState("")
//   const [dateRangeEnd, setDateRangeEnd] = useState("")
//   const [showFilters, setShowFilters] = useState(false)

//   // Add/Edit Student Page state
//   const [showAddPage, setShowAddPage] = useState(false)
//   const [editInitialStudent, setEditInitialStudent] = useState<any | null>(null)
//   const [editStudentId, setEditStudentId] = useState<string | null>(null)

//   // Unified alert dialog state (for success/error/confirm)
//   const [alertOpen, setAlertOpen] = useState(false)
//   const [alertType, setAlertType] = useState<"success" | "error" | "confirm">("success")
//   const [alertMessage, setAlertMessage] = useState("")
//   const [confirmAction, setConfirmAction] = useState<null | (() => Promise<void>)>(null)

//   // -----------------------------
//   // Load Students List
//   // -----------------------------
//   async function loadStudents() {
//     try {
//       const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
//       const res = await fetch("/api/staff/students", {
//         headers: token ? { Authorization: `Bearer ${token}` } : undefined,
//       })
//       const data = await res.json()
//       if (!res.ok) throw new Error(data?.error || "Failed to load students")
//       setStudents(data.students || [])
//     } catch (err) {
//       console.error("Failed to fetch students:", err)
//       setAlertType("error")
//       setAlertMessage("Failed to load student list.")
//       setAlertOpen(true)
//       setStudents([])
//     }
//   }

//   useEffect(() => {
//     loadStudents()
//   }, [])

//   // -----------------------------
//   // Resend Invitation
//   // -----------------------------
//   async function handleResendInvite(studentId: string, studentEmail: string) {
//     if (!studentEmail) {
//       setAlertType("error")
//       setAlertMessage("This student has no email address on file.")
//       setAlertOpen(true)
//       return
//     }

//     // Confirm via dialog
//     setAlertType("confirm")
//     setAlertMessage("Send a new invitation email with a new password to this student?")
//     setConfirmAction(() =>
//       async function confirmedSend() {
//         setResendingInvite(studentId)
//         try {
//           const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
//           const res = await fetch("/api/staff/students/resend-invitation", {
//             method: "POST",
//             headers: {
//               "Content-Type": "application/json",
//               ...(token ? { Authorization: `Bearer ${token}` } : {}),
//             },
//             body: JSON.stringify({ studentId }),
//           })
//           const data = await res.json()
//           if (!res.ok) throw new Error(data?.error || "Failed to send invitation")

//           setAlertType("success")
//           setAlertMessage("Invitation sent successfully! The student will receive a new password via email.")
//         } catch (e: any) {
//           setAlertType("error")
//           setAlertMessage(e.message || "Network error. Please try again.")
//         } finally {
//           setResendingInvite(null)
//           setConfirmAction(null)
//           setAlertOpen(true)
//         }
//       }
//     )
//     setAlertOpen(true)
//   }

//   // -----------------------------
//   // Delete Student (with confirm)
//   // -----------------------------
//   async function handleDeleteStudent(studentId: string) {
//     setAlertType("confirm")
//     setAlertMessage("Are you sure you want to permanently delete this student?")
//     setConfirmAction(() =>
//       async function confirmedDelete() {
//         try {
//           const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
//           const res = await fetch(`/api/staff/students/${studentId}`, {
//             method: "DELETE",
//             headers: token ? { Authorization: `Bearer ${token}` } : undefined,
//           })
//           if (!res.ok) {
//             const data = await res.json().catch(() => ({}))
//             throw new Error(data?.error || "Failed to delete student.")
//           }

//           await loadStudents()
//           setAlertType("success")
//           setAlertMessage("Student deleted successfully.")
//         } catch (e: any) {
//           setAlertType("error")
//           setAlertMessage(e.message || "Failed to delete student.")
//         } finally {
//           setConfirmAction(null)
//           setAlertOpen(true)
//         }
//       }
//     )
//     setAlertOpen(true)
//   }

//   // -----------------------------
//   // Load Attendance for Selected Student
//   // -----------------------------
//   useEffect(() => {
//     let active = true
//     async function loadAttendance() {
//       if (!selectedStudent) {
//         setAttendanceHistory(null)
//         return
//       }
//       setAttendanceLoading(true)
//       try {
//         const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
//         const res = await fetch("/api/warden/attendance", {
//           headers: token ? { Authorization: `Bearer ${token}` } : undefined,
//         })
//         const data = await res.json()
//         if (!res.ok) throw new Error(data?.error || "Failed to load attendance")

//         const raw = data.attendance || []
//         const ids = new Set([selectedStudent.user_id, selectedStudent.studentId].filter(Boolean))
//         const matches = raw.filter((a: any) => ids.has(String(a.user_id || a.uid || a.deviceUserId)))

//         matches.sort((a: any, b: any) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime())

//         if (active) setAttendanceHistory(matches)
//       } catch (err) {
//         if (active) {
//           console.error("Failed to load attendance:", err)
//           setAttendanceError("Network error.")
//         }
//       } finally {
//         if (active) setAttendanceLoading(false)
//       }
//     }
//     loadAttendance()
//     return () => {
//       active = false
//     }
//   }, [selectedStudent])

//   // -----------------------------
//   // Filter Attendance
//   // -----------------------------
//   const filteredAttendance = attendanceHistory
//     ? attendanceHistory.filter((a) => {
//         const punch =
//           typeof a.punch !== "undefined"
//             ? Number(a.punch)
//             : String(a.event_type || "").toLowerCase().includes("out")
//             ? 1
//             : 0
//         const type = punch === 0 ? "checkin" : "checkout"
//         if (filterType !== "all" && filterType !== type) return false

//         const date = new Date(a.timestamp_utc || a.timestamp || a.raw?.timestamp)
//         if (dateRangeStart && date < new Date(dateRangeStart)) return false
//         if (dateRangeEnd && date > new Date(dateRangeEnd)) return false
//         return true
//       })
//     : null

//   // -----------------------------
//   // Render
//   // -----------------------------
//   if (showAddPage) {
//     return (
//       <AddStudentPage
//         initialStudent={editInitialStudent || undefined}
//         studentId={editStudentId || undefined}
//         onBack={() => {
//           setShowAddPage(false)
//           setEditInitialStudent(null)
//           setEditStudentId(null)
//           loadStudents()
//         }}
//         onSaved={() => {
//           setShowAddPage(false)
//           setEditInitialStudent(null)
//           setEditStudentId(null)
//           loadStudents()
//         }}
//       />
//     )
//   }

//   return (
//     <div className="p-4 space-y-4">
//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <div>
//           <h2 className="text-2xl font-bold text-foreground">Student Information</h2>
//           <p className="text-sm text-muted-foreground">Manage student profiles and documents</p>
//         </div>
//         <Button
//           className="bg-cyan-500 hover:bg-cyan-600 text-black flex items-center gap-2"
//           onClick={() => {
//             setEditInitialStudent(null)
//             setEditStudentId(null)
//             setShowAddPage(true)
//           }}
//         >
//           <Plus className="w-4 h-4" />
//           Add Student
//         </Button>
//       </div>

//       {/* Student List */}
//       {!selectedStudent ? (
//         <div className="grid gap-4">
//           {students.map((student) => (
//             <Card key={student._id} className="border-border bg-card/50 backdrop-blur-sm">
//               <CardContent className="p-6 flex items-start justify-between">
//                 <div className="flex-1">
//                   <h3 className="text-lg font-bold text-foreground">{student.name}</h3>
//                   <p className="text-sm text-muted-foreground mb-3">Phone: {student.phone}</p>
//                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//                     <div>
//                       <p className="text-xs text-muted-foreground">Email</p>
//                       <p className="text-sm font-semibold text-cyan-400">{student.email}</p>
//                     </div>
//                     <div>
//                       <p className="text-xs text-muted-foreground">Course</p>
//                       <p className="text-sm font-semibold text-cyan-400">{student.course}</p>
//                     </div>
//                     <div>
//                       <p className="text-xs text-muted-foreground">Year</p>
//                       <p className="text-sm font-semibold text-cyan-400">{student.year}</p>
//                     </div>
//                     <div>
//                       <p className="text-xs text-muted-foreground">Department</p>
//                       <p className="text-sm font-semibold text-cyan-400">{student.department}</p>
//                     </div>
//                   </div>
//                 </div>

//                 {/* Action Buttons */}
//                 <div className="flex gap-2">
//                   <Button variant="outline" size="sm" onClick={() => setSelectedStudent(student)}>
//                     <Eye className="w-4 h-4" />
//                   </Button>
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => {
//                       setEditInitialStudent(student)
//                       setEditStudentId(student._id)
//                       setShowAddPage(true)
//                     }}
//                   >
//                     <Edit2 className="w-4 h-4" />
//                   </Button>
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => handleResendInvite(student._id, student.email || "")}
//                     disabled={resendingInvite === student._id}
//                   >
//                     {resendingInvite === student._id ? "..." : <Mail className="w-4 h-4 text-cyan-400" />}
//                   </Button>
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() => handleDeleteStudent(student._id)}
//                   >
//                     <Trash2 className="w-4 h-4 text-red-400" />
//                   </Button>
//                 </div>
//               </CardContent>
//             </Card>
//           ))}
//         </div>
//       ) : (
//         // ---------------------------
//         // Student Details & Attendance
//         // ---------------------------
//         <Card className="border-border bg-card/50 backdrop-blur-sm">
//           <CardHeader>
//             <div className="flex items-center justify-between">
//               <CardTitle className="text-cyan-400">{selectedStudent.name}</CardTitle>
//               <Button variant="outline" size="sm" onClick={() => setSelectedStudent(null)}>
//                 Back
//               </Button>
//             </div>
//           </CardHeader>
//           <CardContent>
//             {/* Attendance History */}
//             <div className="mt-6">
//               <div className="flex items-center justify-between mb-4">
//                 <h3 className="text-lg font-bold text-cyan-400">Attendance History</h3>
//                 <Button
//                   variant="outline"
//                   size="sm"
//                   onClick={() => setShowFilters(!showFilters)}
//                 >
//                   <Filter className="w-4 h-4 mr-2" />
//                   Filters
//                 </Button>
//               </div>
//               {showFilters && (
//                 <div className="p-4 bg-slate-800/50 rounded-lg mb-4">
//                   <div className="flex items-center justify-between mb-2">
//                     <h4 className="text-sm font-semibold">Filter Options</h4>
//                     <Button
//                       variant="ghost"
//                       size="sm"
//                       onClick={() => {
//                         setFilterType("all")
//                         setDateRangeStart("")
//                         setDateRangeEnd("")
//                       }}
//                     >
//                       <X className="w-3 h-3 mr-1" />
//                       Clear All
//                     </Button>
//                   </div>
//                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//                     <select
//                       value={filterType}
//                       onChange={(e) => setFilterType(e.target.value as any)}
//                       className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg"
//                     >
//                       <option value="all">All</option>
//                       <option value="checkin">Check-in Only</option>
//                       <option value="checkout">Check-out Only</option>
//                     </select>
//                     <input
//                       type="date"
//                       value={dateRangeStart}
//                       onChange={(e) => setDateRangeStart(e.target.value)}
//                       className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg"
//                     />
//                     <input
//                       type="date"
//                       value={dateRangeEnd}
//                       onChange={(e) => setDateRangeEnd(e.target.value)}
//                       className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg"
//                     />
//                   </div>
//                 </div>
//               )}

//               <div className="space-y-3">
//                 {attendanceLoading && <div>Loading attendance...</div>}
//                 {attendanceError && <div className="text-red-400">{attendanceError}</div>}
//                 {filteredAttendance &&
//                   filteredAttendance.slice().reverse().map((a, i) => {
//                     const type = a.punch === 0 ? "In" : "Out"
//                     return (
//                       <div
//                         key={i}
//                         className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
//                       >
//                         <div>
//                           <div className="font-semibold">{type}</div>
//                           <div className="text-xs text-muted-foreground">
//                             {new Date(a.timestamp_utc || a.timestamp).toLocaleString()}
//                           </div>
//                         </div>
//                         <div className="text-right text-xs text-muted-foreground">
//                           Device: {a.device_ip || "—"}
//                         </div>
//                       </div>
//                     )
//                   })}
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//       )}

//       {/* ✅ Shared Alert Dialog for all actions */}
//       <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
//         <AlertDialogContent
//           className={`${
//             alertType === "success"
//               ? "border-green-500"
//               : alertType === "error"
//               ? "border-red-500"
//               : "border-yellow-500"
//           } border-2 bg-background`}
//         >
//           <AlertDialogHeader>
//             <div className="flex items-center gap-2">
//               {alertType === "success" && <CheckCircle2 className="w-6 h-6 text-green-500" />}
//               {alertType === "error" && <XCircle className="w-6 h-6 text-red-500" />}
//               {alertType === "confirm" && <AlertTriangle className="w-6 h-6 text-yellow-500" />}
//               <AlertDialogTitle
//                 className={
//                   alertType === "success"
//                     ? "text-green-500"
//                     : alertType === "error"
//                     ? "text-red-500"
//                     : "text-yellow-500"
//                 }
//               >
//                 {alertType === "success"
//                   ? "Success"
//                   : alertType === "error"
//                   ? "Error"
//                   : "Please Confirm"}
//               </AlertDialogTitle>
//             </div>
//             <AlertDialogDescription className="text-foreground/80 mt-2">
//               {alertMessage}
//             </AlertDialogDescription>
//           </AlertDialogHeader>
//           <AlertDialogFooter>
//             {alertType === "confirm" ? (
//               <>
//                 <AlertDialogCancel
//                   onClick={() => {
//                     setConfirmAction(null)
//                     setAlertOpen(false)
//                   }}
//                 >
//                   Cancel
//                 </AlertDialogCancel>
//                 <AlertDialogAction
//                   onClick={async () => {
//                     setAlertOpen(false)
//                     if (confirmAction) await confirmAction()
//                   }}
//                   className="bg-yellow-600 text-white hover:bg-yellow-700"
//                 >
//                   Confirm
//                 </AlertDialogAction>
//               </>
//             ) : (
//               <AlertDialogAction
//                 onClick={() => setAlertOpen(false)}
//                 className={
//                   alertType === "success"
//                     ? "bg-green-600 text-white hover:bg-green-700"
//                     : "bg-red-600 text-white hover:bg-red-700"
//                 }
//               >
//                 OK
//               </AlertDialogAction>
//             )}
//           </AlertDialogFooter>
//         </AlertDialogContent>
//       </AlertDialog>
//     </div>
//   )
// }
