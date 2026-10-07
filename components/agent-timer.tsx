"use client"

import * as React from "react"
import { Clock3Icon } from "lucide-react"
import { elapsedDuration } from "@/lib/format"
import type { AssistantMessage } from "@/lib/types"

const currentSecond = () => Math.floor(Date.now() / 1000)
const serverSecond = () => 0
const subscribeClock = (notify: () => void) => {
  const timer = window.setInterval(notify, 1000)
  return () => window.clearInterval(timer)
}

function RunningTimer({ startedAt, name }: { startedAt: number; name: string }) {
  const second = React.useSyncExternalStore(subscribeClock, currentSecond, serverSecond)
  const seconds = second ? Math.max(0, Math.floor((second * 1000 - startedAt) / 1000)) : 0
  return <span className="agent-working-text min-w-0 font-normal tabular-nums" role="timer" aria-live="off">
    {name} has been working for {seconds} {seconds === 1 ? "second" : "seconds"}.
  </span>
}

export function AgentTimer({ message, name }: { message: AssistantMessage; name: string }) {
  if (message.status === "running") return <RunningTimer startedAt={message.ts} name={name} />
  if (message.finishedAt == null) return null // older chats have no recorded finish time
  const label = message.status === "done" ? "Worked for" : message.status === "stopped" ? "Stopped after" : "Failed after"
  return <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-normal whitespace-nowrap text-muted-foreground">
    <Clock3Icon className="size-3" aria-hidden="true" />
    <span className="tabular-nums">{label} {elapsedDuration(message.finishedAt - message.ts)}</span>
  </span>
}
