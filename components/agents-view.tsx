"use client"

import * as React from "react"
import { PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { AgentIcon } from "@/components/agent-icon"
import { AgentMark, AgentMarkTile } from "@/components/agent-mark"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { PersonaDraft, PersonasState } from "@/hooks/use-personas"
import { agentStatus } from "@/lib/agent-status"
import { relativeTime } from "@/lib/format"
import type { AgentInfo, Persona } from "@/lib/types"
import { cn } from "@/lib/utils"

const count = (n: number) => `${n} ${n === 1 ? "memory" : "memories"}`
const day = (ts: number) => new Date(ts).toLocaleDateString("en", { day: "numeric", month: "short" })

type FormProps = { persona: Persona | null; agents: AgentInfo[]; onSave: (draft: PersonaDraft) => Promise<string | null>; onClose: () => void }

function PersonaForm({ persona, agents, onSave, onClose }: FormProps) {
  const [name, setName] = React.useState(persona?.name ?? "")
  const [duties, setDuties] = React.useState(persona?.duties ?? "")
  const [agentId, setAgentId] = React.useState(persona?.agent ?? agents.find((a) => a.connected)?.id ?? agents[0]?.id ?? "")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const failed = await onSave({ name, duties, agent: agentId })
    setSaving(false)
    if (failed) setError(failed)
    else onClose()
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="flex items-end gap-3">
        <AgentMarkTile name={name || "agent"} />
        <div className="grid flex-1 gap-2">
          <Label htmlFor="persona-name">Name</Label>
          <Input id="persona-name" value={name} maxLength={40} autoFocus placeholder="Reviewer" onChange={(e) => setName(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="persona-duties">Duties</Label>
        <Textarea
          id="persona-duties"
          value={duties}
          rows={5}
          maxLength={4000}
          placeholder="What this agent is responsible for, and how it should go about it."
          onChange={(e) => setDuties(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Sent with every message it answers, so it keeps to them in every chat.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="persona-agent">Runs on</Label>
        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger id="persona-agent" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                  {!a.connected && <span className="text-muted-foreground"> · {agentStatus(a)}</span>}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name.trim() || !agentId}>
          {persona ? "Save changes" : "Create agent"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function Detail({ persona, agents, personas, working, onChat, onEdit, onDelete }: {
  persona: Persona
  agents: AgentInfo[]
  personas: PersonasState
  working: boolean
  onChat: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [fact, setFact] = React.useState("")
  const engine = agents.find((a) => a.id === persona.agent)
  const memories = [...persona.memories].reverse()

  const remember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fact.trim()) return
    const failed = await personas.update(persona.id, { remember: fact })
    if (failed) toast.error(failed)
    else setFact("")
  }

  return (
    <section aria-label={persona.name} className="flex min-h-0 w-full shrink-0 flex-col border-t lg:w-108 lg:border-t-0 lg:border-l">
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-6 p-6">
          <div className="flex items-center gap-3.5">
            <AgentMarkTile name={persona.name} active={working} className="size-14 rounded-2xl" />
            <div className="grid min-w-0 gap-1">
              <h2 className="truncate text-lg font-medium tracking-tight">{persona.name}</h2>
              <p className="flex items-center gap-1.5 text-[13px] text-subtle">
                <AgentIcon id={engine?.id} color={engine?.color} className="size-3" />
                Runs on {engine?.name || persona.agent}
              </p>
            </div>
          </div>

          <div className="grid gap-2.5">
            <h3 className="text-[13px] font-medium text-subtle">Duties</h3>
            <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", persona.duties ? "text-muted-foreground" : "text-subtle")}>
              {persona.duties || "No duties written yet."}
            </p>
          </div>

          <div className="grid gap-2.5">
            <h3 className="flex items-center justify-between text-[13px] font-medium text-subtle">
              Memory
              <span className="font-normal tabular-nums">{persona.memories.length}</span>
            </h3>
            {memories.length > 0 ? (
              <ul className="border-t">
                {memories.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 border-b py-2.5 text-[13px]">
                    <span className="min-w-0 flex-1 text-muted-foreground wrap-anywhere">{m.text}</span>
                    <span className="shrink-0 text-xs text-subtle">{day(m.ts)}</span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Forget: ${m.text}`}
                      onClick={async () => {
                        const failed = await personas.update(persona.id, { forget: m.id })
                        if (failed) toast.error(failed)
                      }}
                    >
                      <XIcon />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-subtle">Nothing yet. {persona.name} adds to this as it works, and you can add to it yourself.</p>
            )}
            <form className="flex gap-2" onSubmit={remember}>
              <Input value={fact} aria-label="Add a memory" placeholder="Add a memory" maxLength={500} onChange={(e) => setFact(e.target.value)} />
              <Button type="submit" variant="outline" size="icon" aria-label="Add memory" disabled={!fact.trim()}>
                <PlusIcon />
              </Button>
            </form>
          </div>
        </div>
      </ScrollArea>
      <div className="flex shrink-0 items-center gap-2 p-4">
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${persona.name}`} onClick={onDelete}>
          <Trash2Icon />
        </Button>
        <Button variant="outline" className="ml-auto" onClick={onEdit}>
          <PencilIcon data-icon="inline-start" />
          Edit agent
        </Button>
        <Button disabled={!engine?.connected} title={engine?.connected ? undefined : `${engine?.name || persona.agent} is not connected`} onClick={onChat}>
          Start a chat
        </Button>
      </div>
    </section>
  )
}

type Props = { personas: PersonasState; agents: AgentInfo[]; working: string | null; onChat: (persona: Persona) => void }

// Agents the user sets up: each keeps its duties and its memory between chats.
export function AgentsView({ personas, agents, working, onChat }: Props) {
  const list = personas.personas
  const [selected, setSelected] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<Persona | "new" | null>(null)
  const [deleting, setDeleting] = React.useState<Persona | null>(null)
  const current = list.find((p) => p.id === selected) || list[0]

  const dialogs = (
    <>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New agent" : `Edit ${editing?.name}`}</DialogTitle>
            <DialogDescription>An agent keeps its duties and its memory in every chat you have with it.</DialogDescription>
          </DialogHeader>
          {editing && (
            <PersonaForm
              key={editing === "new" ? "new" : editing.id}
              persona={editing === "new" ? null : editing}
              agents={agents}
              onSave={(draft) => (editing === "new" ? personas.create(draft) : personas.update(editing.id, draft))}
              onClose={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this agent?"
        description={`“${deleting?.name}”, its duties and its ${count(deleting?.memories.length ?? 0)} will be deleted. Chats it answered are kept.`}
        action="Delete agent"
        onConfirm={async () => {
          const failed = deleting && (await personas.remove(deleting.id))
          if (failed) toast.error(failed)
        }}
        onClose={() => setDeleting(null)}
      />
    </>
  )

  if (!list.length) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AgentMark name="agent" />
          </EmptyMedia>
          <EmptyTitle>No agents yet</EmptyTitle>
          <EmptyDescription>
            Give an agent a name and its duties. It keeps both, and what it learns along the way, in every chat you have with it.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => setEditing("new")}>
            <PlusIcon data-icon="inline-start" />
            New agent
          </Button>
        </EmptyContent>
        {dialogs}
      </Empty>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-2 p-6">
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="text-[13px] text-subtle">Agents keep their duties, and what they learn, between chats.</p>
            <Button size="sm" onClick={() => setEditing("new")}>
              <PlusIcon data-icon="inline-start" />
              New agent
            </Button>
          </div>
          {list.map((p) => {
            const engine = agents.find((a) => a.id === p.agent)
            const active = current?.id === p.id
            return (
              <button
                key={p.id}
                type="button"
                aria-current={active || undefined}
                className={cn("flex gap-3.5 rounded-[14px] border bg-card p-3.5 text-left hover:border-ring/60", active && "border-ring/60 bg-secondary")}
                onClick={() => setSelected(p.id)}
              >
                <AgentMarkTile name={p.name} active={working === p.id} className={active ? "bg-card" : undefined} />
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[15px] font-medium tracking-tight">{p.name}</span>
                    <span className="flex items-center gap-1.5 text-xs text-subtle">
                      <AgentIcon id={engine?.id} color={engine?.color} className="size-3" />
                      {[`Runs on ${engine?.name || p.agent}`, count(p.memories.length), p.lastUsedAt && `active ${relativeTime(p.lastUsedAt)}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className={cn("line-clamp-2 text-[13px] leading-5", p.duties ? "text-muted-foreground" : "text-subtle")}>
                    {p.duties || "No duties written yet."}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </ScrollArea>
      {current && (
        <Detail
          key={current.id}
          persona={current}
          agents={agents}
          personas={personas}
          working={working === current.id}
          onChat={() => onChat(current)}
          onEdit={() => setEditing(current)}
          onDelete={() => setDeleting(current)}
        />
      )}
      {dialogs}
    </div>
  )
}
