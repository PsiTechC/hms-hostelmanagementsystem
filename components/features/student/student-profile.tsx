"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Mail, Phone, GraduationCap, Building2, Bed, FileText, Users, Calendar, Shield, MapPin, Lock, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"

export function StudentProfile() {
  const [profileData, setProfileData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      setError(null)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined

        const res = await fetch('/api/student/profile', { headers })
        const data = await res.json()

        if (!res.ok) throw new Error(data?.error || 'Failed to load profile')

        setProfileData(data)
      } catch (e: any) {
        console.error('Failed to load profile', e)
        setError(e?.message || 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  // Handle password change
  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match')
      return
    }

    setPasswordLoading(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/student/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setPasswordError(data?.error || 'Failed to change password')
      } else {
        setPasswordSuccess('Password changed successfully!')
        // Clear form
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (e) {
      console.error('Password change failed', e)
      setPasswordError('Network error. Please try again.')
    } finally {
      setPasswordLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">Loading profile...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-400">{error}</div>
      </div>
    )
  }

  if (!profileData) {
    return null
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Profile</h2>
          <p className="text-sm text-muted-foreground">View your complete profile information</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-cyan-400 flex items-center gap-2">
              <User className="w-5 h-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profileData.documents.photoUrl && (
              <div className="flex justify-center mb-4">
                <img
                  src={profileData.documents.photoUrl}
                  alt="Profile"
                  className="w-32 h-32 rounded-lg object-cover border-2 border-cyan-500/50 shadow-lg"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Full Name</p>
                <p className="text-sm font-semibold text-foreground">{profileData.personalInfo.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Student ID</p>
                <p className="text-sm font-semibold text-foreground">{profileData.personalInfo.studentId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">User ID</p>
                <p className="text-sm font-semibold text-foreground">{profileData.personalInfo.userId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Email</p>
                <p className="text-sm font-semibold text-foreground break-all">{profileData.personalInfo.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Phone</p>
                <p className="text-sm font-semibold text-foreground">{profileData.personalInfo.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Emergency Contact</p>
                <p className="text-sm font-semibold text-foreground">{profileData.personalInfo.emergencyContact || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Academic Information */}
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-cyan-400 flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Academic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Course</p>
                <p className="text-sm font-semibold text-foreground">{profileData.academicInfo.course || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Year</p>
                <p className="text-sm font-semibold text-foreground">{profileData.academicInfo.year || 'N/A'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Department</p>
                <p className="text-sm font-semibold text-foreground">{profileData.academicInfo.department || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hostel Information */}
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-cyan-400 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Hostel Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Hostel</p>
                <p className="text-sm font-semibold text-foreground">{profileData.hostelInfo.hostelName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Room Number</p>
                <p className="text-sm font-semibold text-foreground">{profileData.hostelInfo.roomNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Bed Number</p>
                <p className="text-sm font-semibold text-foreground">{profileData.hostelInfo.bedNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Room Capacity</p>
                <p className="text-sm font-semibold text-foreground">{profileData.hostelInfo.roomCapacity} Beds</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Floor</p>
                <p className="text-sm font-semibold text-foreground">{profileData.hostelInfo.floor}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Guardian Information */}
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-cyan-400 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Guardian Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Guardian Name</p>
                <p className="text-sm font-semibold text-foreground">{profileData.guardianInfo.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Primary Phone</p>
                <p className="text-sm font-semibold text-foreground">{profileData.guardianInfo.primaryPhone}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">WhatsApp Phone</p>
                <p className="text-sm font-semibold text-foreground">{profileData.guardianInfo.whatsappPhone}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Relationship</p>
                <p className="text-sm font-semibold text-foreground capitalize">{profileData.guardianInfo.relationship}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Notification Preference</p>
                <p className="text-sm font-semibold text-foreground capitalize">{profileData.guardianInfo.notificationPreference}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-cyan-400 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Government ID Type</p>
                <p className="text-sm font-semibold text-foreground">{profileData.documents.govIdType}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Government ID Number</p>
                <p className="text-sm font-semibold text-foreground">{profileData.documents.govIdValue}</p>
              </div>
              {profileData.documents.govIdFiles && profileData.documents.govIdFiles.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Government ID Files</p>
                  <div className="space-y-2">
                    {profileData.documents.govIdFiles.map((file: any, idx: number) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        {file.filename}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Allocation History */}
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-cyan-400 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Room Allocation History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profileData.allocationHistory && profileData.allocationHistory.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {profileData.allocationHistory.map((entry: any, idx: number) => (
                  <div key={idx} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-foreground">
                          Room {entry.roomNumber} • Bed {entry.bedNumber}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Allocated: {new Date(entry.allocatedAt).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                        {entry.deallocatedAt && (
                          <p className="text-xs text-orange-400 mt-1">
                            Deallocated: {new Date(entry.deallocatedAt).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        )}
                      </div>
                      {!entry.deallocatedAt && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                          Current
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No allocation history available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Account Information */}
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-cyan-400 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Account Created</p>
              <p className="text-sm font-semibold text-foreground">
                {new Date(profileData.accountInfo.createdAt).toLocaleString('en-IN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Last Updated</p>
              <p className="text-sm font-semibold text-foreground">
                {new Date(profileData.accountInfo.updatedAt).toLocaleString('en-IN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-cyan-400 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-sm">
            {/* Current Password */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-foreground text-sm pr-10"
                  placeholder="Enter current password"
                  disabled={passwordLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-foreground text-sm pr-10"
                  placeholder="Enter new password (min 8 characters)"
                  disabled={passwordLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-foreground text-sm pr-10"
                  placeholder="Confirm new password"
                  disabled={passwordLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {passwordError && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-sm text-red-400">
                {passwordError}
              </div>
            )}

            {/* Success Message */}
            {passwordSuccess && (
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-3 text-sm text-green-400">
                {passwordSuccess}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
              disabled={passwordLoading}
            >
              {passwordLoading ? 'Changing Password...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
