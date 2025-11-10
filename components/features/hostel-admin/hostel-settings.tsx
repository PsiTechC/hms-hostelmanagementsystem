"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Save, Eye, EyeOff } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

type Hostel = {
  _id: string
  name?: string
  address?: string
  capacity?: number
  totalRooms?: number
  nightInTime?: string
  licenseExpiry?: number
  contactEmail?: string
  autoSendMode?: 'frontend' | 'backend' | 'disabled'
  autoSendEnabled?: boolean
  lastAutoSendCheck?: string
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

  // Auto-send WhatsApp state
  const [autoSendEnabled, setAutoSendEnabled] = useState(false)
  const [autoSendMode, setAutoSendMode] = useState<'frontend' | 'backend' | 'disabled'>('frontend')
  const [autoSendSaving, setAutoSendSaving] = useState(false)
  const [autoSendMessage, setAutoSendMessage] = useState<string | null>(null)

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
          // populate auto-send settings
          setAutoSendEnabled(data.hostel?.autoSendEnabled ?? false)
          setAutoSendMode(data.hostel?.autoSendMode ?? 'frontend')
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

  async function handleAutoSendToggle(enabled: boolean) {
    setAutoSendEnabled(enabled)
    await saveAutoSendSettings(enabled, autoSendMode)
  }

  async function handleAutoSendModeChange(mode: 'frontend' | 'backend' | 'disabled') {
    setAutoSendMode(mode)
    await saveAutoSendSettings(autoSendEnabled, mode)
  }

  async function saveAutoSendSettings(enabled: boolean, mode: 'frontend' | 'backend' | 'disabled') {
    setAutoSendMessage(null)
    setAutoSendSaving(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/warden/auto-send-toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ enabled, mode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAutoSendMessage(data?.error || 'Failed to save auto-send settings')
        // Revert on error
        setAutoSendEnabled(!enabled)
        setAutoSendMode(mode === 'frontend' ? 'backend' : 'frontend')
      } else {
        setAutoSendMessage('Auto-send settings saved successfully')
        // Update hostel state
        if (hostel) {
          setHostel({ ...hostel, autoSendEnabled: data.autoSendEnabled, autoSendMode: data.autoSendMode })
        }
        // Clear success message after 3 seconds
        setTimeout(() => setAutoSendMessage(null), 3000)
      }
    } catch (e) {
      console.error('Save auto-send settings failed', e)
      setAutoSendMessage('Network error')
    } finally {
      setAutoSendSaving(false)
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
              <CardTitle className="text-cyan-400">Auto-Send WhatsApp Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-send-toggle" className="text-base">Enable Auto-Send</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically send WhatsApp alerts to guardians when students check in late
                    </p>
                  </div>
                  <Switch
                    id="auto-send-toggle"
                    checked={autoSendEnabled}
                    onCheckedChange={handleAutoSendToggle}
                    disabled={autoSendSaving}
                  />
                </div>

                {autoSendEnabled && (
                  <div className="space-y-4 pt-4 border-t border-slate-700">
                    <div>
                      <Label className="text-base mb-3 block">Operation Mode</Label>
                      <div className="space-y-3">
                        <div
                          className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                            autoSendMode === 'frontend'
                              ? 'border-yellow-500 bg-yellow-500/10'
                              : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                          }`}
                          onClick={() => handleAutoSendModeChange('frontend')}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="autoSendMode"
                              value="frontend"
                              checked={autoSendMode === 'frontend'}
                              onChange={(e) => handleAutoSendModeChange(e.target.value as any)}
                              className="mt-1"
                              disabled={autoSendSaving}
                            />
                            <div className="flex-1">
                              <div className="font-medium text-foreground">Frontend Mode (Page-based)</div>
                              <p className="text-sm text-muted-foreground mt-1">
                                Auto-send works only when warden has the attendance monitoring page open.
                                Stops when page closes, browser closes, or logout.
                              </p>
                              <div className="mt-2 text-xs text-yellow-400">
                                ⚠️ Requires page to stay open • 
                              </div>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                            autoSendMode === 'backend'
                              ? 'border-green-500 bg-green-500/10'
                              : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                          }`}
                          onClick={() => handleAutoSendModeChange('backend')}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="autoSendMode"
                              value="backend"
                              checked={autoSendMode === 'backend'}
                              onChange={(e) => handleAutoSendModeChange(e.target.value as any)}
                              className="mt-1"
                              disabled={autoSendSaving}
                            />
                            <div className="flex-1">
                              <div className="font-medium text-foreground">Backend Mode (24/7 Server-side)</div>
                              <p className="text-sm text-muted-foreground mt-1">
                                Auto-send works 24/7 independently on the server.
                                Continues even when warden is offline, browser closed, or logged out.
                              </p>
                              <div className="mt-2 text-xs text-green-400">
                                ✓ Runs independently 24/7 • Get Live updates even if computer is off •
                              </div>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                            autoSendMode === 'disabled'
                              ? 'border-red-500 bg-red-500/10'
                              : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                          }`}
                          onClick={() => handleAutoSendModeChange('disabled')}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="autoSendMode"
                              value="disabled"
                              checked={autoSendMode === 'disabled'}
                              onChange={(e) => handleAutoSendModeChange(e.target.value as any)}
                              className="mt-1"
                              disabled={autoSendSaving}
                            />
                            <div className="flex-1">
                              <div className="font-medium text-foreground">Disabled (Manual Only)</div>
                              <p className="text-sm text-muted-foreground mt-1">
                                Auto-send completely disabled. WhatsApp alerts can only be sent manually via the "Send WhatsApp Alerts" button.
                              </p>
                              <div className="mt-2 text-xs text-muted-foreground">
                                Manual control only
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* {autoSendMode === 'backend' && (
                      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                        <div className="text-sm font-medium text-blue-400 mb-2">⚙️ Backend Mode Setup Required</div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Backend mode requires a cron job to be set up. Please follow the setup instructions in the documentation.
                        </p>
                        <a
                          href="/AUTO_SEND_SETUP.md"
                          target="_blank"
                          className="text-sm text-blue-400 hover:text-blue-300 underline"
                        >
                          View Setup Guide →
                        </a>
                      </div>
                    )} */}

                    {hostel?.lastAutoSendCheck && (
                      <div className="text-xs text-muted-foreground">
                        Last auto-send check: {new Date(hostel.lastAutoSendCheck).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {autoSendMessage && (
                  <div className={`text-sm p-3 rounded-lg ${
                    autoSendMessage.includes('success')
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {autoSendMessage}
                  </div>
                )}
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
