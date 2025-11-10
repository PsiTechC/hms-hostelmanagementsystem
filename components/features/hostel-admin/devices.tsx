"use client"

import { useEffect, useState } from "react"
import { useMemo } from "react"
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useForm } from "react-hook-form"

type Device = {
  _id?: string
  name: string
  ip: string
  port?: number
  enabled?: boolean
  online?: boolean
  syncing?: boolean
  lastSeen?: string
}

export function Devices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Device | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<{ id?: string; name?: string } | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  const fetchDevices = async () => {
    setLoading(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/hostel-admin/devices', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (res.ok) {
        const json = await res.json()
        setDevices(json.devices || [])
      } else {
        console.error('Failed to fetch devices', await res.text())
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDevices()
  }, [])

  const openDetails = (d: Device) => {
    setSelected(d)
  }

  const closeDetails = () => setSelected(null)

  const openEdit = (d: Device) => {
    setSelected(d)
    setEditOpen(true)
  }

  const closeEdit = () => {
    setEditOpen(false)
    setSelected(null)
  }

  const updateDevice = async (vals: Partial<Device>) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/hostel-admin/devices', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(vals),
      })
      if (res.ok) {
        await fetchDevices()
        closeEdit()
      } else {
        console.error('Failed to update device', await res.text())
      }
    } catch (e) { console.error(e) }
  }

  const openConfirm = (id?: string, name?: string) => {
    setConfirmTarget({ id, name });
    setConfirmOpen(true);
  }

  const performDelete = async () => {
    const id = confirmTarget?.id
    if (!id) return
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/hostel-admin/devices', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        await fetchDevices()
        closeDetails()
        setConfirmOpen(false)
        setConfirmTarget(null)
      } else {
        const txt = await res.text()
        console.error('Failed to delete device', txt)
        // show an inline error in details modal (reuse editError)
        setEditError('Failed to delete device: ' + txt)
      }
    } catch (e) { console.error(e); setEditError(String(e)) }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-foreground">Biometric Devices</h2>
        <AddDeviceButton onSaved={fetchDevices} />
      </div>

      <div className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && devices.length === 0 && <p className="text-sm text-muted-foreground">No devices configured.</p>}
        {devices.map((d) => (
          <div key={d._id} className="p-3 border rounded-lg flex items-center justify-between cursor-pointer" onClick={() => openDetails(d)}>
            <div>
              <div className="font-medium">{d.name}</div>
              <div className="text-sm text-muted-foreground">{d.ip}:{d.port ?? 4370}</div>
              <div className="text-xs mt-1 flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${d.online ? 'bg-green-500' : 'bg-red-500'}`} />
                <span>{d.online ? 'Online' : 'Offline'}</span>
                {d.syncing && <span className="ml-3 text-xs text-muted-foreground">Syncing…</span>}
                {d.lastSeen && (
                  <span className="ml-3 text-xs text-muted-foreground">Last: {new Date(d.lastSeen).toLocaleString()}</span>
                )}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">{d.enabled === false ? 'Disabled' : 'Enabled'}</div>
          </div>
        ))}
      </div>

      {/* Details modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-neutral-900 rounded-lg p-6 w-[520px]">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{selected.name}</h3>
                <p className="text-sm text-muted-foreground">{selected.ip}:{selected.port ?? 4370}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => openEdit(selected)}>Edit</Button>
                <Button variant="destructive" onClick={() => openConfirm(selected._id, selected.name)}>Delete</Button>
                <Button variant="outline" onClick={closeDetails}>Close</Button>
              </div>
            </div>

            <div className="mt-4 text-sm">
              <p><strong>Enabled:</strong> {selected.enabled === false ? 'No' : 'Yes'}</p>
              <p><strong>Online:</strong> {selected.online ? 'Yes' : 'No'}</p>
              <p><strong>Syncing:</strong> {selected.syncing ? 'Yes' : 'No'}</p>
              {selected.lastSeen && <p><strong>Last Seen:</strong> {new Date(selected.lastSeen).toLocaleString()}</p>}
              {editError && <p className="mt-2 text-sm text-destructive">{editError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {/* Edit modal using Dialog for accessibility */}
      <Dialog open={editOpen} onOpenChange={(v) => { if (!v) closeEdit() }}>
        <DialogContent>
          <DialogTitle>Edit Device</DialogTitle>
          <DialogDescription>Update device details.</DialogDescription>
          {selected && (
            <form onSubmit={async (e) => {
              e.preventDefault()
              setEditError(null)
              const form = e.target as HTMLFormElement
              const formData = new FormData(form)
              const payload: any = { id: selected._id }
              payload.name = String(formData.get('name') || '').trim()
              payload.ip = String(formData.get('ip') || '').trim()
              payload.port = Number(formData.get('port') || 4370)
              payload.enabled = formData.get('enabled') === 'on'
              try {
                await updateDevice(payload)
              } catch (err) {
                setEditError(String(err || 'Failed to update'))
              }
            }} className="space-y-4 mt-4">
              <div>
                <label className="text-sm text-muted-foreground">Device Name</label>
                <Input name="name" defaultValue={selected.name} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Device IP</label>
                <Input name="ip" defaultValue={selected.ip} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Port</label>
                <Input name="port" type="number" defaultValue={selected.port ?? 4370} />
              </div>
              <div className="flex items-center gap-2">
                <input id="enabled" name="enabled" type="checkbox" defaultChecked={selected.enabled !== false} />
                <label htmlFor="enabled" className="text-sm">Enabled</label>
              </div>
              {editError && <p className="text-sm text-destructive">{editError}</p>}
              <DialogFooter className="flex items-center gap-2 justify-end">
                <Button type="submit">Save</Button>
                <Button variant="outline" onClick={closeEdit}>Cancel</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <Dialog open={confirmOpen} onOpenChange={(v) => { if (!v) setConfirmOpen(false) }}>
        <DialogContent>
          <DialogTitle>Confirm delete</DialogTitle>
          <DialogDescription>Delete device permanently.</DialogDescription>
          {confirmTarget && (
            <div className="mt-4">
              <p>Are you sure you want to delete <strong>{confirmTarget.name}</strong>? This cannot be undone.</p>
              <DialogFooter className="flex items-center gap-2 justify-end mt-4">
                <Button variant="destructive" onClick={async () => {
                  await performDelete()
                }}>Delete</Button>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AddDeviceButton({ onSaved }: { onSaved?: () => void }) {
  const form = useForm({ defaultValues: { name: '', ip: '', port: 4370 } })
  const [open, setOpen] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState<string>('')
  const [deviceInfo, setDeviceInfo] = useState<any>(null)

  const testConnection = async () => {
    const ip = form.getValues('ip')
    const port = form.getValues('port')

    if (!ip) {
      setTestStatus('error')
      setTestMessage('Please enter an IP address first')
      return
    }

    setTestStatus('testing')
    setTestMessage('Testing connection...')
    setDeviceInfo(null)

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/hostel-admin/devices/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ip, port }),
      })

      const data = await res.json()

      if (data.success) {
        setTestStatus('success')
        setTestMessage('Connection successful! Device is online and reachable.')
        setDeviceInfo(data.deviceInfo)
      } else {
        setTestStatus('error')
        setTestMessage(data.message)
      }
    } catch (e) {
      setTestStatus('error')
      setTestMessage(`Connection test failed: ${String(e)}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v)
      if (!v) {
        setTestStatus('idle')
        setTestMessage('')
        setDeviceInfo(null)
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="default">Add Device</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Add Biometric Device</DialogTitle>
        <DialogDescription>Test the connection first, then save to register with this hostel.</DialogDescription>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (vals) => {
              try {
                const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
                const res = await fetch('/api/hostel-admin/devices', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify(vals),
                })
                if (res.ok) {
                  form.reset()
                  setTestStatus('idle')
                  setTestMessage('')
                  setDeviceInfo(null)
                  if (onSaved) onSaved()
                  setOpen(false)
                } else {
                  const txt = await res.text()
                  console.error('Failed to save device', txt)
                }
              } catch (e) {
                console.error(e)
              }
            })}
            className="space-y-4 mt-4"
          >
            <div>
              <label className="text-sm text-muted-foreground">Device Name</label>
              <Input {...form.register('name', { required: true })} placeholder="e.g., Main Entrance" />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Device IP Address</label>
              <Input {...form.register('ip', { required: true })} placeholder="e.g., 192.168.1.250" />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Port</label>
              <Input type="number" {...form.register('port', { valueAsNumber: true })} placeholder="4370" />
            </div>

            <div className="border rounded-lg p-4 bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Connection Test</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={testConnection}
                  disabled={testStatus === 'testing'}
                  className="hover:bg-cyan-500/20 hover:text-cyan-400"
                >
                  {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>

              {testMessage && (
                <div className={`text-sm mt-2 p-3 rounded ${
                  testStatus === 'success' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' :
                  testStatus === 'error' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' :
                  'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                }`}>
                  {testMessage}
                </div>
              )}

              {deviceInfo && (
                <div className="mt-3 p-3 bg-background rounded border text-sm space-y-1">
                  <p><strong>Serial Number:</strong> {deviceInfo.serialNumber}</p>
                  <p><strong>Version:</strong> {deviceInfo.version}</p>
                  <p><strong>IP:</strong> {deviceInfo.ip}:{deviceInfo.port}</p>
                </div>
              )}

              {testStatus === 'idle' && (
                <p className="text-xs text-muted-foreground mt-2">
                  Test the connection before saving to ensure the device is reachable
                </p>
              )}
            </div>

            <DialogFooter className="flex items-center gap-2">
              <Button type="submit" disabled={testStatus === 'testing'}>Save Device</Button>
              <Button type="button" variant="outline" onClick={() => {
                form.reset()
                setTestStatus('idle')
                setTestMessage('')
                setDeviceInfo(null)
              }}>Reset</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
