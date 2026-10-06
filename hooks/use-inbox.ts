"use client"

import * as React from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { InboxItem } from "@/lib/types"

const POLL = 15_000
const fail = (err: unknown) => toast.error(err instanceof Error ? err.message : String(err))

// The inbox, kept fresh in the background. onArrival fires when a new item shows up.
export function useInbox(onArrival: () => void) {
  const [items, setItems] = React.useState<InboxItem[]>([])
  const newest = React.useRef<string | null | undefined>(undefined)
  const arrival = React.useRef(onArrival)
  React.useEffect(() => {
    arrival.current = onArrival
  }, [onArrival])

  const reload = React.useCallback(async () => {
    try {
      const { items } = await api<{ items: InboxItem[] }>("inbox")
      setItems(items)
      const first = items[0]?.id ?? null
      if (newest.current !== undefined && first && first !== newest.current) arrival.current()
      newest.current = first
    } catch {
      // The server is restarting or unreachable; the next poll will catch up.
    }
  }, [])

  React.useEffect(() => {
    const first = setTimeout(reload, 0)
    const timer = setInterval(() => document.visibilityState === "visible" && reload(), POLL)
    return () => (clearTimeout(first), clearInterval(timer))
  }, [reload])

  const markRead = React.useCallback((id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)))
    api(`inbox/${id}`, { method: "PATCH", body: { read: true } }).catch(fail)
  }, [])

  const markAllRead = React.useCallback(() => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })))
    api("inbox", { method: "PATCH" }).catch(fail)
  }, [])

  const remove = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    api(`inbox/${id}`, { method: "DELETE" }).catch(fail)
  }, [])

  const unread = React.useMemo(() => items.filter((item) => !item.read).length, [items])
  return { items, unread, reload, markRead, markAllRead, remove }
}

export type InboxState = ReturnType<typeof useInbox>
