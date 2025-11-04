// "use client"

// import type React from "react"

// import { useState, useEffect } from "react"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
// import { Trash2, Plus, Edit2, AlertTriangle, X, Send } from "lucide-react"
// // import { useToast } from "@/hooks/use-toast"
// import HostelForm from './hostel-form'
// import AddHostelPage from './add-hostel-page'

// export function HostelManagement() {
//   // const { toast } = useToast()
//   const [hostels, setHostels] = useState<any[]>([])
//   const [loadingList, setLoadingList] = useState(false)
//   const [showFormInline, setShowFormInline] = useState(false)
//   const [editingHostel, setEditingHostel] = useState<any | null>(null)
//   const [showAddHostelPage, setShowAddHostelPage] = useState(false)
//   const [editingHostelId, setEditingHostelId] = useState<string | null>(null)

//   const [showForm, setShowForm] = useState(false)
//   const [formData, setFormData] = useState({
//     name: "",
//     location: "",
//     capacity: "",
//     licenseExpiry: "",
//     adminName: "",
//     adminEmail: "",
//     adminPhone: "",
//   })

//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState<string | null>(null)
//   const [resendingInvitation, setResendingInvitation] = useState<string | null>(null)

//   const resendInvitation = async (hostelId: string) => {
//     setResendingInvitation(hostelId)
//     const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

//     try {
//       const res = await fetch('/api/super-admin/hostel/resend-invitation', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           ...(token ? { Authorization: `Bearer ${token}` } : {}),
//         },
//         body: JSON.stringify({ hostelId }),
//       })

//       if (!res.ok) {
//         const data = await res.json()
//         throw new Error(data.error || 'Failed to resend invitation')
//       }

//       // Show success notification (you can replace this with a toast notification)
//      alert('Invitation resent successfully! New password has been sent to the admin email.')


//       // toast({
//       //   title: "Success",
//       //   description: "Invitation resent successfully! New password has been sent to the admin email.",
//       // })
//     } catch (err: any) {
//       console.error('Resend invitation error:', err)
//       alert(err?.message || 'Failed to resend invitation')

//       // toast({
//       //   title: "Error",
//       //   description: err?.message || 'Failed to resend invitation',
//       //   variant: "destructive",
//       // })
//     } finally {
//       setResendingInvitation(null)
//     }
//   }

//   const deleteHostel = (id: number) => {
//     // optimistic removal handled below via API
//     ;(async () => {
//       const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
//       try {
//         const res = await fetch(`/api/super-admin/hostel/${id}`, {
//           method: "DELETE",
//           headers: {
//             ...(token ? { Authorization: `Bearer ${token}` } : {}),
//           },
//         })
//         if (!res.ok) {
//           const txt = await res.text()
//           throw new Error(txt || `Failed to delete (${res.status})`)
//         }
//         setHostels((prev) => prev.filter((h) => (h._id ? h._id !== id : h.id !== id)))
//       } catch (err) {
//         console.error("Delete hostel error:", err)
//         // optionally show UI toast
//       }
//     })()
//   }

//   async function fetchHostels() {
//     setLoadingList(true)
//     try {
//       const res = await fetch('/api/super-admin/hostel')
//       if (!res.ok) throw new Error('Failed to load hostels')
//       const json = await res.json()
//       // route returns { hostels }
//       const raw = json?.hostels || json || []
//       // normalize server fields to UI-friendly shape
//       const norm = raw.map((h: any) => {
//         const doc = h?.hostel ? h.hostel : h
//         return {
//           _id: doc._id || doc.id,
//           id: doc._id || doc.id,
//           name: doc.name || doc.title || '',
//           location: doc.address || doc.location || '',
//           capacity: doc.capacity ?? 0,
//           capacityUnlimited: !!doc.capacityUnlimited,
//           occupied: doc.occupied ?? 0,
//           licenseExpiry: doc.licenseExpiry || doc.license_expiry || '',
//           admin: doc.adminName || doc.admin || doc.admin_name || '',
//           adminEmail: doc.contactEmail || doc.adminEmail || doc.admin_email || '',
//           adminPhone: doc.contactPhone || doc.adminPhone || doc.admin_phone || '',
//           roomsUnlimited: !!doc.roomsUnlimited,
//           totalRooms: doc.totalRooms ?? doc.total_rooms ?? null,
//           status: 'active',
//         }
//       })
//       setHostels(norm)
//     } catch (err) {
//       console.error('Fetch hostels error', err)
//     } finally {
//       setLoadingList(false)
//     }
//   }

