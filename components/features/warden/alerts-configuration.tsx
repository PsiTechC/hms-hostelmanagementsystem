// "use client"

// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
// import { Save, Bell } from "lucide-react"

// export function AlertsConfiguration() {
//   return (
//     <div className="p-6 space-y-6">
//       <div>
//         <h2 className="text-2xl font-bold text-foreground">Alerts Configuration</h2>
//         <p className="text-sm text-muted-foreground">Configure alert settings and thresholds</p>
//       </div>

//       <div className="grid gap-6">
//         <Card className="border-border bg-card/50 backdrop-blur-sm">
//           <CardHeader>
//             <CardTitle className="text-cyan-400 flex items-center gap-2">
//               <Bell className="w-5 h-5" />
//               Late Entry Alerts
//             </CardTitle>
//           </CardHeader>
//           <CardContent className="space-y-4">
//             <div>
//               <label className="text-sm text-muted-foreground">Alert Threshold (minutes after night-in)</label>
//               <input
//                 type="number"
//                 defaultValue="15"
//                 className="w-full mt-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-foreground"
//               />
//             </div>
//             <div>
//               <label className="text-sm text-muted-foreground">Alert Recipients</label>
//               <div className="mt-2 space-y-2">
//                 <label className="flex items-center gap-2 text-sm text-foreground">
//                   <input type="checkbox" defaultChecked className="w-4 h-4" />
//                   Warden
//                 </label>
//                 <label className="flex items-center gap-2 text-sm text-foreground">
//                   <input type="checkbox" defaultChecked className="w-4 h-4" />
//                   Hostel Admin
//                 </label>
//                 <label className="flex items-center gap-2 text-sm text-foreground">
//                   <input type="checkbox" className="w-4 h-4" />
//                   Guardian
//                 </label>
//               </div>
//             </div>
//           </CardContent>
//         </Card>

//         <Card className="border-border bg-card/50 backdrop-blur-sm">
//           <CardHeader>
//             <CardTitle className="text-cyan-400">Notification Channels</CardTitle>
//           </CardHeader>
//           <CardContent className="space-y-4">
//             <label className="flex items-center gap-2 text-sm text-foreground">
//               <input type="checkbox" defaultChecked className="w-4 h-4" />
//               WhatsApp Notifications
//             </label>
//             <label className="flex items-center gap-2 text-sm text-foreground">
//               <input type="checkbox" defaultChecked className="w-4 h-4" />
//               Email Notifications
//             </label>
//             <label className="flex items-center gap-2 text-sm text-foreground">
//               <input type="checkbox" className="w-4 h-4" />
//               SMS Notifications
//             </label>
//           </CardContent>
//         </Card>

//         <Button className="bg-cyan-500 hover:bg-cyan-600 text-black flex items-center gap-2 w-full">
//           <Save className="w-4 h-4" />
//           Save Configuration
//         </Button>
//       </div>
//     </div>
//   )
// }
