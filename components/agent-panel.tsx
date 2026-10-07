"use client"

import * as React from "react"
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { AgentMarkTile } from "@/components/agent-mark"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { PersonaDraft, PersonasState } from "@/hooks/use-personas"
import { agentStatus } from "@/lib/agent-status"
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

type DialogProps = { editing: Persona | "new" | null; agents: AgentInfo[]; personas: PersonasState; onClose: () => void }

// Sets up a new agent, or edits one.
export function AgentDialog({ editing, agents, personas, onClose }: DialogProps) {
  return (
    <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing === "new" ? "New agent" : `Edit ${editing?.name}`}</DialogTitle>
          <DialogDescription>An agent keeps its duties and its memory, and has its own chat in every project.</DialogDescription>
        </DialogHeader>
        {editing && (
          <PersonaForm
            key={editing === "new" ? "new" : editing.id}
            persona={editing === "new" ? null : editing}
            agents={agents}
            onSave={(draft) => (editing === "new" ? personas.create(draft) : personas.update(editing.id, draft))}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

type PanelProps = { persona: Persona; personas: PersonasState; onDeleted: (id: string) => void; className?: string }

// What an agent keeps between messages, beside its chat: its duties and its memory.
export function AgentPanel({ persona, personas, onDeleted, className }: PanelProps) {
  const [fact, setFact] = React.useState("")
  const [deleting, setDeleting] = React.useState(false)
  const memories = [...persona.memories].reverse()

  const remember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fact.trim()) return
    const failed = await personas.update(persona.id, { remember: fact })
    if (failed) toast.error(failed)
    else setFact("")
  }

  return (
    <section aria-label={`${persona.name}: duties and memory`} className={cn("flex min-h-0 flex-col", className)}>
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-6 p-6">
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
      <div className="flex shrink-0 p-4">
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setDeleting(true)}>
          <Trash2Icon data-icon="inline-start" />
          Delete agent
        </Button>
      </div>
      <ConfirmDialog
        open={deleting}
        title="Delete this agent?"
        description={`“${persona.name}”, its duties and its ${count(persona.memories.length)} will be deleted. Its chats are kept as ordinary chats.`}
        action="Delete agent"
        onConfirm={async () => {
          const failed = await personas.remove(persona.id)
          if (failed) toast.error(failed)
          else onDeleted(persona.id)
        }}
        onClose={() => setDeleting(false)}
      />
    </section>
  )
}