//   useEffect(() => {
//     fetchHostels()
//   }, [])

//   // When requested, render the AddHostelPage as a full-page (like AddStudentPage)
//   if (showAddHostelPage) {
//     return (
//       <AddHostelPage
//         hostelId={editingHostelId || undefined}
//         onBack={() => { setShowAddHostelPage(false); setEditingHostelId(null); fetchHostels() }}
//         onSaved={() => { setShowAddHostelPage(false); setEditingHostelId(null); fetchHostels() }}
//       />
//     )
//   }

//   const handleAddHostel = async (e: React.FormEvent) => {
//     e.preventDefault()
//     setLoading(true)
//     setError(null)

//     const payload = {
//       name: formData.name,
//       // map 'location' to address to match backend field names
//       address: formData.location,
//       // send both capacity and totalRooms for compatibility (server may validate either)
//       capacity: Number.parseInt(formData.capacity || "0", 10),
//       totalRooms: Number.parseInt(formData.capacity || "0", 10),
//       licenseExpiry: formData.licenseExpiry,
//       contactEmail: formData.adminEmail,
//       contactPhone: formData.adminPhone,
//       adminName: formData.adminName,
//     }

//     // token should be stored by your login flow in localStorage under 'token'
//     const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

//     try {
//       const res = await fetch("/api/super-admin/hostel", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           ...(token ? { Authorization: `Bearer ${token}` } : {}),
//         },
//         body: JSON.stringify(payload),
//       })

//       if (!res.ok) {
//         // try to read JSON error, fallback to text
//         let msg = res.statusText
//         try {
//           const j = await res.json()
//           msg = j?.message || JSON.stringify(j)
//         } catch (e) {
//           const t = await res.text()
//           if (t) msg = t
//         }
//         throw new Error(msg || `Request failed: ${res.status}`)
//       }

//       const body = await res.json()
//       const created = body?.hostel ? body.hostel : body

//       const newHostel = {
//         _id: created._id || created.id,
//         id: created._id || created.id || Math.max(...hostels.map((h) => h.id), 0) + 1,
//         name: created.name ?? formData.name,
//         location: created.address ?? formData.location,
//         capacity: created.capacity ?? Number.parseInt(formData.capacity || "0", 10),
//         capacityUnlimited: !!created.capacityUnlimited,
//         occupied: created.occupied ?? 0,
//         licenseExpiry: created.licenseExpiry ?? formData.licenseExpiry,
//         admin: created.adminName ?? formData.adminName,
//         adminEmail: created.contactEmail ?? formData.adminEmail,
//         adminPhone: created.contactPhone ?? formData.adminPhone,
//         roomsUnlimited: !!created.roomsUnlimited,
//         totalRooms: created.totalRooms ?? null,
//         status: "active",
//       }

//       setHostels((prev) => [...prev, newHostel])

//       // reset form
//       setFormData({
//         name: "",
//         location: "",
//         capacity: "",
//         licenseExpiry: "",
//         adminName: "",
//         adminEmail: "",
//         adminPhone: "",
//       })
//       setShowForm(false)
//     } catch (err: any) {
//       setError(err?.message || "Failed to create hostel")
//       console.error("Create hostel error:", err)
//     } finally {
//       setLoading(false)
//     }
//   }

//   const isLicenseExpiring = (date: string) => {
//     const expiry = new Date(date)
//     const today = new Date()
//     const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
//     return daysUntilExpiry < 90
//   }

