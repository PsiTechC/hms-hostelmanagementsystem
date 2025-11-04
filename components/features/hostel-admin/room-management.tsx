"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Edit2, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'

export function RoomManagement() {
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Modal / form state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<any | null>(null)
  const [newRoomNumber, setNewRoomNumber] = useState("")
  const [newRoomName, setNewRoomName] = useState("")
  const [newCapacity, setNewCapacity] = useState<number>(1)
  const [bedNumbers, setBedNumbers] = useState<string[]>([])

  // keep bedNumbers in sync with capacity
  useEffect(() => {
    setBedNumbers((prev) => {
      const next = Array.from({ length: newCapacity }, (_, i) => prev[i] ?? String(i + 1))
      return next
    })
  }, [newCapacity])

  // load rooms from server
  async function loadRooms() {
    setLoading(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/hostel-admin/rooms', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      if (!res.ok) throw new Error('Failed to load rooms')
      const data = await res.json()
      setRooms(data.rooms || [])
    } catch (e) {
      console.error('Failed to load rooms', e)
      setRooms([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRooms() }, [])

  function handleBedNumberChange(index: number, value: string) {
    setBedNumbers((prev) => {
      const copy = [...prev]
      copy[index] = value
      return copy
    })
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newRoomNumber) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const payload = {
      number: newRoomNumber,
      name: newRoomName,
      capacity: newCapacity,
      beds: bedNumbers.map((bn) => ({ number: bn, status: 'vacant' })),
    }
    try {
      if (editingRoom && editingRoom._id) {
        const res = await fetch(`/api/hostel-admin/rooms/${editingRoom._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to update room')
      } else {
        const res = await fetch('/api/hostel-admin/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create room')
      }
      // reload list
      await loadRooms()
      // close modal and reset
      setModalOpen(false)
      setEditingRoom(null)
      setNewRoomNumber('')
      setNewRoomName('')
      setNewCapacity(1)
      setBedNumbers([])
    } catch (err) {
      console.error('Room save error', err)
      // TODO: show UI error
    }
  }

  async function handleDeleteRoom(room: any) {
    if (!confirm('Delete this room?')) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    try {
      const res = await fetch(`/api/hostel-admin/rooms/${room._id || room.id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      if (!res.ok) throw new Error('Failed to delete')
      await loadRooms()
    } catch (err) {
      console.error('Delete room failed', err)
    }
  }

  function openAddModal() {
    setEditingRoom(null)
    setNewRoomNumber('')
    setNewRoomName('')
    setNewCapacity(1)
    setBedNumbers([])
    setModalOpen(true)
  }

  function openEditModal(room: any) {
    setEditingRoom(room)
    setNewRoomNumber(room.number)
    setNewRoomName(room.name || '')
    setNewCapacity(room.capacity ?? (room.beds ? room.beds.length : 1))
    setBedNumbers((room.beds || []).map((b: any) => b.number || ''))
    setModalOpen(true)
  }

  // Hostel limits from server
  const [hostelTotalRooms, setHostelTotalRooms] = useState<number | null>(null)
  const [hostelRoomsUnlimited, setHostelRoomsUnlimited] = useState<boolean | null>(null)
  const [hostelLoading, setHostelLoading] = useState(false)

  useEffect(() => {
    async function loadHostel() {
      setHostelLoading(true)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const res = await fetch('/api/hostel-admin/hostel', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (!res.ok) {
          setHostelTotalRooms(null)
          setHostelRoomsUnlimited(null)
          return
        }
        const data = await res.json()
        const h = data?.hostel
        setHostelTotalRooms(h?.totalRooms ?? h?.total_rooms ?? 0)
        setHostelRoomsUnlimited(!!h?.roomsUnlimited)
      } catch (e) {
        console.error('Failed to load hostel info', e)
        setHostelTotalRooms(null)
        setHostelRoomsUnlimited(null)
      } finally {
        setHostelLoading(false)
      }
    }
    loadHostel()
  }, [])

  // Derived counts
  const totals = useMemo(() => {
    const totalRooms = rooms.length
    let emptyRooms = 0
    let totalBeds = 0
    let occupiedBeds = 0
    for (const r of rooms) {
      const beds = (r.beds || []).length ? r.beds : Array.from({ length: r.capacity ?? 0 }, (_, i) => ({ number: String(i + 1), status: i < (r.occupied ?? 0) ? 'occupied' : 'vacant' }))
      const occ = (beds || []).filter((b: any) => b.status === 'occupied').length
      const cap = (r.capacity ?? beds.length ?? 0)
      totalBeds += cap
      occupiedBeds += occ
      if (occ < cap) emptyRooms += 1
    }
    return { totalRooms, emptyRooms, totalBeds, occupiedBeds }
  }, [rooms])

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Room Management</h2>
          <p className="text-sm text-muted-foreground">Create and manage rooms and beds</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            <div>Total rooms: <span className="font-semibold text-foreground">{totals.totalRooms}</span></div>
            <div>Empty rooms: <span className="font-semibold text-foreground">{totals.emptyRooms}</span></div>
            <div>Beds: <span className="font-semibold text-foreground">{totals.occupiedBeds}/{totals.totalBeds}</span></div>
            <div>
              Max allowed: <span className="font-semibold text-foreground">{hostelLoading ? '…' : hostelRoomsUnlimited ? 'Unlimited' : (hostelTotalRooms ?? '—')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button className="bg-cyan-500 hover:bg-cyan-600 text-black flex items-center gap-2" onClick={openAddModal}>
              <Plus className="w-4 h-4" />
              Add Room
            </Button>
            <Dialog open={modalOpen} onOpenChange={(v) => setModalOpen(v)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingRoom ? 'Edit Room' : 'Add Room'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm text-muted-foreground">Room Number</label>
                    <input value={newRoomNumber} onChange={(e) => setNewRoomNumber(e.target.value)} required className="w-full px-3 py-2 bg-input border border-border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground">Room Name (optional)</label>
                    <input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} className="w-full px-3 py-2 bg-input border border-border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground">Number of Beds</label>
                    <input value={String(newCapacity)} onChange={(e) => setNewCapacity(Math.max(1, Number.parseInt(e.target.value || '1')))} type="number" min={1} className="w-full px-3 py-2 bg-input border border-border rounded" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Bed numbering</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Array.from({ length: newCapacity }).map((_, idx) => (
                        <input key={idx} value={bedNumbers[idx] ?? String(idx + 1)} onChange={(e) => handleBedNumberChange(idx, e.target.value)} className="px-3 py-2 bg-input border border-border rounded" />
                      ))}
                    </div>
                  </div>
                  <DialogFooter>
                    <div className="flex gap-2 justify-end w-full">
                      <DialogClose asChild>
                        <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                      </DialogClose>
                      <Button type="submit" className="bg-cyan-500 hover:bg-cyan-600 text-black">{editingRoom ? 'Save Changes' : 'Add Room'}</Button>
                    </div>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Add-room inline form was removed in favor of the modal dialog above. */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map((room) => (
          <Card key={room._id ?? room.id} className="border-border bg-card/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Room {room.number}</h3>
                  <p className="text-sm text-muted-foreground">
                    {room.occupied}/{room.capacity} occupied
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="border-border bg-transparent" onClick={() => openEditModal(room)} title="Edit room">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="border-border hover:bg-red-500/20 bg-transparent" onClick={() => handleDeleteRoom(room)} title="Delete room">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className={`space-y-2 ${(room.beds && room.beds.length > 4) || (room.capacity ?? 0) > 4 ? 'max-h-[175px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-cyan-500/50 scrollbar-track-transparent' : ''}`}>
                {(room.beds && room.beds.length ? room.beds : Array.from({ length: room.capacity ?? 0 }, (_, i) => ({ number: String(i + 1), status: i < (room.occupied ?? 0) ? 'occupied' : 'vacant' }))).map((b: any, idx: number) => (
                  <div
                    key={b.number ?? idx}
                    className={`p-2 rounded text-sm ${
                      (b.status === 'occupied') ? "bg-green-500/20 text-green-400" : "bg-slate-700/50 text-slate-400"
                    }`}
                  >
                    Bed {b.number}: {b.status === 'occupied' ? "Occupied" : "Vacant"}
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
