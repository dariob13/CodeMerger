"use client"

import * as React from "react"
import { GaugeIcon, RefreshCwIcon } from "lucide-react"
import { AgentIcon } from "@/components/agent-icon"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import { relativeTime } from "@/lib/format"
import type { AgentInfo, AgentUsage, UsageWindow } from "@/lib/types"

const LOW = 10 // percent left at which a limit is shown as nearly out

// "2h 12m", "6d 21h": how long until a limit starts over.
function timeLeft(resetsAt: number, now: number) {
  const minutes = Math.max(0, Math.round((resetsAt - now) / 60_000))
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  return `${minutes}m`
}

const left = (w: UsageWindow) => Math.min(100, Math.max(0, Math.round(100 - w.used)))

type Props = { agent: AgentInfo | undefined; usage: AgentUsage | undefined; onReload: () => Promise<void> }

// The sidebar's Usage row. It opens a panel with what is left of each of the selected agent's limits, and when each resets.
export function UsagePanel({ agent, usage, onReload }: Props) {
  const [reloading, setReloading] = React.useState(false)
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const windows = usage?.windows ?? []
  return (
    <Popover>
      <PopoverTrigger asChild>
        <SidebarMenuButton className="h-[34px] gap-2.5 rounded-[10px] px-2.5 text-muted-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-foreground">
          <GaugeIcon />
          <span className="flex-1">Usage</span>
          {windows.length > 0 && (
            <span className={`text-xs tabular-nums ${left(windows[0]) <= LOW ? "text-destructive" : "text-subtle"}`}>{left(windows[0])}% left</span>
          )}
        </SidebarMenuButton>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" sideOffset={8} className="w-70 gap-3.5 rounded-xl p-3.5 shadow-none" aria-label={agent ? `${agent.name} usage` : "Usage"}>
        <div className="flex items-center gap-2">
          <AgentIcon id={agent?.id} color={agent?.color} className="size-3.5" />
          <span className="truncate font-medium">{agent?.name ?? "Usage"}</span>
          {usage?.plan && <span className="text-xs text-subtle">{usage.plan}</span>}
          <Button
            variant="ghost"
            size="icon-xs"
            className="ml-auto"
            title="Refresh usage"
            aria-label="Refresh usage"
            disabled={reloading}
            onClick={async () => {
              setReloading(true)
              await onReload()
              setNow(Date.now())
              setReloading(false)
            }}
          >
            {reloading ? <Spinner /> : <RefreshCwIcon />}
          </Button>
        </div>
        {windows.length > 0 ? (
          <>
            {windows.map((w) => {
              const low = left(w) <= LOW
              return (
                <div key={w.label} className="grid gap-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground first-letter:uppercase">{w.label}</span>
                    <span className={`font-medium tabular-nums ${low ? "text-destructive" : ""}`}>{left(w)}% left</span>
                  </div>
                  <span className="h-1.5 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
                    <span className={`block h-full rounded-full ${low ? "bg-destructive" : "bg-muted-foreground"}`} style={{ width: `${left(w)}%` }} />
                  </span>
                  {w.resetsAt > 0 && <span className="text-[11px] text-subtle">Resets in {timeLeft(w.resetsAt, now)}</span>}
                </div>
              )
            })}
            <p className="text-[11px] text-subtle">{reloading ? "Refreshing…" : usage?.updatedAt ? `Updated ${relativeTime(usage.updatedAt, now)}` : null}</p>
          </>
        ) : (
          <p className="text-xs text-subtle">
            {agent ? `No limit data yet. Send ${agent.name} a message, then refresh.` : "No agent is connected yet."}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