//   return (
//     <div className="p-6 space-y-6">
//       <div className="flex items-center justify-between">
//         <div>
//           <h2 className="text-2xl font-bold text-foreground">Hostel Management</h2>
//           <p className="text-sm text-muted-foreground">Manage hostels, admins, and license expiry</p>
//         </div>
//         <Button
//           onClick={() => { setEditingHostel(null); setEditingHostelId(null); setShowAddHostelPage(true) }}
//           className="bg-cyan-500 hover:bg-cyan-600 text-black flex items-center gap-2"
//         >
//           <Plus className="w-4 h-4" />
//           Add Hostel
//         </Button>
//       </div>
//       {/* AddHostelPage is rendered as a full-page above when `showAddHostelPage` is true */}

//       {/* Hostels List */}
//       <div className="grid gap-4">
//         {hostels.map((hostel) => (
//           <Card key={hostel.id} className="border-border bg-card/50 backdrop-blur-sm">
//             <CardContent className="p-6">
//               <div className="flex items-start justify-between">
//                 <div className="flex-1">
//                   <div className="flex items-center gap-3 mb-2">
//                     <h3 className="text-lg font-bold text-foreground">{hostel.name}</h3>
//                     {isLicenseExpiring(hostel.licenseExpiry) && (
//                       <div className="flex items-center gap-1 bg-orange-500/20 text-orange-400 px-2 py-1 rounded text-xs">
//                         <AlertTriangle className="w-3 h-3" />
//                         License Expiring
//                       </div>
//                     )}
//                   </div>
//                   <p className="text-sm text-muted-foreground mb-3">{hostel.location}</p>
//                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
//                     <div>
//                       <p className="text-xs text-muted-foreground">Capacity</p>
//                       <p className="text-lg font-semibold text-cyan-400">{hostel.capacityUnlimited ? 'No limit' : hostel.capacity}</p>
//                     </div>
//                     <div>
//                       <p className="text-xs text-muted-foreground">Occupied</p>
//                       <p className="text-lg font-semibold text-cyan-400">{hostel.occupied}</p>
//                     </div>
//                     <div>
//                       <p className="text-xs text-muted-foreground">Total Rooms</p>
//                       <p className="text-lg font-semibold text-cyan-400">
//                         {hostel.roomsUnlimited ? 'Unlimited' : (hostel.totalRooms ?? '—')}
//                       </p>
//                     </div>
//                     <div>
//                       <p className="text-xs text-muted-foreground">Occupancy Rate</p>
//                       <p className="text-lg font-semibold text-cyan-400">
//                         {hostel.capacityUnlimited ? 'No limit' : (hostel.capacity > 0 ? `${Math.round((hostel.occupied / hostel.capacity) * 100)}%` : '—')}
//                       </p>
//                     </div>
//                   </div>
//                   <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
//                     <p className="text-xs text-muted-foreground mb-2">Hostel Admin</p>
//                     <div className="grid grid-cols-3 gap-4">
//                       <div>
//                         <p className="text-xs text-slate-400">Name</p>
//                         <p className="text-sm font-semibold text-cyan-400">{hostel.admin}</p>
//                       </div>
//                       <div>
//                         <p className="text-xs text-slate-400">Email</p>
//                         <p className="text-sm font-semibold text-cyan-400">{hostel.adminEmail}</p>
//                       </div>
//                       <div>
//                         <p className="text-xs text-slate-400">Phone</p>
//                         <p className="text-sm font-semibold text-cyan-400">{hostel.adminPhone}</p>
//                       </div>
//                     </div>
//                     <div className="mt-3">
//                       <p className="text-xs text-muted-foreground">License Expiry</p>
//                       <p className="text-sm font-semibold text-cyan-400">{hostel.licenseExpiry || '—'}</p>
//                     </div>
//                   </div>
//                 </div>
//                   <div className="flex gap-2">
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     className="border-border bg-transparent"
//                     onClick={() => {
//                       // open full-page edit view (prefetch will occur there)
//                       setEditingHostelId(String(hostel._id || hostel.id))
//                       setShowAddHostelPage(true)
//                     }}
//                   >
//                     <Edit2 className="w-4 h-4" />
//                   </Button>
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     className="border-border hover:bg-cyan-500/20 hover:text-cyan-400 bg-transparent"
//                     onClick={() => resendInvitation(String(hostel._id || hostel.id))}
//                     disabled={resendingInvitation === String(hostel._id || hostel.id)}
//                     title="Resend invitation email with new password"
//                   >
//                     {resendingInvitation === String(hostel._id || hostel.id) ? (
//                       <span className="w-4 h-4">...</span>
//                     ) : (
//                       <Send className="w-4 h-4" />
//                     )}
//                   </Button>
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     className="border-border hover:bg-red-500/20 hover:text-red-400 bg-transparent"
//                     onClick={() => deleteHostel(hostel.id)}
//                   >
//                     <Trash2 className="w-4 h-4" />
//                   </Button>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         ))}
//       </div>
//     </div>
//   )
// }



