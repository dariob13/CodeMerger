"use client"

import * as React from "react"

/** Restore after hydration so server and client render the same initial layout. */
export function usePanelWidth(name: string, min: number, max: number) {
  const key = `code-merger.panel-width.${name}`
  const [width, setWidth] = React.useState<number | null>(null)
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem(key)
        const value = Number(saved)
        if (saved !== null && Number.isFinite(value)) setWidth(Math.min(max, Math.max(min, value)))
      } catch { /* Resizing still works when browser storage is unavailable. */ }
    })
    return () => cancelAnimationFrame(frame)
  }, [key, min, max])
  const resize = React.useCallback((value: number | null) => {
    const next = value === null ? null : Math.round(Math.min(max, Math.max(min, value)))
    setWidth(next)
    try {
      if (next === null) localStorage.removeItem(key)
      else localStorage.setItem(key, String(next))
    } catch { /* Keep the current size for this session. */ }
  }, [key, min, max])
  return { width, resize }
}
