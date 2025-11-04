"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Edit2, Eye } from "lucide-react"

export function GuardianManagement() {
  const [guardians, setGuardians] = useState<Array<any>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadGuardians() {
      setLoading(true)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const res = await fetch('/api/staff/students', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const data = await res.json()
        if (!res.ok) {
          console.error('Failed to load students for guardians', data)
          setError(data?.error || 'Failed to load guardians')
          setGuardians([])
        } else {
          const students = data.students || []
          // Map students that have guardian information into guardian entries
          const mapped = students.map((s: any, idx: number) => ({
            id: idx,
            studentName: s.name || '—',
            studentId: s.user_id || s.studentId || '—',
            primaryGuardian: s.guardian?.name || '—',
            primaryPhone: s.guardian?.primaryPhone || '—',
            primaryWhatsApp: s.guardian?.whatsappPhone || '—',
            secondaryGuardian: s.guardian?.secondaryName || '—',
            secondaryPhone: s.guardian?.secondaryPhone || '—',
            secondaryWhatsApp: s.guardian?.secondaryWhatsApp || '—',
            relationship: s.guardian?.relationship || '—',
            language: s.guardian?.language || '—',
            notificationPreference: s.guardian?.notificationPreference || '—',
            rawStudent: s,
          }))
          setGuardians(mapped)
          setError(null)
        }
      } catch (e) {
        console.error('Failed to fetch guardians', e)
        setError('Network error')
        setGuardians([])
      } finally {
        setLoading(false)
      }
    }
    loadGuardians()
  }, [])

  const [selectedGuardian, setSelectedGuardian] = useState<(typeof guardians)[0] | null>(null)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Guardian Management</h2>
          <p className="text-sm text-muted-foreground">Manage guardian information and preferences</p>
        </div>
        {/* <Button className="bg-cyan-500 hover:bg-cyan-600 text-black flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Guardian
        </Button> */}
      </div>

      {selectedGuardian ? (
        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-cyan-400">{selectedGuardian.studentName}</h3>
              <Button
                variant="outline"
                size="sm"
                className="border-border bg-transparent"
                onClick={() => setSelectedGuardian(null)}
              >
                Back
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-bold text-cyan-400 mb-4">Primary Guardian</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-sm font-semibold text-foreground">{selectedGuardian.primaryGuardian}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-semibold text-foreground">{selectedGuardian.primaryPhone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">WhatsApp</p>
                    <p className="text-sm font-semibold text-cyan-400">{selectedGuardian.primaryWhatsApp}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-cyan-400 mb-4">Secondary Guardian</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-sm font-semibold text-foreground">{selectedGuardian.secondaryGuardian}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-semibold text-foreground">{selectedGuardian.secondaryPhone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">WhatsApp</p>
                    <p className="text-sm font-semibold text-cyan-400">{selectedGuardian.secondaryWhatsApp}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-cyan-400 mb-4">Preferences</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Relationship</p>
                    <p className="text-sm font-semibold text-foreground">{selectedGuardian.relationship}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Language</p>
                    <p className="text-sm font-semibold text-foreground">{selectedGuardian.language}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Notification Preference</p>
                    <p className="text-sm font-semibold text-cyan-400">{selectedGuardian.notificationPreference}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {guardians.map((guardian) => (
            <Card key={guardian.id} className="border-border bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-foreground">{guardian.studentName}</h3>
                    <p className="text-sm text-muted-foreground mb-3">ID: {guardian.studentId}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Primary Guardian</p>
                        <p className="text-sm font-semibold text-cyan-400">{guardian.primaryGuardian}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Primary Phone</p>
                        <p className="text-sm font-semibold text-cyan-400">{guardian.primaryPhone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Language</p>
                        <p className="text-sm font-semibold text-cyan-400">{guardian.language}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Notification</p>
                        <p className="text-sm font-semibold text-cyan-400">{guardian.notificationPreference}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border bg-transparent hover:bg-blue-500/20 hover:text-blue-400"
                      onClick={() => setSelectedGuardian(guardian)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {/* <Button variant="outline" size="sm" className="border-border bg-transparent">
                      <Edit2 className="w-4 h-4" />
                    </Button> */}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
