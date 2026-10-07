"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type Props = {
  label: string
  width: number
  min: number
  max: number
  edge?: "left" | "right"
  onResize: (width: number | null) => void
  className?: string
}

export function PanelResizeHandle({ label, width, min, max, edge = "right", onResize, className }: Props) {
  const handle = React.useRef<HTMLDivElement>(null)
  const [measuredWidth, setMeasuredWidth] = React.useState(width)
  React.useEffect(() => {
    const panel = handle.current?.parentElement
    if (!panel) return
    const observer = new ResizeObserver(() => setMeasuredWidth(Math.round(panel.getBoundingClientRect().width)))
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])
  const drag = React.useRef<{ x: number; width: number; max: number } | null>(null)
  const [resizing, setResizing] = React.useState(false)
  const direction = edge === "right" ? 1 : -1
  // Reserve space for the conversation, including when several panels are open.
  const limits = (handle: HTMLElement) => {
    const actual = handle.parentElement?.getBoundingClientRect().width ?? width
    const center = Array.from(document.querySelectorAll<HTMLElement>("[data-resize-center]")).map((node) => node.getBoundingClientRect().width).filter((size) => size > 0).at(-1) ?? window.innerWidth - actual
    return { actual, max: Math.max(min, Math.min(max, actual + center - 240)) }
  }
  return <div ref={handle} role="separator" aria-label={`Resize ${label}`} aria-orientation="vertical" aria-valuemin={min} aria-valuemax={max} aria-valuenow={measuredWidth} aria-valuetext={`${measuredWidth} pixels`} tabIndex={0}
    title="Drag to resize · Arrow keys to adjust · Double-click to reset"
    data-resizing={resizing || undefined}
    className={cn("absolute inset-y-0 z-20 w-2 touch-none cursor-col-resize outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 hover:after:bg-ring/60 focus-visible:after:bg-ring data-[resizing]:after:bg-ring", edge === "right" ? "-right-1" : "-left-1", className)}
    onPointerDown={(event) => {
      if (event.button !== 0) return
      event.preventDefault()
      const bounds = limits(event.currentTarget)
      drag.current = { x: event.clientX, width: bounds.actual, max: bounds.max }
      event.currentTarget.setPointerCapture(event.pointerId)
      setResizing(true)
    }}
    onPointerMove={(event) => {
      if (!drag.current) return
      onResize(Math.max(min, Math.min(drag.current.max, drag.current.width + (event.clientX - drag.current.x) * direction)))
    }}
    onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
    onLostPointerCapture={() => { drag.current = null; setResizing(false) }}
    onDoubleClick={() => onResize(null)}
    onKeyDown={(event) => {
      if (event.key === "Enter") { event.preventDefault(); onResize(null); return }
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
      event.preventDefault()
      const bounds = limits(event.currentTarget)
      const next = event.key === "Home" ? min : event.key === "End" ? bounds.max : bounds.actual + (event.key === "ArrowRight" ? 1 : -1) * direction * (event.shiftKey ? 40 : 10)
      onResize(Math.max(min, Math.min(bounds.max, next)))
    }} />
}
