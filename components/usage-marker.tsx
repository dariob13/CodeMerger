"use client"

import * as React from "react"
import { RefreshCwIcon } from "lucide-react"
import { AgentIcon } from "@/components/agent-icon"
import { Spinner } from "@/components/ui/spinner"
import type { AgentInfo, AgentUsage } from "@/lib/types"

// "2h 12m", "6d 21h": how long until a limit starts over.
function timeLeft(resetsAt: number, now: number) {
  const minutes = Math.max(0, Math.round((resetsAt - now) / 60_000))
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  return `${minutes}m`
}

type Props = { agent: AgentInfo; usage: AgentUsage | undefined; onReload: () => Promise<void> }

// The selected agent's limits in one line under the composer: how much of each is used, and when it resets.
export function UsageMarker({ agent, usage, onReload }: Props) {
  const [reloading, setReloading] = React.useState(false)
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const windows = usage?.windows ?? []
  return (
    <footer className="flex h-7 shrink-0 items-center gap-2 border-t px-3 text-xs text-muted-foreground" aria-label={`${agent.name} usage`}>
      <AgentIcon id={agent.id} color={agent.color} className="size-3" />
      {windows.length > 0 ? (
        <>
          <span className="h-1 w-8 overflow-hidden rounded-full bg-foreground/15" aria-hidden>
            <span className="block h-full rounded-full bg-muted-foreground" style={{ width: `${Math.min(windows[0].used, 100)}%` }} />
          </span>
          {windows.map((w, i) => (
            <span key={w.label} className="tabular-nums" title={`${w.label} limit: ${Math.round(w.used)}% used${w.resetsAt ? `, resets in ${timeLeft(w.resetsAt, now)}` : ""}`}>
              {i > 0 && <span className="pr-2 text-subtle">·</span>}
              {Math.round(w.used)}%{w.resetsAt > 0 && <span className="text-subtle"> {timeLeft(w.resetsAt, now)}</span>}
            </span>
          ))}
        </>
      ) : (
        <span className="text-subtle">{usage ? `No limit data yet · ${usage.recent.week} ${usage.recent.week === 1 ? "reply" : "replies"} this week` : "No limit data"}</span>
      )}
      <button
        type="button"
        title="Refresh usage"
        aria-label="Refresh usage"
        disabled={reloading}
        className="grid size-5 place-items-center rounded-sm text-subtle outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3"
        onClick={async () => {
          setReloading(true)
          await onReload()
          setReloading(false)
        }}
      >
        {reloading ? <Spinner /> : <RefreshCwIcon aria-hidden />}
      </button>
    </footer>
  )
}
