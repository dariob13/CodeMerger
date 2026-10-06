"use client"

import * as React from "react"
import { Clock3Icon } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { elapsedDuration } from "@/lib/format"
import type { AssistantMessage } from "@/lib/types"

const currentSecond = () => Math.floor(Date.now() / 1000)
const serverSecond = () => 0
const subscribeClock = (notify: () => void) => {
  const timer = window.setInterval(notify, 1000)
  return () => window.clearInterval(timer)
}

function RunningTimer({ startedAt }: { startedAt: number }) {
  const second = React.useSyncExternalStore(subscribeClock, currentSecond, serverSecond)
  const duration = second ? elapsedDuration(second * 1000 - startedAt) : "0s"
  return <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-normal whitespace-nowrap text-muted-foreground" role="timer" aria-live="off">
    <Spinner className="size-3" aria-hidden="true" />
    <span className="tabular-nums">Working for {duration}</span>
  </span>
}

export function AgentTimer({ message }: { message: AssistantMessage }) {
  if (message.status === "running") return <RunningTimer startedAt={message.ts} />
  if (message.finishedAt == null) return null // older chats have no recorded finish time
  const label = message.status === "done" ? "Worked for" : message.status === "stopped" ? "Stopped after" : "Failed after"
  return <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-normal whitespace-nowrap text-muted-foreground">
    <Clock3Icon className="size-3" aria-hidden="true" />
    <span className="tabular-nums">{label} {elapsedDuration(message.finishedAt - message.ts)}</span>
  </span>
}
