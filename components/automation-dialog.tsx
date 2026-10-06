"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { agentStatus } from "@/lib/agent-status"
import type { Access, AgentInfo, Automation, Project, Schedule } from "@/lib/types"

const DEFAULT = "default" // Select items can't have an empty value
const ACCESS_LABELS: Record<Access, string> = { read: "Read-only", edit: "Can edit files", full: "Full access" }

export type AutomationDraft = Pick<Automation, "name" | "prompt" | "agent" | "model" | "effort" | "access" | "projectId" | "schedule">

type Props = {
  open: boolean
  automation: Automation | null // null: creating a new one
  agents: AgentInfo[]
  projects: Project[]
  onSave: (draft: AutomationDraft) => Promise<string | null>
  onClose: () => void
}

function Choice({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || DEFAULT} onValueChange={(v) => onChange(v === DEFAULT ? "" : v)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map(([v, text]) => (
              <SelectItem key={v} value={v || DEFAULT}>
                {text}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function AutomationForm({ automation, agents, projects, onSave, onClose }: Omit<Props, "open">) {
  const installed = agents.filter((a) => a.connected)
  const [name, setName] = React.useState(automation?.name ?? "")
  const [prompt, setPrompt] = React.useState(automation?.prompt ?? "")
  const [agentId, setAgentId] = React.useState(automation?.agent ?? installed[0]?.id ?? "")
  const [model, setModel] = React.useState(automation?.model ?? "")
  const [effort, setEffort] = React.useState(automation?.effort ?? "")
  const [access, setAccess] = React.useState<Access>(automation?.access ?? "read")
  const [projectId, setProjectId] = React.useState(automation?.projectId ?? projects[0]?.id ?? "")
  const [kind, setKind] = React.useState<Schedule["kind"]>(automation?.schedule.kind ?? "daily")
  const [time, setTime] = React.useState(automation?.schedule.kind === "daily" ? automation.schedule.time : "09:00")
  const [minutes, setMinutes] = React.useState(automation?.schedule.kind === "interval" ? String(automation.schedule.minutes) : "60")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const agent = agents.find((a) => a.id === agentId)
  const valid = (options: [string, string][] | undefined, value: string) => (options?.some(([v]) => v === value) ? value : "")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const schedule: Schedule = kind === "daily" ? { kind, time } : kind === "interval" ? { kind, minutes: Number(minutes) } : { kind }
    setSaving(true)
    const problem = await onSave({
      name,
      prompt,
      agent: agentId,
      model: valid(agent?.models, model),
      effort: valid(agent?.efforts, effort),
      access: agent?.access.includes(access) ? access : "read",
      projectId,
      schedule,
    })
    setSaving(false)
    setError(problem)
    if (!problem) onClose()
  }

  return (
    <form onSubmit={submit} className="contents">
      <DialogHeader>
        <DialogTitle>{automation ? "Edit automation" : "New automation"}</DialogTitle>
        <DialogDescription>
          An automation sends your instructions to an agent on a schedule. Each run is a new chat, and the result arrives in your inbox.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="automation-name">Name</Label>
          <Input id="automation-name" value={name} maxLength={80} placeholder="Morning repo summary" autoComplete="off" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="automation-prompt">Instructions</Label>
          <Textarea
            id="automation-prompt"
            value={prompt}
            placeholder="What should the agent do each time this runs?"
            className="max-h-48 min-h-24"
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Choice
            id="automation-agent"
            label="Agent"
            value={agentId}
            options={agents.filter((a) => a.connected || a.id === agentId).map((a) => [a.id, `${a.name} · ${agentStatus(a)}`])}
            onChange={setAgentId}
          />
          <Choice
            id="automation-access"
            label="Permissions"
            value={agent?.access.includes(access) ? access : "read"}
            options={(agent?.access ?? ["read"]).map((level) => [level, ACCESS_LABELS[level]])}
            onChange={(v) => setAccess(v as Access)}
          />
          {agent && agent.models.length > 1 && (
            <Choice id="automation-model" label="Model" value={valid(agent.models, model)} options={agent.models} onChange={setModel} />
          )}
          {agent && agent.efforts.length > 1 && (
            <Choice id="automation-effort" label="Effort" value={valid(agent.efforts, effort)} options={agent.efforts} onChange={setEffort} />
          )}
        </div>

        <Choice id="automation-project" label="Project" value={projectId} options={projects.map((p) => [p.id, p.name])} onChange={setProjectId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Choice
            id="automation-schedule"
            label="Runs"
            value={kind}
            options={[
              ["daily", "Every day at a set time"],
              ["interval", "Repeatedly, every few minutes"],
              ["manual", "Only when I run it"],
            ]}
            onChange={(v) => setKind(v as Schedule["kind"])}
          />
          {kind === "daily" && (
            <div className="grid gap-2">
              <Label htmlFor="automation-time">Time</Label>
              <Input id="automation-time" type="time" value={time} required onChange={(e) => setTime(e.target.value)} />
            </div>
          )}
          {kind === "interval" && (
            <div className="grid gap-2">
              <Label htmlFor="automation-minutes">Minutes between runs</Label>
              <Input id="automation-minutes" type="number" inputMode="numeric" min={5} step={1} value={minutes} required onChange={(e) => setMinutes(e.target.value)} />
            </div>
          )}
        </div>

        {access === "full" && agent?.access.includes("full") && (
          <p className="text-sm text-destructive">With full access, this agent edits files and runs commands on its own each time, with nobody watching.</p>
        )}
        {!projects.length && <p className="text-sm text-destructive">Create a project first: an automation needs a folder to work in.</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name.trim() || !prompt.trim() || !agentId || !projectId}>
          {automation ? "Save changes" : "Create automation"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AutomationDialog({ open, ...form }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && form.onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        {/* Mounted per opening, so the form always starts from the automation being edited (or blank). */}
        {open && <AutomationForm key={form.automation?.id ?? "new"} {...form} />}
      </DialogContent>
    </Dialog>
  )
}
