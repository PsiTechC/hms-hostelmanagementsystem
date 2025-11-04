"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Users, Home, BedDouble } from "lucide-react"
import { StudentAllocation } from "@/components/features/staff/student-allocation"
import { StudentInformation } from "@/components/features/staff/student-information"
import { GuardianManagement } from "@/components/features/staff/guardian-management"
import StaffSettings from "@/components/features/staff/staff-settings"

interface StaffDashboardProps {
  activeSection: string
}

export function StaffDashboard({ activeSection }: StaffDashboardProps) {
  const [students, setStudents] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true)
      setError(null)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined

        const [studentsRes, roomsRes] = await Promise.all([
          fetch('/api/staff/students', { headers }),
          fetch('/api/hostel-admin/rooms', { headers }),
        ])

        const [studentsData, roomsData] = await Promise.all([
          studentsRes.json(),
          roomsRes.json(),
        ])

        if (!studentsRes.ok) throw new Error(studentsData?.error || 'Failed to load students')
        if (!roomsRes.ok) throw new Error(roomsData?.error || 'Failed to load rooms')

        setStudents(studentsData.students || [])
        setRooms(roomsData.rooms || [])
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
  if (activeSection === "rooms") {
    return <StudentAllocation />
  }

  if (activeSection === "students") {
    return <StudentInformation />
  }

  if (activeSection === "guardians") {
    return <GuardianManagement />
  }

  if (activeSection === "settings") {
    return <StaffSettings />
  }

  // Calculate statistics
  const totalStudents = students.length
  const studentsWithRooms = students.filter((s) => s.room).length
  const totalBeds = rooms.reduce((sum, room) => sum + (room.capacity || 0), 0)
  const occupiedBeds = rooms.reduce((sum, room) => sum + (room.occupied || 0), 0)
  const vacantBeds = totalBeds - occupiedBeds

  return (
    <div className="p-6 space-y-6">
      {loading && (
        <div className="text-sm text-muted-foreground">Loading dashboard data...</div>
      )}
      {error && (
        <div className="text-sm text-red-400">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all glow-accent-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Students Managed</p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {loading ? '...' : totalStudents}
                </p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all glow-accent-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Room Allocations</p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {loading ? '...' : studentsWithRooms}
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-3 rounded-lg">
                <Home className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all glow-accent-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vacant Beds</p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {loading ? '...' : vacantBeds}
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-3 rounded-lg">
                <BedDouble className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!loading && rooms.length > 0 && (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">Room Status Overview</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {rooms.map((room) => {
                const capacity = room.capacity || 0
                const occupied = room.occupied || 0
                const occupancyPercent = capacity > 0 ? (occupied / capacity) * 100 : 0

                let bgColor = 'bg-green-500'
                let textColor = 'text-white'
                let statusText = 'Vacant'

                if (occupancyPercent === 100) {
                  bgColor = 'bg-red-500'
                  statusText = 'Full'
                } else if (occupancyPercent > 0) {
                  bgColor = 'bg-yellow-500'
                  statusText = 'Partial'
                }

                return (
                  <div
                    key={room._id}
                    className={`${bgColor} ${textColor} rounded-lg p-3 hover:shadow-lg transition-all cursor-pointer group relative`}
                    title={`Room ${room.number || room._id}\nCapacity: ${capacity}\nOccupied: ${occupied}\nVacant: ${capacity - occupied}\nStatus: ${statusText}`}
                  >
                    <div className="text-center">
                      <div className="text-lg font-bold">{room.number || room._id}</div>
                      <div className="text-xs opacity-90">{occupied}/{capacity}</div>
                    </div>

                    {/* Hover tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-slate-900 text-white text-xs rounded-lg p-2 shadow-xl border border-slate-700 whitespace-nowrap">
                        <div className="font-bold mb-1">Room {room.number || room._id}</div>
                        <div>Capacity: {capacity}</div>
                        <div>Occupied: {occupied}</div>
                        <div>Vacant: {capacity - occupied}</div>
                        <div className="mt-1 font-semibold">{statusText}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-muted-foreground">Vacant</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span className="text-muted-foreground">Partial</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-muted-foreground">Full</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <p className="text-muted-foreground">Select a section from the sidebar to manage staff operations.</p>
        </CardContent>
      </Card>
    </div>
  )
}
