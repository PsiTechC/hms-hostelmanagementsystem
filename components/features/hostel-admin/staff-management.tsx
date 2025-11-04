"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useForm } from "react-hook-form"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Edit2, Trash2, UserCheck, Send, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function StaffManagement() {
  const [staff, setStaff] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', role: 'staff', email: '', phone: '' })
  const [resendingInvitation, setResendingInvitation] = useState<string | null>(null)

  // Custom alert dialog state
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertType, setAlertType] = useState<"success" | "error" | "confirm">("success")
  const [alertMessage, setAlertMessage] = useState("")
  const [confirmAction, setConfirmAction] = useState<null | (() => Promise<void>)>(null)

  const fetchStaff = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch('/api/hostel-admin/staff', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      if (res.ok) {
        const json = await res.json()
        setStaff((json.staff || []).map((s: any) => ({ id: s._id, ...s })))
      } else {
        console.error('Failed to fetch staff', await res.text())
      }
    } catch (e) { console.error(e) }
  }

  const resendInvitation = async (staffId: string) => {
    // Show confirmation dialog
    setAlertType('confirm')
    setAlertMessage('Send a new invitation email with a new password to this staff member?')
    setConfirmAction(() => async () => {
      setResendingInvitation(staffId)
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

      try {
        const res = await fetch('/api/hostel-admin/staff/resend-invitation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ staffId }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to resend invitation')
        }

        setAlertType('success')
        setAlertMessage('Invitation resent successfully! New password has been sent to the staff member\'s email.')
        setAlertOpen(true)
      } catch (err: any) {
        console.error('Resend invitation error:', err)
        setAlertType('error')
        setAlertMessage(err?.message || 'Failed to resend invitation')
        setAlertOpen(true)
      } finally {
        setResendingInvitation(null)
        setConfirmAction(null)
      }
    })
    setAlertOpen(true)
  }

  useEffect(() => { fetchStaff() }, [])

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Staff Management</h2>
          <p className="text-sm text-muted-foreground">Add and manage wardens and staff</p>
        </div>
        <AddStaffButton onSaved={fetchStaff} />
      </div>

      <div className="grid gap-4">
        {staff.map((member) => (
          <Card key={member.id} className="border-border bg-card/50 backdrop-blur-sm">
            <CardContent className="p-6">
              {editingId === member.id ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Name</label>
                    <input className="w-full px-3 py-2 bg-input border border-border rounded" value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Role</label>
                    <select className="w-full px-3 py-2 bg-input border border-border rounded" value={editForm.role} onChange={(e) => setEditForm(f => ({ ...f, role: e.target.value }))}>
                      <option value="staff">Staff</option>
                      <option value="warden">Warden</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Email</label>
                    <input className="w-full px-3 py-2 bg-input border border-border rounded" value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Phone</label>
                    <input className="w-full px-3 py-2 bg-input border border-border rounded" value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={async () => {
                      try {
                        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
                        const res = await fetch(`/api/hostel-admin/staff/${member.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                          body: JSON.stringify(editForm),
                        })
                        if (!res.ok) {
                          console.error('Failed to update staff', await res.text())
                        } else {
                          setEditingId(null)
                          fetchStaff()
                        }
                      } catch (e) { console.error(e) }
                    }}>Save</Button>
                    <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <UserCheck className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-lg font-bold text-foreground">{member.name}</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Role</p>
                        <p className="text-sm font-semibold text-cyan-400 capitalize">{member.role}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="text-sm font-semibold text-cyan-400">{member.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="text-sm font-semibold text-cyan-400">{member.phone}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="border-border bg-transparent hover:bg-blue-500/20 hover:text-blue-400" onClick={() => { setEditingId(member.id); setEditForm({ name: member.name || '', role: member.role || 'staff', email: member.email || '', phone: member.phone || '' }) }}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border hover:bg-cyan-500/20 hover:text-cyan-400 bg-transparent"
                      onClick={() => resendInvitation(member.id)}
                      disabled={resendingInvitation === member.id || !member.email}
                      title={member.email ? "Resend invitation email with new password" : "No email address available"}
                    >
                      {resendingInvitation === member.id ? (
                        <span className="w-4 h-4">...</span>
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                    <Button variant="outline" size="sm" className="border-border hover:bg-red-500/20 hover:text-red-400 bg-transparent" onClick={() => {
                      // Show confirmation dialog
                      setAlertType('confirm')
                      setAlertMessage('Are you sure you want to permanently delete this staff member?')
                      setConfirmAction(() => async () => {
                        try {
                          const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
                          const res = await fetch(`/api/hostel-admin/staff/${member.id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : undefined })
                          if (!res.ok) {
                            console.error('Failed to delete staff', await res.text())
                            setAlertType('error')
                            setAlertMessage('Failed to delete staff member')
                          } else {
                            await fetchStaff()
                            setAlertType('success')
                            setAlertMessage('Staff member deleted successfully.')
                          }
                          setAlertOpen(true)
                        } catch (e) {
                          console.error(e)
                          setAlertType('error')
                          setAlertMessage('Network error. Failed to delete staff member.')
                          setAlertOpen(true)
                        } finally {
                          setConfirmAction(null)
                        }
                      })
                      setAlertOpen(true)
                    }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Custom Alert Dialog */}
      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent
          className={`${
            alertType === "success"
              ? "border-green-500"
              : alertType === "error"
              ? "border-red-500"
              : "border-yellow-500"
          } border-2 bg-background`}
        >
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              {alertType === "success" && <CheckCircle2 className="w-6 h-6 text-green-500" />}
              {alertType === "error" && <XCircle className="w-6 h-6 text-red-500" />}
              {alertType === "confirm" && <AlertTriangle className="w-6 h-6 text-yellow-500" />}
              <AlertDialogTitle
                className={
                  alertType === "success"
                    ? "text-green-500"
                    : alertType === "error"
                    ? "text-red-500"
                    : "text-yellow-500"
                }
              >
                {alertType === "success"
                  ? "Success"
                  : alertType === "error"
                  ? "Error"
                  : "Please Confirm"}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-foreground/80 mt-2">
              {alertMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {alertType === "confirm" ? (
              <>
                <AlertDialogCancel
                  onClick={() => {
                    setConfirmAction(null)
                    setAlertOpen(false)
                  }}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    setAlertOpen(false)
                    if (confirmAction) await confirmAction()
                  }}
                  className="bg-yellow-600 text-white hover:bg-yellow-700"
                >
                  Confirm
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction
                onClick={() => setAlertOpen(false)}
                className={
                  alertType === "success"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-red-600 text-white hover:bg-red-700"
                }
              >
                OK
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
 
  function AddStaffButton({ onSaved }: { onSaved?: () => void }) {
    const form = useForm({ defaultValues: { name: '', role: '', email: '', phone: '' } })
    const [open, setOpen] = useState(false)

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="bg-cyan-500 hover:bg-cyan-600 text-black flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Staff
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Add Staff</DialogTitle>
          <DialogDescription>Enter staff member details.</DialogDescription>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(async (vals) => {
              try {
                const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
                const res = await fetch('/api/hostel-admin/staff', {
                  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                  body: JSON.stringify(vals)
                })
                if (res.ok) {
                  form.reset()
                  setOpen(false)
                  if (onSaved) onSaved()
                } else {
                  console.error('Failed to save staff', await res.text())
                }
              } catch (e) { console.error(e) }
            })} className="space-y-4 mt-4">
              <div>
                <label className="text-sm text-muted-foreground">Name</label>
                <Input {...form.register('name', { required: true })} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Role</label>
                <select
                  {...form.register('role')}
                  className="border-input h-9 w-full min-w-0 rounded-md border bg-white dark:bg-input/100 px-3 py-1 text-sm text-foreground"
                >
                  <option value="staff">Staff</option>
                  <option value="warden">Warden</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Email</label>
                <Input {...form.register('email')} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Phone</label>
                <Input {...form.register('phone')} />
              </div>
              <DialogFooter className="flex items-center gap-2">
                <Button type="submit">Save</Button>
                <Button variant="outline" onClick={() => form.reset()}>Reset</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    )
  }
