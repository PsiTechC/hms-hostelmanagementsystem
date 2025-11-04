"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { Users, Building2, Fingerprint, AlertCircle, Activity } from "lucide-react"
import { HostelManagement } from "@/components/features/super-admin/hostel-management"
//import { UserManagement } from "@/components/features/super-admin/user-management"
import { HostelReports } from "@/components/features/super-admin/hostel-reports"
import { useState, useEffect} from "react"
interface SuperAdminDashboardProps {
  activeSection: string
}

export function SuperAdminDashboard({ activeSection }: SuperAdminDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [totals, setTotals] = useState({ hostels: 0, students: 0, devices: 0 })
  const [hostelData, setHostelData] = useState<{ name: string; students: number }[]>([])
  const [systemHealth, setSystemHealth] = useState<any>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const headers: any = {}
        if (token) headers.Authorization = `Bearer ${token}`
        const res = await fetch('/api/super-admin/dashboard', { headers })
        if (!res.ok) throw new Error('Failed to load dashboard')
        const json = await res.json()
        if (!mounted) return
        setTotals(json.totals || { hostels: 0, students: 0, devices: 0 })
        setHostelData(json.hostelDistribution || [])
        setSystemHealth(json.systemHealth || null)
      } catch (err) {
        console.error('Dashboard load error', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const stats = [
    { label: 'Total Hostels', value: String(totals.hostels || 0), icon: Building2, color: 'from-blue-500 to-cyan-500' },
    { label: 'Total Students', value: String(totals.students || 0), icon: Users, color: 'from-purple-500 to-pink-500' },
    { label: 'Active Devices', value: String(totals.devices || 0), icon: Fingerprint, color: 'from-green-500 to-emerald-500' },
    { label: 'System Alerts', value: '—', icon: AlertCircle, color: 'from-orange-500 to-red-500' },
  ]

  const attendanceData = [] as any[]

  const deviceStatus = [
    { name: 'Operational', value: totals.devices || 0, color: '#00d4ff' },
    { name: 'Maintenance', value: 0, color: '#fbbf24' },
    { name: 'Offline', value: 0, color: '#ef4444' },
  ]

  if (activeSection === "hostels") {
    return <HostelManagement />
  }

  // if (activeSection === "users") {
  //   return <UserManagement />
  // }

  if (activeSection === "reports") {
    return <HostelReports />
  }

  if (activeSection === "overview") {
    return (
      <div className="p-6 space-y-6">
        {/* Stats Grid */}
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

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Trend */}
          <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-cyan-400">Weekly Attendance Trend</CardTitle>
              <CardDescription>Student presence tracking</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke="#00d4ff" strokeWidth={2} />
                  <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Hostel Distribution */}
          <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-cyan-400">Hostel Distribution</CardTitle>
              <CardDescription>Students per hostel</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hostelData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} />
                  <Bar dataKey="students" fill="#00d4ff" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Device Status & System Health */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-cyan-400">Device Status</CardTitle>
              <CardDescription>Biometric device health</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={deviceStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {deviceStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-cyan-400">System Health</CardTitle>
              <CardDescription>Real-time monitoring</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-2">
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <span className="text-sm text-slate-300">API Roundtrip (approx)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-cyan-400">{systemHealth ? `${systemHealth.approxDbRoundtripMs} ms` : '—'}</span>
                    <Activity className="w-4 h-4 text-green-400" />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <span className="text-sm text-slate-300">DB Connections</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-cyan-400">{systemHealth?.dbStatus?.connections?.current ?? '—'}</span>
                    <Activity className="w-4 h-4 text-green-400" />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <span className="text-sm text-slate-300">DB Opcounters (total)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-cyan-400">{systemHealth?.dbStatus?.opcounters ? Object.values(systemHealth.dbStatus.opcounters).reduce((a: number, b: any) => a + (Number(b) || 0), 0) : '—'}</span>
                    <Activity className="w-4 h-4 text-green-400" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-cyan-400">{activeSection.replace("-", " ").toUpperCase()}</CardTitle>
          <CardDescription>Section content coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">This section is under development.</p>
        </CardContent>
      </Card>
    </div>
  )
}
