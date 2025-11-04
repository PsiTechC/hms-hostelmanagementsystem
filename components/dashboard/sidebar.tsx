"use client"

import { useState } from "react"
import {
  LayoutDashboard,
  Users,
  Building2,
  Fingerprint,
  BarChart3,
  Settings,
  Bell,
  Home,
  FileText,
  UserCheck,
  Zap,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

interface SidebarProps {
  role: string | null
  activeSection: string
  onSectionChange: (section: string) => void
}

export function Sidebar({ role, activeSection, onSectionChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const getMenuItems = () => {
    const commonItems = [{ id: "overview", label: "Overview", icon: LayoutDashboard }]

    const roleMenus: Record<string, any[]> = {
      "super-admin": [
        ...commonItems,
        { id: "hostels", label: "Hostels", icon: Building2 },
        // { id: "users", label: "Users", icon: Users },
        { id: "devices", label: "Biometric Devices", icon: Fingerprint },
        { id: "reports", label: "Reports", icon: BarChart3 },
        // { id: "audit", label: "Audit Logs", icon: FileText },
        // { id: "settings", label: "Settings", icon: Settings },
      ],
      "hostel-admin": [
        ...commonItems,
        { id: "students", label: "Students", icon: Users },
        { id: "rooms", label: "Rooms & Beds", icon: Home },
        { id: "staff", label: "Staff", icon: UserCheck },
        { id: "devices", label: "Devices", icon: Fingerprint },
        { id: "reports", label: "Reports", icon: BarChart3 },
        { id: "settings", label: "Settings", icon: Settings },
      ],
      warden: [
        ...commonItems,
        { id: "attendance", label: "Attendance", icon: UserCheck },
        // { id: "alerts", label: "Alerts Config", icon: Bell },
        { id: "students", label: "Students", icon: Users },
        { id: "reports", label: "Reports", icon: BarChart3 },
        { id: "settings", label: "Settings", icon: Settings },
      ],
      staff: [
        ...commonItems,
        { id: "students", label: "Student Info", icon: Users },
        { id: "rooms", label: "Room Allocation", icon: Home },
        { id: "guardians", label: "Guardians", icon: Shield },
        { id: "settings", label: "Settings", icon: Settings },
      ],
      student: [
        ...commonItems,
        { id: "attendance", label: "My Attendance", icon: UserCheck },
        { id: "profile", label: "My Profile", icon: Users },
      ],
      guardian: [
        ...commonItems,
        { id: "notifications", label: "Notifications", icon: Bell },
        { id: "student-info", label: "Student Info", icon: Users },
      ],
    }

    return roleMenus[role || ""] || commonItems
  }

  const menuItems = getMenuItems()

  return (
    <div
      className={`bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <Fingerprint className="w-6 h-6 text-sidebar-primary" />
            <div>
              <h2 className="text-lg font-bold text-sidebar-foreground">HMS</h2>
              <p className="text-xs text-sidebar-accent">Management System</p>
            </div>
          </div>
        )}
        {isCollapsed && <Fingerprint className="w-6 h-6 text-sidebar-primary mx-auto" />}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-sidebar-accent/20 rounded-lg transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg glow-accent-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/20"
              } ${isCollapsed ? "justify-center" : ""}`}
              title={isCollapsed ? item.label : ""}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-4 border-t border-sidebar-border">
          <div className="bg-sidebar-accent/10 rounded-lg p-3 text-xs text-sidebar-foreground">
            <p className="font-semibold mb-1 flex items-center gap-2">
              <Zap className="w-4 h-4 text-sidebar-primary" />
              System Status
            </p>
            <p className="text-sidebar-accent">All systems operational</p>
          </div>
        </div>
      )}
    </div>
  )
}
