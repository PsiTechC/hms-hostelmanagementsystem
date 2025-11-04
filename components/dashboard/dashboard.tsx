"use client"

import { useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { SuperAdminDashboard } from "@/components/dashboards/super-admin-dashboard"
import { HostelAdminDashboard } from "@/components/dashboards/hostel-admin-dashboard"
import { WardenDashboard } from "@/components/dashboards/warden-dashboard"
import { StaffDashboard } from "@/components/dashboards/staff-dashboard"
import { StudentDashboard } from "@/components/dashboards/student-dashboard"
import { GuardianDashboard } from "@/components/dashboards/guardian-dashboard"
import { Button } from "@/components/ui/button"
import { LogOut, Moon, Sun } from "lucide-react"

interface DashboardProps {
  role: string | null
  onLogout: () => void
}

export function Dashboard({ role, onLogout }: DashboardProps) {
  const [activeSection, setActiveSection] = useState("overview")
  const [isDarkMode, setIsDarkMode] = useState(true)

  const renderDashboard = () => {
    switch (role) {
      case "super-admin":
        return <SuperAdminDashboard activeSection={activeSection} />
      case "hostel-admin":
        return <HostelAdminDashboard activeSection={activeSection} />
      case "warden":
        return <WardenDashboard activeSection={activeSection} />
      case "staff":
        return <StaffDashboard activeSection={activeSection} />
      case "student":
        return <StudentDashboard activeSection={activeSection} />
      case "guardian":
        return <GuardianDashboard activeSection={activeSection} />
      default:
        return null
    }
  }

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode)
    if (typeof document !== "undefined") {
      if (isDarkMode) {
        document.documentElement.classList.remove("dark")
        document.documentElement.classList.add("light")
      } else {
        document.documentElement.classList.remove("light")
        document.documentElement.classList.add("dark")
      }
    }
  }

  return (
    <div className={`flex h-screen bg-background ${isDarkMode ? "dark" : "light"}`}>
      <Sidebar role={role} activeSection={activeSection} onSectionChange={setActiveSection} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground capitalize">{role?.replace("-", " ")} Dashboard</h1>
            <p className="text-sm text-muted-foreground">Welcome back to HMS</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={toggleTheme}
              variant="outline"
              className="flex items-center gap-2 border-border hover:bg-primary hover:text-primary-foreground bg-transparent hover:bg-cyan-500/20 hover:text-cyan-400"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              onClick={onLogout}
              variant="outline"
              className="flex items-center gap-2 border-border hover:bg-destructive hover:text-destructive-foreground bg-transparent"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">{renderDashboard()}</div>
      </div>
    </div>
  )
}
