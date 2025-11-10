"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle, Clock, RefreshCw } from "lucide-react"
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export function AttendanceMonitoring() {
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hostelNightIn, setHostelNightIn] = useState<string | null>(null)
  const [autoSendEnabled, setAutoSendEnabled] = useState(false)
  const [autoSendMode, setAutoSendMode] = useState<'frontend' | 'backend' | 'disabled'>('frontend')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  // Track sent events by unique key: studentId + checkInTime
  const sentEventsRef = useRef<Set<string>>(new Set())
  const listRef = useRef<HTMLDivElement | null>(null)

  // auto-scroll to top when attendanceRecords update
  useEffect(() => {
    if (listRef.current) {
      try { listRef.current.scrollTo({ top: 0, behavior: 'smooth' }) } catch (e) { listRef.current.scrollTop = 0 }
    }
  }, [attendanceRecords])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "late":
        return <AlertCircle className="w-5 h-5 text-orange-400" />
      case "ontime":
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case "absent":
        return <Clock className="w-5 h-5 text-red-400" />
      default:
        return null
    }
  }

  const loadAttendance = useCallback(async () => {
    setLoading(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/warden/attendance', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      if (!res.ok) {
        console.error('Failed to load attendance')
        setAttendanceRecords([])
        setHostelNightIn(null)
        setLoading(false)
        return
      }
      const json = await res.json()
      const students = json.students || []
      const attendance = json.attendance || []
      const nightIn = json.hostel?.nightInTime || null
      setHostelNightIn(nightIn)

      // Build a map of all events per user for TODAY (use raw.timestamp as IST source)
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
      const pad = (n: number) => String(n).padStart(2, '0')

      const parseRawISTToDate = (s: string) => {
        // raw timestamp is in format 'YYYY-MM-DD HH:MM:SS' (IST). Convert to a Date representing the correct instant.
        if (!s) return null
        const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/)
        if (!m) return new Date(s)
        const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]), hh = Number(m[4]), mm = Number(m[5]), ss = Number(m[6])
        // Compute UTC millis for this IST local time by subtracting IST offset
        const utcMillis = Date.UTC(y, mo, d, hh, mm, ss) - IST_OFFSET_MS
        return new Date(utcMillis)
      }

      const istDateKey = (dt: Date) => {
        const ist = new Date(dt.getTime() + IST_OFFSET_MS)
        return `${ist.getFullYear()}-${pad(ist.getMonth() + 1)}-${pad(ist.getDate())}`
      }

      const todayKey = istDateKey(new Date())

      const eventsByUser = new Map<string, Array<{ type: 'In' | 'Out'; date: Date; displayTime: string; raw?: any; isLate?: boolean }>>()
      for (const a of attendance) {
        const uid = String(a.user_id ?? a.uid ?? a.deviceUserId ?? '').trim()
        if (!uid) continue

        // prefer raw.timestamp (already IST); fallback to timestamp_utc or timestamp
        const rawTs = a.raw?.timestamp ?? a.timestamp ?? a.timestamp_utc
        if (!rawTs) continue

        // parse to Date (treat raw timestamp as IST local)
        let eventDate: Date | null = null
        if (a.raw?.timestamp) eventDate = parseRawISTToDate(a.raw.timestamp)
        else if (a.timestamp) eventDate = new Date(a.timestamp)
        else eventDate = new Date(a.timestamp_utc)
        if (!eventDate || isNaN(eventDate.getTime())) continue

        // only include events for today's IST date
        if (istDateKey(eventDate) !== todayKey) continue

        const punch = typeof a.punch !== 'undefined' ? Number(a.punch) : (String(a.event_type || '').toLowerCase().includes('out') ? 1 : 0)
        const type = punch === 0 ? 'In' : 'Out'

        // displayTime: use raw timestamp string's HH:MM if raw available, else format via IST
        let displayTime = null
        if (a.raw?.timestamp) {
          const m = String(a.raw.timestamp).trim().match(/\d{4}-\d{2}-\d{2}[ T](\d{2}:\d{2})(?::\d{2})?/)
          displayTime = m ? m[1] : String(a.raw.timestamp)
        } else {
          // format eventDate in IST
          const ist = new Date(eventDate.getTime() + IST_OFFSET_MS)
          displayTime = `${pad(ist.getHours())}:${pad(ist.getMinutes())}`
        }

        // Don't determine lateness per-event here; we'll check it per-user based on latest check-in
        const arr = eventsByUser.get(uid) || []
        arr.push({ type, date: eventDate, displayTime, raw: a, isLate: false })
        eventsByUser.set(uid, arr)
      }

      // sort each user's events by time ascending
      for (const [k, arr] of eventsByUser.entries()) {
        arr.sort((x, y) => x.date.getTime() - y.date.getTime())
        eventsByUser.set(k, arr)
      }

      // produce records for UI based on students list
      const records = students.map((s: any, idx: number) => {
        const uid = String(s.user_id ?? '').trim()
        const events = eventsByUser.get(uid) || []

        // Find latest check-in and determine if it's late
        const allCheckIns = events.filter(e => e.type === 'In')
        const latestCheckIn = allCheckIns.length > 0 ? allCheckIns[allCheckIns.length - 1] : null

        // Determine if latest check-in is late
        let isLatestCheckInLate = false
        if (latestCheckIn && nightIn) {
          const timeSource = latestCheckIn.displayTime || ''
          const tmatch = String(timeSource).match(/(\d{2}):(\d{2})/) // HH:MM
          const nmatch = String(nightIn).match(/(\d{1,2}):(\d{2})/)
          if (tmatch && nmatch) {
            const ciH = Number(tmatch[1])
            const ciM = Number(tmatch[2])
            const nh = Number(nmatch[1])
            const nm = Number(nmatch[2])
            isLatestCheckInLate = ciH > nh || (ciH === nh && ciM > nm)
          }
        }

        // Mark the latest check-in event as late if applicable
        if (latestCheckIn && isLatestCheckInLate) {
          latestCheckIn.isLate = true
        }

        // build events display array (all today's events)
        const eventsDisplay = events.map(e => ({ type: e.type, time: e.displayTime, isLate: !!e.isLate }))

        // determine status based on latest check-in: if latest In is late -> 'late',
        // else if any In -> 'ontime', else 'absent'
        let status = 'absent'
        const hasAnyIn = events.some(e => e.type === 'In')
        if (isLatestCheckInLate) status = 'late'
        else if (hasAnyIn) status = 'ontime'

        return {
          id: s._id || idx,
          studentName: s.name || '—',
          studentId: s.studentId || (s.user_id || ''),
          events: eventsDisplay,
          nightInTime: nightIn,
          status,
          rawStudent: s,
          lastRaw: { events: events },
        }
      })

      setAttendanceRecords(records)
      setLastRefresh(new Date())
    } catch (e) {
      console.error('Attendance load failed', e)
      setAttendanceRecords([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Load auto-send settings on mount
  useEffect(() => {
    const loadAutoSendSettings = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const res = await fetch('/api/warden/auto-send-toggle', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        })
        if (res.ok) {
          const data = await res.json()
          setAutoSendMode(data.autoSendMode || 'frontend')
          setAutoSendEnabled(data.autoSendEnabled || false)
          console.log('[Auto-send] Loaded settings:', data)
        }
      } catch (e) {
        console.error('[Auto-send] Failed to load settings:', e)
      }
    }
    loadAutoSendSettings()
  }, [])

  // Initial load on mount
  useEffect(() => {
    loadAttendance()
  }, [loadAttendance])

  // Polling: refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadAttendance()
    }, 5000) // 5 seconds

    return () => clearInterval(interval)
  }, [loadAttendance])

  // Reset sent list at midnight (new day)
  useEffect(() => {
    const checkMidnight = () => {
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes()

      // Reset at 00:00
      if (hours === 0 && minutes === 0) {
        console.log('[Auto-send] New day detected, clearing sent events list')
        sentEventsRef.current.clear()
      }
    }

    // Check every minute
    const interval = setInterval(checkMidnight, 60000)
    return () => clearInterval(interval)
  }, [])

  // Auto-send WhatsApp alerts for newly late check-in events (ONLY for frontend mode)
  useEffect(() => {
    if (!autoSendEnabled || autoSendMode !== 'frontend') return

    const sendAutoAlerts = async () => {
      // Find students with late check-ins that haven't been alerted yet
      const studentsToAlert: Array<{ studentId: string; studentName: string; latestCheckInTime: string }> = []

      for (const record of attendanceRecords) {
        if (record.status !== 'late') continue

        // Get the latest check-in event (which is marked as late)
        const lateEvents = (record.lastRaw?.events || []).filter((e: any) => e.isLate)
        if (lateEvents.length === 0) continue

        // Get the most recent late check-in
        const latestLateEvent = lateEvents[lateEvents.length - 1]
        const checkInTime = latestLateEvent.displayTime || ''

        // Create unique key for this specific late event: studentId + checkInTime
        const eventKey = `${record.id}_${checkInTime}`

        // Check if we've already sent alert for this specific late check-in
        if (!sentEventsRef.current.has(eventKey)) {
          studentsToAlert.push({
            studentId: record.rawStudent?._id || record.id,
            studentName: record.studentName,
            latestCheckInTime: checkInTime
          })
        }
      }

      if (studentsToAlert.length === 0) {
        console.log('[Auto-send] No new late check-in events found')
        return
      }

      console.log(`[Auto-send] Found ${studentsToAlert.length} new late check-in events:`,
                  studentsToAlert.map(s => `${s.studentName} at ${s.latestCheckInTime}`))

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const studentIds = studentsToAlert.map(s => s.studentId).filter(Boolean)

      try {
        const res = await fetch('/api/warden/alerts/whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ studentIds }),
        })
        const json = await res.json()
        console.log('[Auto-send] WhatsApp alerts sent:', json)

        // Mark these specific events as sent
        for (const student of studentsToAlert) {
          const eventKey = `${attendanceRecords.find(r => r.rawStudent?._id === student.studentId || r.id === student.studentId)?.id}_${student.latestCheckInTime}`
          sentEventsRef.current.add(eventKey)
        }
        console.log('[Auto-send] Updated sent events list. Total events tracked:', sentEventsRef.current.size)
      } catch (e) {
        console.error('[Auto-send] Failed to send WhatsApp alerts', e)
      }
    }

    sendAutoAlerts()
  }, [attendanceRecords, autoSendEnabled, autoSendMode])

  // Handle toggle change - update database
  const handleAutoSendToggle = async (enabled: boolean) => {
    setAutoSendEnabled(enabled)

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/warden/auto-send-toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ enabled })
      })

      if (res.ok) {
        const data = await res.json()
        console.log('[Auto-send] Toggle updated:', data)
      } else {
        console.error('[Auto-send] Failed to update toggle')
        // Revert on error
        setAutoSendEnabled(!enabled)
      }
    } catch (e) {
      console.error('[Auto-send] Toggle error:', e)
      // Revert on error
      setAutoSendEnabled(!enabled)
    }
  }

  // Manual send WhatsApp alerts
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const [whatsappResult, setWhatsappResult] = useState<any | null>(null)

  async function sendWhatsAppAlerts() {
    // compute late students from the current attendanceRecords (client-side) to avoid sending for all students
    const lateStudents = attendanceRecords.filter(r => r.status === 'late')
    if (!lateStudents.length) {
      alert('No late entries found for today.')
      return
    }

    if (!confirm(`Send WhatsApp alerts to guardians of ${lateStudents.length} late student(s) today?`)) return

    setSendingWhatsApp(true)
    setWhatsappResult(null)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

      // build array of student _id values to pass to the server so it only sends for these students
      const studentIds = lateStudents.map(s => s.rawStudent?._id || s.id).filter(Boolean)

      const res = await fetch('/api/warden/alerts/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ studentIds }),
      })
      const json = await res.json()
      setWhatsappResult(json)

      // Mark these specific late events as sent (for auto-send tracking)
      for (const student of lateStudents) {
        const lateEvents = (student.lastRaw?.events || []).filter((e: any) => e.isLate)
        if (lateEvents.length > 0) {
          const latestLateEvent = lateEvents[lateEvents.length - 1]
          const checkInTime = latestLateEvent.displayTime || ''
          const eventKey = `${student.id}_${checkInTime}`
          sentEventsRef.current.add(eventKey)
        }
      }
      console.log('[Manual send] Updated sent events list. Total events tracked:', sentEventsRef.current.size)
    } catch (e) {
      console.error('WhatsApp send failed', e)
      setWhatsappResult({ error: 'Network error' })
    } finally {
      setSendingWhatsApp(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Attendance Monitoring</h2>
        <p className="text-sm text-muted-foreground">Real-time attendance tracking and oversight</p>
        <p className="text-xs text-muted-foreground mt-1">
          Last refreshed: {lastRefresh.toLocaleTimeString()} (auto-refreshes every 5s)
        </p>
        {autoSendEnabled && autoSendMode === 'frontend' && (
          <p className="text-xs text-yellow-400 mt-1">
            ⚠️ Auto-send WhatsApp enabled (Frontend Mode - requires page open)
          </p>
        )}
        {autoSendEnabled && autoSendMode === 'backend' && (
          <p className="text-xs text-green-400 mt-1">
            ✓ Auto-send WhatsApp enabled (Backend Mode - 24/7 active)
          </p>
        )}
      </div>

      <div className="flex justify-between items-center gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="auto-send"
            checked={autoSendEnabled}
            onCheckedChange={handleAutoSendToggle}
          />
          <Label htmlFor="auto-send" className="text-sm">
            Auto-send WhatsApp alerts for late students
            {autoSendMode === 'backend' && <span className="text-xs text-blue-400 ml-2">(Server-side 24/7)</span>}
            {autoSendMode === 'frontend' && <span className="text-xs text-yellow-400 ml-2">(Page-based)</span>}
          </Label>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={loadAttendance}
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={sendWhatsAppAlerts}
            disabled={sendingWhatsApp}
            className="bg-cyan-500 hover:bg-cyan-600 text-black flex items-center gap-2"
          >
            {sendingWhatsApp ? 'Sending...' : 'Send WhatsApp Alerts'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">On Time</p>
                <p className="text-3xl font-bold text-green-400">{attendanceRecords.filter(r => r.status === 'ontime').length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Late Entries</p>
                <p className="text-3xl font-bold text-orange-400">{attendanceRecords.filter(r => r.status === 'late').length}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Absent</p>
                <p className="text-3xl font-bold text-red-400">{attendanceRecords.filter(r => r.status === 'absent').length}</p>
              </div>
              <Clock className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-cyan-400">Today's Attendance</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="space-y-3">
              {/* container with auto-scroll */}
              {
                (() => {
                  // flatten all events across students and sort by date (newest first)
                  const flat: Array<any> = []
                  for (const r of attendanceRecords) {
                    const events = (r.lastRaw?.events || [])
                    for (const e of events) {
                      flat.push({
                        studentName: r.studentName,
                        studentId: r.studentId,
                        type: e.type,
                        time: e.displayTime || e.time || '',
                        date: e.date || (e._resolvedTs || null),
                        // prefer event-level late flag when available
                        status: e.isLate ? 'late' : r.status,
                      })
                    }
                  }
                  flat.sort((a, b) => (b.date?.getTime ? b.date.getTime() : 0) - (a.date?.getTime ? a.date.getTime() : 0))
                  return (
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto" ref={listRef as any}>
                      {flat.map((entry, idx) => (
                        <div key={`${entry.studentId}-${idx}`} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">{entry.studentName}</p>
                            <p className="text-xs text-muted-foreground">ID: {entry.studentId}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">{`${entry.type}: ${entry.time}`}</p>
                            <p className="text-xs text-muted-foreground">Night-In: {hostelNightIn ?? '—'}</p>
                          </div>
                          <div className="ml-4">{getStatusIcon(entry.status)}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()
              }
            </div>
          </CardContent>
      </Card>
    </div>
  )
}
