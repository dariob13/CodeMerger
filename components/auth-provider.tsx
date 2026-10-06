"use client"

import * as React from "react"

export type DemoProfile = { name: string; email: string; provider: "email" | "Google" | "GitHub" }
const KEY = "codemerger.demo-profile.v1"
function readProfile(raw: string | null): DemoProfile | null {
  try {
    const p = JSON.parse(raw || "null")
    return p && typeof p.name === "string" && p.name.trim() && typeof p.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) && ["email", "Google", "GitHub"].includes(p.provider)
      ? { name: p.name, email: p.email, provider: p.provider } : null
  } catch { return null }
}
const Context = React.createContext<{
  profile: DemoProfile | null; ready: boolean; storageWarning: string;
  signIn: (profile: DemoProfile, remember: boolean) => void; signOut: () => void
} | null>(null)

// UI preview only. This profile is not an auth token and never authorizes API requests.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = React.useState<DemoProfile | null>(null)
  const [ready, setReady] = React.useState(false)
  const [storageWarning, setStorageWarning] = React.useState("")
  React.useEffect(() => {
    let mounted = true
    queueMicrotask(() => {
      if (!mounted) return
      try { setProfile(readProfile(localStorage.getItem(KEY)) || readProfile(sessionStorage.getItem(KEY))) }
      catch { setStorageWarning("Browser storage is unavailable. Your preview sign-in will last until you reload.") }
      setReady(true)
    })
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY && event.storageArea === localStorage) {
        setProfile(readProfile(event.newValue))
        try { sessionStorage.removeItem(KEY) } catch { /* Memory-only preview still works. */ }
      }
    }
    window.addEventListener("storage", onStorage)
    return () => { mounted = false; window.removeEventListener("storage", onStorage) }
  }, [])
  function signIn(next: DemoProfile, remember: boolean) {
    setProfile(next)
    try {
      localStorage.removeItem(KEY)
      sessionStorage.removeItem(KEY)
      ;(remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(next))
      setStorageWarning("")
    } catch { setStorageWarning("Browser storage is unavailable. Your preview sign-in will last until you reload.") }
  }
  function signOut() {
    setProfile(null)
    try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY) } catch { /* No credentials exist to revoke. */ }
  }
  return <Context.Provider value={{ profile, ready, storageWarning, signIn, signOut }}>{children}</Context.Provider>
}
export function useDemoAuth() {
  const value = React.useContext(Context)
  if (!value) throw new Error("useDemoAuth requires AuthProvider")
  return value
}
