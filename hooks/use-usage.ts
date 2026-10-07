"use client"

import * as React from "react"
import { api } from "@/lib/api"
import type { AgentUsage } from "@/lib/types"

const POLL = 60_000

// Usage for the active agents. Reloads on a timer and whenever `trigger` changes (a reply finishing).
export function useUsage(trigger: unknown) {
  const [usage, setUsage] = React.useState<AgentUsage[]>([])

  const reload = React.useCallback(async () => {
    try {
      setUsage((await api<{ usage: AgentUsage[] }>("usage")).usage)
    } catch {
      // Keep what we have; the next poll will catch up.
    }
  }, [])

  React.useEffect(() => {
    const first = setTimeout(reload, 0)
    const timer = setInterval(() => document.visibilityState === "visible" && reload(), POLL)
    return () => (clearTimeout(first), clearInterval(timer))
  }, [reload, trigger])

  return { usage, reload }
}