"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, Plus, Edit2, AlertTriangle, Send, CheckCircle2, XCircle } from "lucide-react"
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
import AddHostelPage from "./add-hostel-page"

export function HostelManagement() {
  const [hostels, setHostels] = useState<any[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [editingHostelId, setEditingHostelId] = useState<string | null>(null)
  const [showAddHostelPage, setShowAddHostelPage] = useState(false)
  const [resendingInvitation, setResendingInvitation] = useState<string | null>(null)

  // Custom alert dialog states
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertType, setAlertType] = useState<"success" | "error">("success")
  const [alertMessage, setAlertMessage] = useState("")

  // Fetch all hostels
  async function fetchHostels() {
    setLoadingList(true)
    try {
      const res = await fetch("/api/super-admin/hostel")
      if (!res.ok) throw new Error("Failed to load hostels")
      const json = await res.json()
      const raw = json?.hostels || json || []
      const norm = raw.map((h: any) => {
        const doc = h?.hostel ? h.hostel : h
        return {
          _id: doc._id || doc.id,
          id: doc._id || doc.id,
          name: doc.name || "",
          location: doc.address || doc.location || "",
          capacity: doc.capacity ?? 0,
          capacityUnlimited: !!doc.capacityUnlimited,
          occupied: doc.occupied ?? 0,
          licenseExpiry: doc.licenseExpiry || "",
          admin: doc.adminName || "",
          adminEmail: doc.contactEmail || "",
          adminPhone: doc.contactPhone || "",
          totalRooms: doc.totalRooms ?? null,
          roomsUnlimited: !!doc.roomsUnlimited,
          status: "active",
        }
      })
      setHostels(norm)
    } catch (err) {
      console.error("Fetch hostels error:", err)
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    fetchHostels()
  }, [])

  // Resend invitation with alert dialog feedback
  const resendInvitation = async (hostelId: string) => {
    setResendingInvitation(hostelId)
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

    try {
      const res = await fetch("/api/super-admin/hostel/resend-invitation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ hostelId }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to resend invitation")

      // ✅ Success dialog
      setAlertType("success")
      setAlertMessage("Invitation resent successfully! New password sent to admin email.")
    } catch (err: any) {
      console.error("Resend invitation error:", err)
      // ❌ Error dialog
      setAlertType("error")
      setAlertMessage(err?.message || "Failed to resend invitation.")
    } finally {
      setResendingInvitation(null)
      setAlertOpen(true)
    }
  }

  // Delete hostel
  const deleteHostel = async (id: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    try {
      const res = await fetch(`/api/super-admin/hostel/${id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (!res.ok) throw new Error("Failed to delete hostel")
      setHostels((prev) => prev.filter((h) => h.id !== id))
    } catch (err) {
      console.error("Delete hostel error:", err)
      setAlertType("error")
      setAlertMessage("Error deleting hostel.")
      setAlertOpen(true)
    }
  }

  // License expiry check
  const isLicenseExpiring = (date: string) => {
    const expiry = new Date(date)
    const today = new Date()
    const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry < 90
  }

  // Show AddHostelPage
  if (showAddHostelPage) {
    return (
      <AddHostelPage
        hostelId={editingHostelId || undefined}
        onBack={() => {
          setShowAddHostelPage(false)
          setEditingHostelId(null)
          fetchHostels()
        }}
        onSaved={() => {
          setShowAddHostelPage(false)
          setEditingHostelId(null)
          fetchHostels()
        }}
      />
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Hostel Management</h2>
          <p className="text-sm text-muted-foreground">Manage hostels, admins, and license expiry</p>
        </div>
        <Button
          onClick={() => {
            setEditingHostelId(null)
            setShowAddHostelPage(true)
          }}
          className="bg-cyan-500 hover:bg-cyan-600 text-black flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Hostel
        </Button>
      </div>

      {/* Hostel list */}
      <div className="grid gap-4">
        {hostels.map((hostel) => (
          <Card key={hostel.id} className="border-border bg-card/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-foreground">{hostel.name}</h3>
                    {isLicenseExpiring(hostel.licenseExpiry) && (
                      <div className="flex items-center gap-1 bg-orange-500/20 text-orange-400 px-2 py-1 rounded text-xs">
                        <AlertTriangle className="w-3 h-3" />
                        License Expiring
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{hostel.location}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Capacity</p>
                      <p className="text-lg font-semibold text-cyan-400">
                        {hostel.capacityUnlimited ? "No limit" : hostel.capacity}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Occupied</p>
                      <p className="text-lg font-semibold text-cyan-400">{hostel.occupied}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Rooms</p>
                      <p className="text-lg font-semibold text-cyan-400">
                        {hostel.roomsUnlimited ? "Unlimited" : hostel.totalRooms ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Occupancy Rate</p>
                      <p className="text-lg font-semibold text-cyan-400">
                        {hostel.capacityUnlimited
                          ? "No limit"
                          : hostel.capacity > 0
                          ? `${Math.round((hostel.occupied / hostel.capacity) * 100)}%`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                    <p className="text-xs text-muted-foreground mb-2">Hostel Admin</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-slate-400">Name</p>
                        <p className="text-sm font-semibold text-cyan-400">{hostel.admin}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Email</p>
                        <p className="text-sm font-semibold text-cyan-400">{hostel.adminEmail}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Phone</p>
                        <p className="text-sm font-semibold text-cyan-400">{hostel.adminPhone}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground">License Expiry</p>
                      <p className="text-sm font-semibold text-cyan-400">
                        {hostel.licenseExpiry || "—"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingHostelId(String(hostel._id || hostel.id))
                      setShowAddHostelPage(true)
                    }}
                    className="hover:bg-cyan-500/20 hover:text-cyan-400"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resendInvitation(String(hostel._id || hostel.id))}
                    disabled={resendingInvitation === String(hostel._id || hostel.id)}
                    className="hover:bg-cyan-500/20 hover:text-cyan-400"
                  >
                    {resendingInvitation === String(hostel._id || hostel.id) ? "..." : <Send className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteHostel(hostel.id)}
                    className="hover:bg-red-500/20 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ✅ Custom Alert Dialog */}
      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent
          className={`${
            alertType === "success" ? "border-green-500" : "border-red-500"
          } border-2 bg-background`}
        >
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              {alertType === "success" ? (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              ) : (
                <XCircle className="w-6 h-6 text-red-500" />
              )}
              <AlertDialogTitle
                className={alertType === "success" ? "text-green-500" : "text-red-500"}
              >
                {alertType === "success" ? "Invitation Sent" : "Error Sending Invitation"}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-foreground/80 mt-2">
              {alertMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
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
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
