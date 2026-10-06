"use client"

import * as React from "react"
import { PencilIcon, PlayIcon, PlusIcon, Trash2Icon, WorkflowIcon } from "lucide-react"
import { toast } from "sonner"
import { AgentDot } from "@/components/agent-dot"
import { AutomationDialog, type AutomationDraft } from "@/components/automation-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api } from "@/lib/api"
import { relativeTime, scheduleLabel } from "@/lib/format"
import type { AgentInfo, Automation, ChatSummary, Project } from "@/lib/types"

const POLL = 15_000
const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

type Props = { agents: AgentInfo[]; projects: Project[]; onRunStarted: (chat: ChatSummary) => void }

export function AutomationsView({ agents, projects, onRunStarted }: Props) {
  const [automations, setAutomations] = React.useState<Automation[] | null>(null)
  const [editing, setEditing] = React.useState<Automation | "new" | null>(null)
  const [deleting, setDeleting] = React.useState<Automation | null>(null)

  const reload = React.useCallback(async () => {
    try {
      setAutomations((await api<{ automations: Automation[] }>("automations")).automations)
    } catch {
      setAutomations((prev) => prev ?? [])
    }
  }, [])
  // Polled so "last ran" and "next run" stay current while the page is open.
  React.useEffect(() => {
    const first = setTimeout(reload, 0)
    const timer = setInterval(() => document.visibilityState === "visible" && reload(), POLL)
    return () => (clearTimeout(first), clearInterval(timer))
  }, [reload])

  const replace = (automation: Automation) => setAutomations((prev) => (prev || []).map((a) => (a.id === automation.id ? automation : a)))

  const save = async (draft: AutomationDraft) => {
    try {
      if (editing && editing !== "new") {
        replace((await api<{ automation: Automation }>(`automations/${editing.id}`, { method: "PATCH", body: draft })).automation)
      } else {
        const { automation } = await api<{ automation: Automation }>("automations", { method: "POST", body: draft })
        setAutomations((prev) => [automation, ...(prev || [])])
      }
      return null
    } catch (err) {
      return message(err)
    }
  }

  const toggle = async (automation: Automation, enabled: boolean) => {
    replace({ ...automation, enabled })
    try {
      replace((await api<{ automation: Automation }>(`automations/${automation.id}`, { method: "PATCH", body: { enabled } })).automation)
    } catch (err) {
      replace(automation)
      toast.error(message(err))
    }
  }

  const run = async (automation: Automation) => {
    try {
      const res = await api<{ automation: Automation; chat: ChatSummary }>(`automations/${automation.id}/run`, { method: "POST" })
      replace(res.automation)
      onRunStarted(res.chat)
      toast.success(`${automation.name} is running. The result will arrive in your inbox.`)
    } catch (err) {
      toast.error(message(err))
    }
  }

  const remove = async (automation: Automation) => {
    try {
      await api(`automations/${automation.id}`, { method: "DELETE" })
      setAutomations((prev) => (prev || []).filter((a) => a.id !== automation.id))
    } catch (err) {
      toast.error(message(err))
    }
  }

  const status = (a: Automation) =>
    [
      scheduleLabel(a.schedule),
      a.schedule.kind !== "manual" && (a.enabled ? a.nextRunAt && `next run ${relativeTime(a.nextRunAt)}` : "paused"),
      a.lastRunAt ? `last ran ${relativeTime(a.lastRunAt)}` : "never run",
    ]
      .filter(Boolean)
      .join(" · ")

  const dialogs = (
    <>
      <AutomationDialog
        open={Boolean(editing)}
        automation={editing === "new" ? null : editing}
        agents={agents}
        projects={projects}
        onSave={save}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this automation?"
        description={`“${deleting?.name}” will stop running and be deleted. Chats and inbox items from its past runs are kept.`}
        action="Delete automation"
        onConfirm={() => deleting && remove(deleting)}
        onClose={() => setDeleting(null)}
      />
    </>
  )

  if (automations && !automations.length) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WorkflowIcon />
          </EmptyMedia>
          <EmptyTitle>No automations yet</EmptyTitle>
          <EmptyDescription>
            Write instructions once and have an agent carry them out on a schedule. Results arrive in your inbox.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => setEditing("new")}>
            <PlusIcon data-icon="inline-start" />
            New automation
          </Button>
        </EmptyContent>
        {dialogs}
      </Empty>
    )
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pt-2 pb-8">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Automations run while Code Merger is running on this computer.</p>
          <Button size="sm" onClick={() => setEditing("new")}>
            <PlusIcon data-icon="inline-start" />
            New automation
          </Button>
        </div>
        <ItemGroup className="gap-2">
          {(automations || []).map((a) => {
            const agent = agents.find((x) => x.id === a.agent)
            return (
              <Item key={a.id} variant="outline" className="glass items-start rounded-2xl">
                <ItemMedia className="pt-1.5">
                  <AgentDot color={agent?.connected ? agent.color : undefined} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {a.name}
                    <span className="text-xs font-normal text-muted-foreground">
                      {agent?.name || a.agent} · {projects.find((p) => p.id === a.projectId)?.name || "Project deleted"}
                    </span>
                  </ItemTitle>
                  <ItemDescription className="line-clamp-2">{a.prompt}</ItemDescription>
                  <p className="text-xs text-muted-foreground">{status(a)}</p>
                </ItemContent>
                <ItemActions>
                  {a.schedule.kind !== "manual" && (
                    <Switch checked={a.enabled} aria-label={`Run ${a.name} on its schedule`} onCheckedChange={(checked) => toggle(a, checked)} />
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Run ${a.name} now`} onClick={() => run(a)}>
                        <PlayIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Run now</TooltipContent>
                  </Tooltip>
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${a.name}`} onClick={() => setEditing(a)}>
                    <PencilIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${a.name}`} onClick={() => setDeleting(a)}>
                    <Trash2Icon />
                  </Button>
                </ItemActions>
              </Item>
            )
          })}
        </ItemGroup>
      </div>
      {dialogs}
    </ScrollArea>
  )
}
