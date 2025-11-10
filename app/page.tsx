"use client"

import { useState } from "react"
import { LoginForm } from "@/components/auth/login-form"
import { Dashboard } from "@/components/dashboard/dashboard"

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  const [user, setUser] = useState<{ id: string; email: string; role?: string } | null>(null)

  const handleLogin = (userObj: { id: string; email: string; role?: string }, token: string) => {
    // store token if provided
    try {
      if (token) localStorage.setItem('token', token)
    } catch (e) {
      // ignore storage errors
    }

    setUser(userObj)
    setUserRole(userObj.role ?? null)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setUserRole(null)
    setUser(null)
    try { localStorage.removeItem('token') } catch (e) {}
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />
  }

  return <Dashboard role={userRole} user={user} onLogout={handleLogout} />
}
