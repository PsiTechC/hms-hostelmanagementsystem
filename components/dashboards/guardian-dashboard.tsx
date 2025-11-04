"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, AlertCircle } from "lucide-react"

interface GuardianDashboardProps {
  activeSection: string
}

export function GuardianDashboard({ activeSection }: GuardianDashboardProps) {
  return (
    <div className="p-6 space-y-6">
      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-cyan-400">Student Information</CardTitle>
          <CardDescription>Your ward's hostel details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400">Student Name</p>
              <p className="text-lg font-semibold text-cyan-400 mt-1">John Doe</p>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400">Roll Number</p>
              <p className="text-lg font-semibold text-cyan-400 mt-1">CS-2024-001</p>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400">Hostel</p>
              <p className="text-lg font-semibold text-cyan-400 mt-1">Hostel A</p>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400">Room Number</p>
              <p className="text-lg font-semibold text-cyan-400 mt-1">A-205</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-cyan-400">Recent Notifications</CardTitle>
          <CardDescription>Latest updates about your ward</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { type: "info", message: "Student checked in at 9:45 PM" },
            { type: "alert", message: "Late entry recorded - 10:30 PM" },
            { type: "info", message: "Attendance: 98.5% this month" },
          ].map((notif, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              {notif.type === "alert" ? (
                <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
              ) : (
                <Bell className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              )}
              <p className="text-sm text-slate-300">{notif.message}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
