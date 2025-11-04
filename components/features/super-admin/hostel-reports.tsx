"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { AlertTriangle, Users, Home, Shield } from 'lucide-react'

type RoomView = {
  _id: string
  number: string
  name?: string
  capacity: number
  beds: Array<any>
  occupied: number
  bedCount: number
  available: number
}

type HostelView = {
  _id: string
  name: string
  code?: string
  address?: string
  adminName?: string
  contactEmail?: string
  contactPhone?: string
  licenseExpiry?: string
  roomsUnlimited: boolean
  capacityUnlimited: boolean
  totalRooms: number
  capacity: number
  totalBeds: number
  occupiedBeds: number
  availableBeds: number
  totalStudents: number
  staffCount?: number
  staffRoles?: Record<string, number>
  rooms: RoomView[]
}

export function HostelReports() {
  const [hostels, setHostels] = useState<HostelView[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const res = await fetch('/api/super-admin/hostel/reports', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`)
        const data = await res.json()
        if (!cancelled) setHostels(data.hostels || [])
      } catch (err: any) {
        console.error('Failed to fetch hostel reports', err)
        if (!cancelled) setError(err.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const totalHostels = hostels ? hostels.length : 0
  const totalStudents = hostels ? hostels.reduce((s, h) => s + (h.totalStudents || 0), 0) : 0
  const totalBeds = hostels ? hostels.reduce((s, h) => s + (h.totalBeds || 0), 0) : 0
  const totalOccupied = hostels ? hostels.reduce((s, h) => s + (h.occupiedBeds || 0), 0) : 0
  const avgOccupancy = hostels && hostels.length ? Math.round((totalOccupied / Math.max(1, totalBeds)) * 100) : 0

  const capacityData = (hostels || []).map((h) => ({ name: h.name, capacity: h.capacity, occupied: h.occupiedBeds }))

  const occupancyTrendData = [
    { month: 'Jan', occupancy: 85 },
    { month: 'Feb', occupancy: 87 },
    { month: 'Mar', occupancy: 89 },
    { month: 'Apr', occupancy: 91 },
    { month: 'May', occupancy: 92 },
    { month: 'Jun', occupancy: 93 },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Hostel Reports</h2>
        <p className="text-sm text-muted-foreground">Comprehensive hostel analytics and statistics</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Hostels</p>
                <p className="text-3xl font-bold text-foreground mt-2">{loading ? '—' : totalHostels}</p>
              </div>
              <Home className="w-8 h-8 text-cyan-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-3xl font-bold text-foreground mt-2">{loading ? '—' : totalStudents}</p>
              </div>
              <Users className="w-8 h-8 text-cyan-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Beds</p>
                <p className="text-3xl font-bold text-foreground mt-2">{loading ? '—' : totalBeds}</p>
              </div>
              <Home className="w-8 h-8 text-cyan-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Occupancy</p>
                <p className="text-3xl font-bold text-foreground mt-2">{loading ? '—' : `${avgOccupancy}%`}</p>
              </div>
              <Shield className="w-8 h-8 text-cyan-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-cyan-400">Room Capacity vs Occupancy</CardTitle>
            <CardDescription>Bed utilization across hostels</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={capacityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                <Legend />
                <Bar dataKey="capacity" fill="#64748b" name="Total Capacity" />
                <Bar dataKey="occupied" fill="#00d4ff" name="Occupied" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-cyan-400">Occupancy Trend</CardTitle>
            <CardDescription>Monthly occupancy rate</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={occupancyTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                <Line type="monotone" dataKey="occupancy" stroke="#00d4ff" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Hostel Report Table */}
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-cyan-400">Detailed Hostel Report</CardTitle>
          <CardDescription>Complete hostel information with rooms and beds</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {error && <div className="text-red-400 mb-4">Error: {error}</div>}
            <table className="w-full text-sm">
              <thead>
                  <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-cyan-400 font-semibold">Hostel</th>
                  <th className="text-left py-3 px-4 text-cyan-400 font-semibold">Rooms</th>
                  <th className="text-left py-3 px-4 text-cyan-400 font-semibold">Beds</th>
                  <th className="text-left py-3 px-4 text-cyan-400 font-semibold">Occupied</th>
                  <th className="text-left py-3 px-4 text-cyan-400 font-semibold">Available</th>
                  <th className="text-left py-3 px-4 text-cyan-400 font-semibold">Students</th>
                  <th className="text-left py-3 px-4 text-cyan-400 font-semibold">Staff</th>
                  <th className="text-left py-3 px-4 text-cyan-400 font-semibold">Admin</th>
                  <th className="text-left py-3 px-4 text-cyan-400 font-semibold">Contact</th>
                  <th className="text-left py-3 px-4 text-cyan-400 font-semibold">License</th>
                </tr>
              </thead>
              <tbody>
                {(hostels || []).map((hostel) => (
                  <tr key={hostel._id} className="border-b border-border hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 text-foreground font-medium">{hostel.name}</td>
                    <td className="py-3 px-4 text-cyan-400">{hostel.totalRooms ?? hostel.rooms.length}</td>
                    <td className="py-3 px-4 text-cyan-400">{hostel.totalBeds}</td>
                    <td className="py-3 px-4 text-cyan-400">{hostel.occupiedBeds}</td>
                    <td className="py-3 px-4 text-cyan-400">{hostel.availableBeds}</td>
                    <td className="py-3 px-4 text-cyan-400">{hostel.totalStudents}</td>
                    <td className="py-3 px-4 text-cyan-400">
                      <div className="text-xs">
                        <p className="text-cyan-400 font-medium">{hostel.staffCount ?? 0}</p>
                        {hostel.staffRoles && Object.keys(hostel.staffRoles).length > 0 && (
                          <p className="text-cyan-400 text-xs">
                            {Object.entries(hostel.staffRoles)
                              .map(([role, cnt]) => `${role}: ${cnt}`)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs">
                        <p className="text-foreground font-medium">{hostel.adminName || '—'}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      <div className="text-xs">
                        <p>{hostel.contactEmail || '—'}</p>
                        <p>{hostel.contactPhone || '—'}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs">
                        <p className="text-foreground">{hostel.licenseExpiry || '—'}</p>
                        {/* No license status computed here; keep simple */}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Per-hostel room breakdown removed as requested */}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
