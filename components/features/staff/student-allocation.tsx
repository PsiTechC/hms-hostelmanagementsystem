"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Edit2, Trash2, History, ArrowRight } from "lucide-react"

export function StudentAllocation() {
  type Allocation = {
    _id: string | number
    studentName?: string
    studentId?: string
    phone?: string
    room?: string
    bed?: string
    allocatedDate?: string
    status?: string
  }

  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [allocLoading, setAllocLoading] = useState(false)
  const [allocError, setAllocError] = useState<string | null>(null)

  const [showHistory, setShowHistory] = useState(false)
  const [allocationHistory, setAllocationHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  useEffect(() => {
    async function loadAllocations() {
      setAllocLoading(true)
      setAllocError(null)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined
        // Fetch students and full rooms (including beds)
        const [studentsRes, roomsRes] = await Promise.all([
          fetch('/api/staff/students', { headers }),
          fetch('/api/hostel-admin/rooms', { headers }),
        ])

        const [studentsData, roomsData] = await Promise.all([studentsRes.json(), roomsRes.json()])

        if (!studentsRes.ok) throw new Error(studentsData?.error || 'Failed to load students')
        if (!roomsRes.ok) throw new Error(roomsData?.error || 'Failed to load rooms')

        const students: any[] = studentsData.students || []
        const roomsList: any[] = roomsData.rooms || []

        // Build simple allocations list for the summary view
        const allocs: Allocation[] = students
          .filter((s) => s.room)
          .map((s) => ({
            _id: s._id,
            studentName: s.name,
            studentId: s.studentId,
            phone: s.phone,
            room: String(s.room),
            bed: s.bedNumber || '',
            allocatedDate: s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : '',
            status: 'active',
          }))

        // Enrich rooms with bed-level assignment info
        const roomsWithBeds = roomsList.map((r) => {
          const bedsArr = Array.isArray(r.beds) && r.beds.length > 0
            ? r.beds.map((b: any) => ({ number: String(b.number ?? b), raw: b }))
            : Array.from({ length: Number(r.capacity || 0) }, (_, i) => ({ number: String(i + 1), raw: null }))

          // attach assigned student info to each bed if present
          const beds = bedsArr.map((b: any) => {
            const assigned = students.find((s) => String(s.room) === String(r._id) && String(s.bedNumber) === String(b.number))
            return { number: b.number, occupied: !!assigned, student: assigned ? { name: assigned.name, phone: assigned.phone } : undefined }
          })

          return { _id: r._id, number: r.number || String(r._id), beds }
        })

        setAllocations(allocs)
        setRooms(roomsWithBeds)
      } catch (e: any) {
        console.error('Failed to load allocations', e)
        setAllocError(e?.message || 'Failed to load allocations')
        setAllocations([])
        setRooms([])
      } finally {
        setAllocLoading(false)
      }
    }

    loadAllocations()
  }, [])

  // Load allocation history when history panel is shown
  useEffect(() => {
    async function loadHistory() {
      if (!showHistory) {
        return
      }

      setHistoryLoading(true)
      setHistoryError(null)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined
        const res = await fetch('/api/staff/allocation-history', { headers })
        const data = await res.json()

        if (!res.ok) throw new Error(data?.error || 'Failed to load allocation history')

        setAllocationHistory(data.history || [])
      } catch (e: any) {
        console.error('Failed to load allocation history', e)
        setHistoryError(e?.message || 'Failed to load allocation history')
        setAllocationHistory([])
      } finally {
        setHistoryLoading(false)
      }
    }

    loadHistory()
  }, [showHistory])

  return (
    <div className="p-6 space-y-6 ">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Student Allocation</h2>
          <p className="text-sm text-muted-foreground">Assign students to rooms and beds</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-border flex items-center gap-2 bg-transparent hover:bg-blue-500/20 hover:text-blue-400"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="w-4 h-4" />
            History
          </Button>
          {/* <Button className="bg-cyan-500 hover:bg-cyan-600 text-black flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Allocate Student
          </Button> */}
        </div>
      </div>

      {showHistory && (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-cyan-400 mb-4">Room Allocation History (Recent 5 per Student)</h3>

            {historyLoading && (
              <div className="text-sm text-muted-foreground">Loading allocation history...</div>
            )}

            {historyError && (
              <div className="text-sm text-red-400">{historyError}</div>
            )}

            {!historyLoading && !historyError && allocationHistory.length === 0 && (
              <div className="text-sm text-muted-foreground">No allocation history found.</div>
            )}

            {!historyLoading && !historyError && allocationHistory.length > 0 && (() => {
              // Group allocation history by student
              const groupedByStudent = allocationHistory.reduce((acc: any, entry: any) => {
                const key = entry.studentId
                if (!acc[key]) {
                  acc[key] = {
                    studentName: entry.studentName,
                    studentIdNumber: entry.studentIdNumber,
                    allocations: []
                  }
                }
                acc[key].allocations.push(entry)
                return acc
              }, {})

              // Sort each student's allocations by date (oldest first)
              Object.values(groupedByStudent).forEach((group: any) => {
                group.allocations.sort((a: any, b: any) => {
                  const dateA = new Date(a.allocatedAt).getTime()
                  const dateB = new Date(b.allocatedAt).getTime()
                  return dateA - dateB // Ascending order (oldest first)
                })
              })

              return (
                <div className="space-y-6 max-h-[60vh] overflow-y-auto scrollbar-hide">
                  {Object.values(groupedByStudent).map((studentGroup: any, studentIdx: number) => (
                    <div key={studentIdx} className="space-y-3">
                      <h4 className="text-md font-semibold text-foreground">
                        {studentGroup.studentName} {studentGroup.studentIdNumber ? `(${studentGroup.studentIdNumber})` : ''}
                      </h4>

                      {/* Horizontal scrollable container */}
                      <div className="relative">
                        <div className="flex items-center gap-4 overflow-x-auto pb-4 scrollbar-hide">
                          {studentGroup.allocations.map((entry: any, idx: number) => {
                            const allocatedDate = entry.allocatedAt
                              ? new Date(entry.allocatedAt).toLocaleDateString('en-IN', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Unknown date'

                            const deallocatedDate = entry.deallocatedAt
                              ? new Date(entry.deallocatedAt).toLocaleDateString('en-IN', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : null

                            return (
                              <div key={idx} className="flex items-center flex-shrink-0">
                                {/* Allocation Card */}
                                <div className="w-52 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                  <div className="space-y-1.5">
                                    <div className="text-sm font-bold text-cyan-400">
                                      Room {entry.roomNumber || '—'} • Bed {entry.bedNumber || '—'}
                                    </div>
                                    <div className="space-y-0.5">
                                      <div className="text-[10px] text-muted-foreground">Allocated</div>
                                      <div className="text-[11px] font-semibold text-foreground">{allocatedDate}</div>
                                    </div>
                                    {deallocatedDate && (
                                      <div className="space-y-0.5">
                                        <div className="text-[10px] text-muted-foreground">Deallocated</div>
                                        <div className="text-[11px] font-semibold text-orange-400">{deallocatedDate}</div>
                                      </div>
                                    )}
                                    {!deallocatedDate && (
                                      <div className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded inline-block">
                                        Currently Active
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Arrow between cards (except for the last one) */}
                                {idx < studentGroup.allocations.length - 1 && (
                                  <ArrowRight className="w-5 h-5 text-cyan-400 mx-2 flex-shrink-0" />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {allocLoading && <div className="text-sm text-muted-foreground">Loading allocations…</div>}
      {allocError && <div className="text-sm text-red-400">{allocError}</div>}

      {/* Room cards showing beds */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map((room) => (
          <Card key={room._id} className="border-border bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-lg font-bold text-foreground">Room {room.number}</h4>
                  <div className="text-xs text-muted-foreground">Beds: {room.beds.length}</div>
                </div>
                {/* room id removed from UI per request */}
              </div>

              <div className="grid grid-cols-3 gap-4">
                {room.beds.map((b: any) => (
                  <div key={b.number} className="flex flex-col items-center gap-1">
                    <div className="flex flex-col items-center">
                      <div className={`w-14 h-14 rounded border flex items-center justify-center text-sm font-medium ${b.occupied ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
                        {b.number}
                      </div>
                      {/* always-visible student info */}
                      <div className="mt-2 text-center">
                        {b.occupied && b.student ? (
                          <div className="text-xs leading-tight space-y-0.5">
                            <div className="font-semibold text-foreground break-words">{b.student.name}</div>
                            <div className="text-[11px] text-muted-foreground break-words">{b.student.phone || '—'}</div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">Vacant</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
