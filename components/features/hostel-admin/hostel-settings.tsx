"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Save, Eye, EyeOff } from "lucide-react"

type Hostel = {
  _id: string
  name?: string
  address?: string
  capacity?: number
  totalRooms?: number
  nightInTime?: string
  licenseExpiry?: number
  contactEmail?: string
}

export function HostelSettings() {
  const [hostel, setHostel] = useState<Hostel | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMessage, setPwMessage] = useState<string | null>(null)
  const [curfew, setCurfew] = useState<string>('')
  const [curfewSaving, setCurfewSaving] = useState(false)
  const [curfewMessage, setCurfewMessage] = useState<string | null>(null)

  // Password visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const res = await fetch('/api/hostel-admin/hostel', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        const data = await res.json()
        if (!res.ok) {
          setErr(data?.error || 'Failed to load')
          setHostel(null)
        } else {
          setHostel(data.hostel)
          // populate curfew input from DB value
          setCurfew(data.hostel?.nightInTime ?? '')
        }
      } catch (e) {
        console.error('Fetch hostel failed', e)
        setErr('Network error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleChangePassword() {
    setPwMessage(null)
    if (!currentPassword || !newPassword) {
      setPwMessage('Please fill all fields')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMessage('New password and confirmation do not match')
      return
    }
    setPwLoading(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/hostel-admin/hostel/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPwMessage(data?.error || 'Failed to change password')
      } else {
        setPwMessage('Password changed successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (e) {
      console.error('Change password request failed', e)
      setPwMessage('Network error')
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Hostel Settings</h2>
        <p className="text-sm text-muted-foreground">Configure hostel parameters</p>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading hostel data…</div>}
      {err && <div className="text-sm text-red-400">{err}</div>}

      {!loading && hostel && (
        <div className="grid gap-6">
          <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-cyan-400">Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Hostel Name</label>
                  <input
                    type="text"
                    value={hostel.name || ''}
                    readOnly
                    className="w-full mt-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-foreground"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Location</label>
                  <input
                    type="text"
                    value={hostel.address || ''}
                    readOnly
                    className="w-full mt-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-foreground"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Total Capacity</label>
                  <input
                    type="number"
                    value={(hostel.capacity ?? 0).toString()}
                    readOnly
                    className="w-full mt-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-foreground"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Total Rooms</label>
                  <input
                    type="number"
                    value={(hostel.totalRooms ?? 0).toString()}
                    readOnly
                    className="w-full mt-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-foreground"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">License Expiry</label>
                  <input
                    type="date"
                    value={(hostel.licenseExpiry ?? 0).toString()}
                    readOnly
                    className="w-full mt-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-foreground"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm text-muted-foreground">Night-In / Curfew Time</label>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="time"
                      value={curfew}
                      onChange={(e) => setCurfew(e.target.value)}
                      className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-foreground"
                    />
                    <Button className="bg-cyan-500 hover:bg-cyan-600 text-black" onClick={async () => {
                      setCurfewMessage(null)
                      setCurfewSaving(true)
                      try {
                        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
                        const res = await fetch('/api/hostel-admin/hostel', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                          body: JSON.stringify({ nightInTime: curfew }),
                        })
                        const data = await res.json()
                        if (!res.ok) {
                          setCurfewMessage(data?.error || 'Failed to save')
                        } else {
                          setCurfewMessage('Saved')
                          setHostel(data.hostel)
                        }
                      } catch (e) {
                        console.error('Save curfew failed', e)
                        setCurfewMessage('Network error')
                      } finally {
                        setCurfewSaving(false)
                      }
                    }} disabled={curfewSaving}>{curfewSaving ? 'Saving…' : 'Save'}</Button>
                  </div>
                  {curfewMessage && <div className="text-sm text-muted-foreground mt-2">{curfewMessage}</div>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-cyan-400">Change Password</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full mt-2 px-4 py-2 pr-12 bg-slate-800 border border-slate-700 rounded-lg text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 mt-1 text-muted-foreground hover:text-cyan-400 transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full mt-2 px-4 py-2 pr-12 bg-slate-800 border border-slate-700 rounded-lg text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 mt-1 text-muted-foreground hover:text-cyan-400 transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full mt-2 px-4 py-2 pr-12 bg-slate-800 border border-slate-700 rounded-lg text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 mt-1 text-muted-foreground hover:text-cyan-400 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  {pwMessage && <div className="text-sm text-muted-foreground mb-2">{pwMessage}</div>}

                  <div className="flex gap-2">
                    <Button
                      className="bg-cyan-500 hover:bg-cyan-600 text-black flex items-center gap-2"
                      onClick={handleChangePassword}
                      disabled={pwLoading}
                    >
                      <Save className="w-4 h-4" />
                      {pwLoading ? 'Saving…' : 'Change Password'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
