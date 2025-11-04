"use client"

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import HostelForm from './hostel-form'

export function AddHostelPage({ hostelId, onBack, onSaved }: { hostelId?: string; onBack?: () => void; onSaved?: () => void }) {
  const [initialData, setInitialData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!hostelId) return
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const headers: any = {}
        if (token) headers.Authorization = `Bearer ${token}`
        // try to fetch single hostel; fallback to list if single endpoint missing
        let res = await fetch(`/api/super-admin/hostel/${hostelId}`, { headers })
        if (!res.ok) {
          // fallback to list and filter
          res = await fetch('/api/super-admin/hostel', { headers })
        }
        const json = await res.json()
        let doc = null
        if (json) {
          if (json.hostel) doc = json.hostel
          else if (Array.isArray(json)) doc = json.find((h: any) => String(h._id || h.id) === String(hostelId))
          else if (json.hostels) doc = (Array.isArray(json.hostels) ? json.hostels.find((h: any) => String(h._id || h.id) === String(hostelId)) : null)
        }
        if (mounted && doc) setInitialData(doc)
      } catch (e) {
        console.error('Failed to load hostel for edit', e)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [hostelId])

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">{hostelId ? 'Edit Hostel' : 'Add Hostel'}</h2>
            <p className="text-sm text-muted-foreground">Create or edit hostel details</p>
          </div>
          <div>
            <Button variant="outline" onClick={() => { if (onBack) onBack() }}>Back</Button>
          </div>
        </div>

        <Card className="border-border bg-card/50 backdrop-blur-sm">
          <CardContent>
            {/* pass initialData to HostelForm; HostelForm already handles create & edit */}
            <HostelForm initialData={initialData || undefined} onSuccess={() => { if (onSaved) onSaved() }} onCancel={() => { if (onBack) onBack() }} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default AddHostelPage
