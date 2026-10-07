"use client"

import * as React from "react"
import { Collapsible } from "radix-ui"
import { useSettings } from "@/hooks/use-settings"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { commandGroupSummary } from "@/lib/command-groups"
import { elapsedDuration } from "@/lib/format"
import type { ToolPart } from "@/lib/types"
import { cn } from "@/lib/utils"

type IconName = "check" | "row-spinner" | "row-error" | "chevron-right" | "chevron-down" | "spinner" | "terminal" | "error"

function CommandIcon({ name, className }: { name: IconName; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- use Figma's original vectors at their native dimensions
  return <img src={`/command-group/${name}.svg`} alt="" aria-hidden="true" className={cn("shrink-0", className)} />
}

function CommandRow({ tool }: { tool: ToolPart }) {
  return <div role="listitem" className="flex h-[25px] min-w-0 shrink-0 items-center gap-2 py-[3px]" data-command-status={tool.status}>
    <CommandIcon name={tool.status === "running" ? "row-spinner" : tool.status === "error" ? "row-error" : "check"} className={tool.status === "running" ? "motion-safe:animate-spin" : undefined} />
    <span className="sr-only">{tool.status === "running" ? "Running" : tool.status === "error" ? "Failed" : "Done"}</span>
    <Badge variant="outline" className={cn("h-auto max-w-[40%] rounded-[6px] px-1.5 py-px font-mono text-[11px] leading-normal font-normal", tool.status === "error" ? "border-destructive text-destructive" : "text-muted-foreground")} title={tool.name}><span className="truncate">{tool.name}</span></Badge>
    <Tooltip><TooltipTrigger asChild><span tabIndex={0} className={cn("min-w-0 flex-1 truncate rounded-sm font-mono text-xs leading-normal outline-none focus-visible:ring-2 focus-visible:ring-ring", tool.status === "running" ? "text-muted-foreground" : "text-subtle")} title={tool.detail}>{tool.detail || tool.name}</span></TooltipTrigger><TooltipContent side="top" className="max-w-[min(640px,90vw)] font-mono break-words whitespace-pre-wrap">{tool.detail || tool.name}</TooltipContent></Tooltip>
  </div>
}

export function CommandGroup({ tools }: { tools: ToolPart[] }) {
  const { foldCommands } = useSettings()
  const [open, setOpen] = React.useState(!foldCommands)
  const summary = commandGroupSummary(tools)
  const running = summary.status === "running"
  const title = running ? "Running" : `Ran ${tools.length} ${tools.length === 1 ? "command" : "commands"}`
  const meta = running ? summary.runningTool.detail || summary.runningTool.name : summary.failed ? `${summary.failed} failed` : summary.names

  return <Collapsible.Root open={open} onOpenChange={setOpen} className="command-group my-3 min-w-0 overflow-hidden rounded-[10px] border bg-card tracking-normal" data-command-group-status={summary.status}>
    <Collapsible.Trigger asChild>
      <Button variant="ghost" className="h-[34px] w-full min-w-0 justify-start gap-2 rounded-none border-0 px-2.5 py-0 text-left font-normal hover:bg-card focus-visible:ring-inset" aria-label={`${open ? "Collapse" : "Expand"} ${title.toLowerCase()}${summary.failed ? `, ${summary.failed} failed` : ""}`}>
        <CommandIcon name={open ? "chevron-down" : "chevron-right"} />
        <CommandIcon name={running ? "spinner" : summary.failed ? "error" : "terminal"} className={running ? "motion-safe:animate-spin" : undefined} />
        <span className="shrink-0 text-[13px] leading-normal font-medium">{title}</span>
        <span className={cn("min-w-0 flex-1 truncate text-xs leading-normal", running && "font-mono", !running && summary.failed ? "text-destructive" : "text-subtle")} title={meta}>{meta}</span>
        <span className="shrink-0 font-mono text-[11px] leading-normal text-subtle">{running ? `${summary.runningIndex + 1} of ${tools.length}` : summary.duration == null ? "" : elapsedDuration(summary.duration)}</span>
      </Button>
    </Collapsible.Trigger>
    <Collapsible.Content>
      <div role="list" aria-label="Agent commands" tabIndex={0} className="flex max-h-[229px] min-w-0 flex-col gap-0.5 overflow-y-auto overscroll-contain border-t px-2.5 pt-1.5 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        {tools.map((tool) => <CommandRow key={tool.id} tool={tool} />)}
      </div>
    </Collapsible.Content>
  </Collapsible.Root>
}
