"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
// icons not needed here

type VacantRoom = { _id: string; number: string; name?: string; vacantBeds: string[] }

type InitialStudent = Partial<{
  _id: string
  name: string
  user_id: string
  email: string
  phone: string
  course: string
  year: string
  department: string
  photoUrl: string
  govIdType: string
  govIdValue: string
  govIdFiles: Array<{ filename?: string; url?: string; mime?: string; uploadedAt?: string | Date }>
  room: string
  bedNumber: string
  guardian: any
}>

export function AddStudentPage({ role = 'staff', onBack, onSaved, initialStudent, studentId }: { role?: string; onBack?: () => void; onSaved?: () => void; initialStudent?: InitialStudent; studentId?: string }) {
  const [form, setForm] = useState({
    photoUrl: '',
    userId: '',
    name: '',
    email: '',
    phone: '',
    course: '',
    year: '',
    department: '',
    govIdType: 'Aadhar Card',
    govIdValue: '',
    guardianName: '',
    guardianPhonePrimary: '',
    guardianPhoneWhatsApp: '',
    guardianRelationship: '',
    notificationPreference: 'both',
    roomId: '',
    bedNumber: '',
  })
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [govFiles, setGovFiles] = useState<File[]>([])
  const [existingGovFiles, setExistingGovFiles] = useState<Array<{ filename?: string; url?: string; mime?: string; uploadedAt?: string | Date }>>([])
  const [vacantRooms, setVacantRooms] = useState<VacantRoom[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadVacant() {
      setLoadingRooms(true)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        const res = await fetch('/api/staff/rooms/vacant', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const data = await res.json()
        setVacantRooms(data.rooms || [])
      } catch (e) {
        console.error('Failed to load vacant rooms', e)
        setVacantRooms([])
      } finally {
        setLoadingRooms(false)
      }
    }
    loadVacant()
  }, [])

  // populate initial values when editing
  useEffect(() => {
    if (initialStudent) {
      setForm((s) => ({
        ...s,
        userId: (initialStudent as any).user_id || s.userId,
        name: (initialStudent as any).name || s.name,
        email: (initialStudent as any).email || s.email,
        phone: (initialStudent as any).phone || s.phone,
        course: (initialStudent as any).course || s.course,
        year: (initialStudent as any).year || s.year,
        department: (initialStudent as any).department || s.department,
        govIdType: (initialStudent as any).govIdType || s.govIdType,
        govIdValue: (initialStudent as any).govIdValue || s.govIdValue,
        roomId: (initialStudent as any).room || s.roomId,
        bedNumber: (initialStudent as any).bedNumber || s.bedNumber,
        guardianName: (initialStudent as any).guardian?.name || s.guardianName,
        guardianPhonePrimary: (initialStudent as any).guardian?.primaryPhone || s.guardianPhonePrimary,
        guardianPhoneWhatsApp: (initialStudent as any).guardian?.whatsappPhone || s.guardianPhoneWhatsApp,
        guardianRelationship: (initialStudent as any).guardian?.relationship || s.guardianRelationship,
        notificationPreference: (initialStudent as any).guardian?.notificationPreference || s.notificationPreference,
      }))
      if ((initialStudent as any).photoUrl) setPhotoPreview((initialStudent as any).photoUrl)
      if ((initialStudent as any).govIdFiles) setExistingGovFiles((initialStudent as any).govIdFiles)
    }
  }, [initialStudent])

  function updateForm<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((s) => ({ ...s, [key]: value }))
  }

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  function onPhotoChange(f?: File) {
    if (!f) {
      setPhotoFile(null)
      setPhotoPreview(null)
      return
    }
    setPhotoFile(f)
    fileToDataUrl(f).then((d) => setPhotoPreview(d)).catch((e) => console.error(e))
  }

  function onGovFilesChange(list: FileList | null) {
    if (!list) { setGovFiles([]); return }
    const arr = Array.from(list)
    setGovFiles(arr)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      // prepare multipart FormData for file upload
      const formData = new FormData()
      formData.append('name', form.name)
      if (form.userId) formData.append('user_id', form.userId)
      if (form.email) formData.append('email', form.email)
      if (form.phone) formData.append('phone', form.phone)
      if (form.course) formData.append('course', form.course)
      if (form.year) formData.append('year', form.year)
      if (form.department) formData.append('department', form.department)
      formData.append('govIdType', form.govIdType)
      if (form.govIdValue) formData.append('govIdValue', form.govIdValue)
      if (form.guardianName) formData.append('guardianName', form.guardianName)
      if (form.guardianPhonePrimary) formData.append('guardianPhonePrimary', form.guardianPhonePrimary)
      if (form.guardianPhoneWhatsApp) formData.append('guardianPhoneWhatsApp', form.guardianPhoneWhatsApp)
      if (form.guardianRelationship) formData.append('guardianRelationship', form.guardianRelationship)
      if (form.notificationPreference) formData.append('notificationPreference', form.notificationPreference)
      if (form.roomId) formData.append('roomId', form.roomId)
      if (form.bedNumber) formData.append('bedNumber', form.bedNumber)
      if (photoFile) formData.append('photo', photoFile, photoFile.name)
      for (const f of govFiles) formData.append('govFiles', f, f.name)

      // determine endpoint & method: create (POST) or update (PATCH)
      const isEdit = Boolean(studentId)
      const url = isEdit ? `/api/staff/students/${studentId}` : '/api/staff/students'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }, // don't set Content-Type; browser will set multipart boundary
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data?.error || (isEdit ? 'Failed to update student' : 'Failed to create student'))
      } else {
        setMessage(isEdit ? 'Student updated' : 'Student added')
        if (onSaved) onSaved()
        // clear form
        setForm({ photoUrl: '', userId: '', name: '', email: '', phone: '', course: '', year: '', department: '', govIdType: 'Aadhar Card', govIdValue: '', guardianName: '', guardianPhonePrimary: '', guardianPhoneWhatsApp: '', guardianRelationship: '', notificationPreference: 'both', roomId: '', bedNumber: '' })
        setPhotoFile(null)
        setPhotoPreview(null)
        setGovFiles([])
        // optionally navigate back
        if (onBack) onBack()
      }
    } catch (e) {
      console.error('Create student failed', e)
      setMessage('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-6">
      <Card className="border-border bg-card/50 backdrop-blur-sm max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>{studentId ? 'Edit Student & Allocate Bed' : 'Add Student & Allocate Bed'}</CardTitle>
      </CardHeader>
         <div className="p-4">
           <Button variant="outline" onClick={() => { if (onBack) onBack() }}>
            Back
          </Button>
         </div>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground">Photo (jpg/png) — preview</label>
                <input type="file" accept="image/png,image/jpeg" onChange={(e) => onPhotoChange(e.target.files ? e.target.files[0] : undefined)} className="w-full" />
                <div className="mt-2">
                  <div className="w-32 h-32 bg-slate-800/10 rounded flex items-center justify-center overflow-hidden border border-border">
                    {photoPreview ? (
                      <img src={photoPreview} alt="photo preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-muted-foreground">No photo</span>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Device User ID</label>
                <input value={form.userId} onChange={(e) => updateForm('userId', e.target.value)} className="w-full px-3 py-2 bg-input border border-border rounded" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Name</label>
                <input value={form.name} onChange={(e) => updateForm('name', e.target.value)} required className="w-full px-3 py-2 bg-input border border-border rounded" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Email</label>
                <input value={form.email} onChange={(e) => updateForm('email', e.target.value)} className="w-full px-3 py-2 bg-input border border-border rounded" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Phone</label>
                <input value={form.phone} onChange={(e) => updateForm('phone', e.target.value)} className="w-full px-3 py-2 bg-input border border-border rounded" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Course</label>
                <input value={form.course} onChange={(e) => updateForm('course', e.target.value)} className="w-full px-3 py-2 bg-input border border-border rounded" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Year</label>
                <input value={form.year} onChange={(e) => updateForm('year', e.target.value)} className="w-full px-3 py-2 bg-input border border-border rounded" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Department</label>
                <input value={form.department} onChange={(e) => updateForm('department', e.target.value)} className="w-full px-3 py-2 bg-input border border-border rounded" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Govt ID Type</label>
                <select value={form.govIdType} onChange={(e) => updateForm('govIdType', e.target.value)} className="w-full px-3 py-2 bg-input border border-border rounded">
                  <option>Aadhar Card</option>
                  <option>Pancard</option>
                  <option>VoterId</option>
                  <option>Passport</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Govt ID Files (pdf/png/jpg/jpeg) — you can upload multiple</label>
                <input type="file" accept="application/pdf,image/png,image/jpeg" multiple onChange={(e) => onGovFilesChange(e.target.files)} className="w-full" />
                <div className="mt-2 text-xs text-muted-foreground">{govFiles.length} file(s) selected</div>
                {existingGovFiles.length > 0 && (
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="text-xs text-muted-foreground">Previously uploaded files:</p>
                    <div className="flex flex-col gap-1">
                      {existingGovFiles.map((f, idx) => (
                        <a key={idx} className="text-xs text-cyan-300 underline" href={f.url} target="_blank" rel="noreferrer">{f.filename || f.url}</a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* Guardian fields */}
              <div>
                <label className="text-sm text-muted-foreground">Guardian Name</label>
                <input value={form.guardianName} onChange={(e) => updateForm('guardianName', e.target.value)} className="w-full px-3 py-2 bg-input border border-border rounded" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Guardian Primary Phone</label>
                <input value={form.guardianPhonePrimary} onChange={(e) => updateForm('guardianPhonePrimary', e.target.value)} className="w-full px-3 py-2 bg-input border border-border rounded" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Guardian WhatsApp Number</label>
                <input value={form.guardianPhoneWhatsApp} onChange={(e) => updateForm('guardianPhoneWhatsApp', e.target.value)} className="w-full px-3 py-2 bg-input border border-border rounded" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Relationship</label>
                <input value={form.guardianRelationship} onChange={(e) => updateForm('guardianRelationship', e.target.value)} className="w-full px-3 py-2 bg-input border border-border rounded" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Notification Preference</label>
                <select value={form.notificationPreference} onChange={(e) => updateForm('notificationPreference', e.target.value)} className="w-full px-3 py-2 bg-input border border-border rounded">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Allocate Room & Bed (optional)</h4>
              {initialStudent?.room || initialStudent?.bedNumber ? (
                <p className="text-xs text-muted-foreground mb-2">Currently allocated: { (initialStudent as any)?.roomNumber || (initialStudent as any)?.room || '—' } { (initialStudent as any)?.bedNumber ? ` — Bed ${ (initialStudent as any).bedNumber }` : '' }</p>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground">Room</label>
                  <select
                    disabled={loadingRooms}
                    value={form.roomId}
                    onChange={(e) => { updateForm('roomId', e.target.value); updateForm('bedNumber', '') }}
                    className="w-full px-3 py-2 bg-input border border-border rounded"
                  >
                    <option value="">{loadingRooms ? 'Loading rooms…' : '-- Select room --'}</option>
                      {/* If editing and the student's current room isn't in vacantRooms (because it's occupied), show it as a selectable option */}
                      {initialStudent?.room && !vacantRooms.find(r => r._id === (initialStudent as any).room) && (
                        <option value={(initialStudent as any).room}>{(initialStudent as any).roomNumber || (initialStudent as any).room} (currently allocated)</option>
                      )}
                      {vacantRooms.map((r) => (
                        <option key={r._id} value={r._id}>{r.number}{r.name ? ` — ${r.name}` : ''} ({r.vacantBeds.length} vacant)</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Bed</label>
                  <select
                    disabled={loadingRooms || !form.roomId}
                    value={form.bedNumber}
                    onChange={(e) => updateForm('bedNumber', e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded"
                  >
                    {!form.roomId ? (
                      <option value="">Select a room first</option>
                    ) : (
                      (() => {
                        const roomObj = vacantRooms.find(r => r._id === form.roomId)
                        const vacantBedsList = roomObj?.vacantBeds || []
                        const currentBed = (initialStudent as any)?.bedNumber
                        const isCurrentRoomSelected = form.roomId && initialStudent && String(form.roomId) === String((initialStudent as any).room)
                        // If no vacant beds and there's no current bed to show
                        if (vacantBedsList.length === 0 && !(isCurrentRoomSelected && currentBed)) {
                          return (<option value="">-- No vacant beds in selected room --</option>)
                        }
                        return (
                          <>
                            <option value="">-- Select bed --</option>
                            {/* If editing and current bed isn't in vacant list, show it first so user sees current allocation */}
                            {isCurrentRoomSelected && currentBed && !vacantBedsList.includes(currentBed) && (
                              <option value={currentBed}>{`Current — ${currentBed}`}</option>
                            )}
                            {vacantBedsList.map((b) => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </>
                        )
                      })()
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end w-full mt-2">
              <Button type="button" variant="outline" onClick={() => { if (onBack) onBack() }}>Cancel</Button>
              <Button type="submit" className="bg-cyan-500 hover:bg-cyan-600 text-black" disabled={saving}>{saving ? 'Saving…' : (studentId ? 'Update Student' : 'Add Student')}</Button>
            </div>
            {message && <div className="text-sm text-muted-foreground mt-2">{message}</div>}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
