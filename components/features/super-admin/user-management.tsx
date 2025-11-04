// "use client"

// import { useState } from "react"
// import { Card, CardContent } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
// import { Plus, Edit2, Trash2, Shield } from "lucide-react"

// export function UserManagement() {
//   const [users, setUsers] = useState([
//     {
//       id: 1,
//       name: "Admin User 1",
//       email: "admin1@hms.com",
//       role: "super-admin",
//       restrictions: "Can manage hostels and users",
//       status: "active",
//     },
//     {
//       id: 2,
//       name: "Hostel Admin A",
//       email: "hostel-admin-a@hms.com",
//       role: "hostel-admin",
//       restrictions: "Limited to Hostel A",
//       status: "active",
//     },
//   ])

//   return (
//     <div className="p-6 space-y-6">
//       <div className="flex items-center justify-between">
//         <div>
//           <h2 className="text-2xl font-bold text-foreground">User Management</h2>
//           <p className="text-sm text-muted-foreground">Manage system users and roles</p>
//         </div>
//         <Button className="bg-cyan-500 hover:bg-cyan-600 text-black flex items-center gap-2">
//           <Plus className="w-4 h-4" />
//           Add User
//         </Button>
//       </div>

//       <div className="grid gap-4">
//         {users.map((user) => (
//           <Card key={user.id} className="border-border bg-card/50 backdrop-blur-sm">
//             <CardContent className="p-6">
//               <div className="flex items-start justify-between">
//                 <div className="flex-1">
//                   <div className="flex items-center gap-2 mb-2">
//                     <Shield className="w-5 h-5 text-cyan-400" />
//                     <h3 className="text-lg font-bold text-foreground">{user.name}</h3>
//                   </div>
//                   <p className="text-sm text-muted-foreground mb-3">{user.email}</p>
//                   <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
//                     <div>
//                       <p className="text-xs text-muted-foreground">Role</p>
//                       <p className="text-sm font-semibold text-cyan-400 capitalize">{user.role.replace("-", " ")}</p>
//                     </div>
//                     <div>
//                       <p className="text-xs text-muted-foreground">Restrictions</p>
//                       <p className="text-sm font-semibold text-cyan-400">{user.restrictions}</p>
//                     </div>
//                     <div>
//                       <p className="text-xs text-muted-foreground">Status</p>
//                       <p className="text-sm font-semibold text-green-400 capitalize">{user.status}</p>
//                     </div>
//                   </div>
//                 </div>
//                 <div className="flex gap-2">
//                   <Button variant="outline" size="sm" className="border-border bg-transparent">
//                     <Edit2 className="w-4 h-4" />
//                   </Button>
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     className="border-border hover:bg-red-500/20 hover:text-red-400 bg-transparent"
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
