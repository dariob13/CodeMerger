"use client"

import { AgentDot } from "@/components/agent-dot"
import { Progress } from "@/components/ui/progress"
import { resetLabel } from "@/lib/format"
import type { AgentInfo, AgentUsage, UsageWindow } from "@/lib/types"
import { cn } from "@/lib/utils"

const NEAR_LIMIT = 80 // percent

function WindowBar({ agent, window: w }: { agent: AgentInfo; window: UsageWindow }) {
  const used = Math.min(100, Math.max(0, Math.round(w.used)))
  const near = used >= NEAR_LIMIT
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-sidebar-foreground/80">{w.label}</span>
        <span className={cn("truncate text-muted-foreground tabular-nums", near && "text-destructive")}>
          {used}% · {resetLabel(w.resetsAt)}
        </span>
      </div>
      <Progress
        value={used}
        aria-label={`${agent.name} ${w.label} limit: ${used}% used, ${resetLabel(w.resetsAt)}`}
        className={cn("h-1.5 bg-sidebar-accent [&>[data-slot=progress-indicator]]:rounded-full", near ? "[&>[data-slot=progress-indicator]]:bg-destructive" : "[&>[data-slot=progress-indicator]]:bg-(--agent)")}
        style={{ "--agent": agent.color } as React.CSSProperties}
      />
    </div>
  )
}

// Each active agent's rate limits, as its own CLI last reported them.
export function UsageTracker({ agents, usage }: { agents: AgentInfo[]; usage: AgentUsage[] }) {
  const rows = usage.flatMap((u) => {
    const agent = agents.find((a) => a.id === u.agent)
    return agent ? [{ agent, u }] : []
  })
  if (!rows.length) return <p className="px-2 pb-1 text-xs text-muted-foreground">Connect an agent to track its usage.</p>

  return (
    <ul className="grid gap-3 px-2 pb-1">
      {rows.map(({ agent, u }) => (
        <li key={agent.id} className="grid gap-1.5">
          <div className="flex items-center gap-2 text-sm">
            <AgentDot color={agent.color} />
            <span className="truncate font-medium">{agent.name}</span>
            {(u.plan || agent.authDetail) && (
              <span className="ml-auto shrink-0 text-xs text-muted-foreground capitalize">{u.plan || agent.authDetail}</span>
            )}
          </div>
          {u.windows.length ? (
            u.windows.map((w) => <WindowBar key={w.label} agent={agent} window={w} />)
          ) : (
            <p className="text-xs text-muted-foreground">
              No limit data yet · {u.recent.week} {u.recent.week === 1 ? "reply" : "replies"} here this week
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
