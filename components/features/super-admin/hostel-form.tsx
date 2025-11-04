"use client"

import React, { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Props = {
  onSuccess?: () => void
  onCancel?: () => void
  initialData?: any
}

export default function HostelForm({ onSuccess, onCancel, initialData }: Props) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    capacity: '',
    totalRooms: '',
    adminName: '',
    contactEmail: '',
    contactPhone: '',
    licenseExpiry: '',
  })

  // Default to 'No limit' as requested
  const [roomsUnlimited, setRoomsUnlimited] = useState(true)
  const [capacityUnlimited, setCapacityUnlimited] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // helpers: convert between display DD-MM-YYYY and ISO YYYY-MM-DD
  function isoToDisplay(iso?: string) {
    if (!iso) return ''
    // accept YYYY-MM-DD or full ISO
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/) 
    if (!m) return String(iso)
    const [, y, mm, d] = m
    return `${d}-${mm}-${y}`
  }

  function displayToIso(display?: string) {
    if (!display) return ''
    const parts = String(display).trim().split(/[-\/]/)
    if (parts.length !== 3) return ''
    const [dStr, mStr, yStr] = parts
    const d = parseInt(dStr, 10)
    const m = parseInt(mStr, 10)
    const y = parseInt(yStr, 10)
    if ([d, m, y].some((n) => !isFinite(n))) return ''
    // basic ranges
    if (y < 1900 || m < 1 || m > 12 || d < 1) return ''
    const dt = new Date(y, m - 1, d)
    if (dt.getFullYear() !== y || dt.getMonth() + 1 !== m || dt.getDate() !== d) return ''
    const mm = String(m).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    return `${y}-${mm}-${dd}`
  }

  // If initial data is provided, populate the form initially and default
  // the 'No limit' checkboxes accordingly and init the picker
  React.useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        address: initialData.address || '',
        capacity: initialData.capacity != null ? String(initialData.capacity) : '',
        totalRooms: initialData.totalRooms != null ? String(initialData.totalRooms) : '',
        adminName: initialData.adminName || '',
        contactEmail: initialData.contactEmail || '',
        contactPhone: initialData.contactPhone || '',
        licenseExpiry: isoToDisplay(initialData.licenseExpiry || ''),
      })
  setRoomsUnlimited(!!initialData.roomsUnlimited)
  setCapacityUnlimited(!!initialData.capacityUnlimited)
      // initialize dropdown picker from existing ISO value
    //   if (initialData.licenseExpiry) {
    //     const parts = String(initialData.licenseExpiry).split('-').map((s) => parseInt(s, 10))
    //     if (parts.length === 3 && !parts.some(isNaN)) {
    //       setPickerYear(parts[0])
    //       setPickerMonth(parts[1])
    //       setPickerDay(parts[2])
    //     }
    //   }
    }
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const payload: any = {
      name: formData.name,
      address: formData.address,
      adminName: formData.adminName,
      contactEmail: formData.contactEmail,
      contactPhone: formData.contactPhone,
      // convert display DD-MM-YYYY to ISO YYYY-MM-DD for backend
      licenseExpiry: displayToIso(formData.licenseExpiry) || undefined,
      roomsUnlimited: !!roomsUnlimited,
      capacityUnlimited: !!capacityUnlimited,
    }
    if (!roomsUnlimited) {
      payload.totalRooms = Number.parseInt(formData.totalRooms || '0', 10)
    }
    if (!capacityUnlimited) {
      payload.capacity = Number.parseInt(formData.capacity || '0', 10)
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    try {
      let res: Response
      if (initialData && initialData._id) {
        // Edit existing
        res = await fetch(`/api/super-admin/hostel/${initialData._id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const txt = await res.text()
          throw new Error(txt || `Failed to update (${res.status})`)
        }
        if (onSuccess) onSuccess()
      } else {
        // Create new
        res = await fetch('/api/super-admin/hostel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const txt = await res.text()
          throw new Error(txt || `Failed to create (${res.status})`)
        }
        if (onSuccess) onSuccess()
      }
    } catch (err: any) {
      console.error('Hostel create error', err)
      setError(err?.message || 'Failed to create')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>{initialData ? 'Edit Hostel' : 'Create Hostel'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-input border border-border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Address</label>
                <input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Capacity</label>
                <input
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  type="number"
                  disabled={capacityUnlimited}
                  placeholder={capacityUnlimited ? 'No limit' : ''}
                  className="w-full px-3 py-2 bg-input border border-border rounded"
                />
                <div className="flex items-center gap-2 mt-2">
                  <input
                    id="capacityUnlimited"
                    type="checkbox"
                    checked={capacityUnlimited}
                    onChange={(e) => setCapacityUnlimited(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="capacityUnlimited" className="text-sm">No limit</label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Total Rooms</label>
                <input
                  value={formData.totalRooms}
                  onChange={(e) => setFormData({ ...formData, totalRooms: e.target.value })}
                  type="number"
                  disabled={roomsUnlimited}
                  placeholder={roomsUnlimited ? 'No limit' : ''}
                  className="w-full px-3 py-2 bg-input border border-border rounded"
                />
                <div className="flex items-center gap-2 mt-2">
                  <input
                    id="roomsUnlimited"
                    type="checkbox"
                    checked={roomsUnlimited}
                    onChange={(e) => setRoomsUnlimited(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="roomsUnlimited" className="text-sm">No limit</label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Admin Name</label>
                <input
                  value={formData.adminName}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Contact Email</label>
                <input
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  type="email"
                  className="w-full px-3 py-2 bg-input border border-border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Contact Phone</label>
                <input
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">License Expiry</label>
                <div>
                  <input
                    value={formData.licenseExpiry}
                    onChange={(e) => setFormData((f) => ({ ...f, licenseExpiry: e.target.value }))}
                    placeholder="DD-MM-YYYY"
                    className="w-full px-3 py-2 bg-input border border-border rounded"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Enter date as DD-MM-YYYY (will be saved as YYYY-MM-DD)</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="bg-cyan-500 hover:bg-cyan-600 text-black" disabled={loading}>
                {loading ? (initialData ? 'Saving...' : 'Creating...') : (initialData ? 'Save Changes' : 'Create Hostel')}
              </Button>
              <Button type="button" variant="outline" onClick={() => (onCancel ? onCancel() : null)}>
                Cancel
              </Button>
            </div>
            {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
