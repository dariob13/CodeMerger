"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon, RefreshCwIcon, SearchIcon, ShieldAlertIcon } from "lucide-react"
import { AgentIcon } from "@/components/agent-icon"
import { AgentMark } from "@/components/agent-mark"
import { InputGroupButton } from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import type { ChatsState } from "@/hooks/use-chats"
import type { Access, Persona } from "@/lib/types"
import { cn } from "@/lib/utils"

export const ACCESS: Record<Access, { label: string; hint: string }> = {
  read: { label: "Read-only", hint: "Reads the folder and answers" },
  edit: { label: "Edit files", hint: "Creates and edits files in the folder" },
  full: { label: "Full access", hint: "Edits and runs commands without asking" },
}
const SEARCH_FROM = 7 // models before the list gets a search field

type Props = {
  state: ChatsState
  personas: Persona[]
  persona: Persona | undefined // the user's own agent that is answering, if any
  model: string
  effort: string
  access: Access
}

// One choice in a list: the agent or the model.
function Row({ selected, className, children, ...props }: React.ComponentProps<"button"> & { selected: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={cn(
        "flex h-7 w-full shrink-0 items-center gap-2 rounded-md px-2 text-left text-[13px] text-muted-foreground outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:text-subtle",
        selected && "bg-accent font-medium text-foreground hover:bg-accent",
        className
      )}
      {...props}
    >
      {children}
      {selected && <CheckIcon className="ml-auto size-3 shrink-0" aria-hidden />}
    </button>
  )
}

const Label = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex h-7 shrink-0 items-center pr-1 pl-2 text-xs font-medium text-subtle">
    <p className="flex-1">{children}</p>
    {action}
  </div>
)

// Looks again for the agent CLIs on this machine, for one installed or signed in since the app started.
function Recheck({ recheck }: { recheck: () => Promise<unknown> }) {
  const [checking, setChecking] = React.useState(false)
  return (
    <button
      type="button"
      title="Recheck agents"
      aria-label="Recheck agents"
      disabled={checking}
      className="grid size-5 place-items-center rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3"
      onClick={async () => {
        setChecking(true)
        await recheck()
        setChecking(false)
      }}
    >
      {checking ? <Spinner /> : <RefreshCwIcon aria-hidden />}
    </button>
  )
}

function Models({ options, value, agentName, onChange }: { options: [string, string][]; value: string; agentName: string; onChange: (value: string) => void }) {
  const [query, setQuery] = React.useState("")
  const shown = options.filter(([, label]) => label.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2">
      {options.length >= SEARCH_FROM ? (
        <label className="flex h-7 shrink-0 items-center gap-2 rounded-md border bg-background px-2 text-subtle focus-within:border-ring">
          <SearchIcon className="size-3.5 shrink-0" aria-hidden />
          <input
            type="search"
            value={query}
            aria-label={`Search ${agentName} models`}
            placeholder={`Search ${options.length - 1} ${agentName} models…`}
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-subtle"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      ) : (
        <Label>Model</Label>
      )}
      <div role="radiogroup" aria-label="Model" className="flex max-h-[202px] flex-col gap-px overflow-y-auto">
        {shown.map(([v, label]) => (
          <Row key={v} selected={v === value} onClick={() => onChange(v)}>
            <span className="truncate">{label}</span>
          </Row>
        ))}
        {!shown.length && <p className="px-2 py-1.5 text-xs text-subtle">No models match</p>}
      </div>
    </div>
  )
}

// The agent, its model, how hard it thinks and what it may touch, all in one panel.
export function AgentPicker({ state, personas, persona, model, effort, access }: Props) {
  const { agents, agent, pick, setPick, recheck } = state
  const effortIndex = Math.max(agent?.efforts.findIndex(([v]) => v === effort) ?? 0, 0)
  const labelOf = (options: [string, string][] | undefined, value: string) => (value && options?.find(([v]) => v === value)?.[1]) || ""
  const choices = agent ? [labelOf(agent.models, model), labelOf(agent.efforts, effort), ACCESS[access].label].filter(Boolean).join(" · ") : ""
  const name = agent ? (persona?.name ?? agent.short) : "No agent"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <InputGroupButton variant="ghost" size="sm" className="min-w-0 shrink" aria-label={`Agent, model, effort and access: ${name}${choices && `, ${choices}`}`}>
          {persona ? <AgentMark name={persona.name} className="size-3.5" /> : agent && <AgentIcon id={agent.id} color={agent.color} />}
          <span className="shrink-0">{name}</span>
          <span className="truncate font-normal text-muted-foreground">{choices}</span>
          {access === "full" && <ShieldAlertIcon className="text-destructive" aria-label="Full access" />}
          <ChevronDownIcon className="text-muted-foreground" />
        </InputGroupButton>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" sideOffset={8} className="w-[400px] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-xl p-0">
        <div className="flex">
          <div className="flex max-h-[258px] w-41 shrink-0 flex-col gap-px overflow-y-auto border-r p-2">
            {personas.length > 0 && (
              <>
                <Label>Your agents</Label>
                <div role="radiogroup" aria-label="Your agents" className="flex flex-col gap-px">
                  {personas.map((p) => {
                    const engine = agents.find((a) => a.id === p.agent)
                    return (
                      <Row
                        key={p.id}
                        selected={persona?.id === p.id}
                        disabled={!engine?.connected}
                        title={`On ${engine?.name || p.agent}`}
                        onClick={() => setPick({ persona: p.id, agent: p.agent })}
                      >
                        <AgentMark name={p.name} className="size-3.5" />
                        <span className="truncate">{p.name}</span>
                      </Row>
                    )
                  })}
                </div>
              </>
            )}
            <Label action={<Recheck recheck={recheck} />}>{personas.length ? "Coding agents" : "Agent"}</Label>
            <div role="radiogroup" aria-label="Agent" className="flex flex-col gap-px">
              {agents.map((a) => (
                <Row key={a.id} selected={!persona && agent?.id === a.id} disabled={!a.connected} onClick={() => setPick({ agent: a.id, persona: "" })}>
                  <AgentIcon id={a.id} color={a.connected ? a.color : undefined} />
                  <span className="truncate">{a.name}</span>
                  {!a.connected && <span className="ml-auto shrink-0 text-[11px]">Set up</span>}
                  {a.connected && a.auth === "none" && <span className="ml-auto shrink-0 text-[11px] font-normal text-destructive">Sign in</span>}
                </Row>
              ))}
            </div>
          </div>
          {agent && (
            <Models
              key={agent.id}
              options={agent.models}
              value={model}
              agentName={agent.short}
              onChange={(value) => setPick({ models: { ...pick.models, [agent.id]: value } })}
            />
          )}
        </div>

        {agent && agent.efforts.length > 1 && (
          <div className="flex h-11 items-center gap-3 border-t pr-3.5 pl-4">
            <span className="w-11 shrink-0 text-xs font-medium text-subtle">Effort</span>
            <Slider
              aria-label="Effort"
              // The popover is the same shade as the default track.
              // The thumb and the filled part glide to the new level instead of jumping.
              className="*:transition-[left] *:duration-200 *:ease-out **:data-[slot=slider-range]:transition-[right] **:data-[slot=slider-range]:duration-200 **:data-[slot=slider-range]:ease-out motion-reduce:*:transition-none motion-reduce:**:data-[slot=slider-range]:transition-none **:data-[slot=slider-track]:bg-foreground/15"
              min={0}
              max={agent.efforts.length - 1}
              step={1}
              value={[effortIndex]}
              onValueChange={([index]) => setPick({ efforts: { ...pick.efforts, [agent.id]: agent.efforts[index][0] } })}
            />
            {/* Keyed by level, so each new label fades in. */}
            <span key={effortIndex} className="w-18 shrink-0 animate-in text-right text-xs font-medium duration-200 fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none">
              {agent.efforts[effortIndex][1].replace(/ effort$/, "")}
            </span>
          </div>
        )}

        {agent && (
          <div className="flex h-12 items-center gap-3 border-t pr-2.5 pl-4">
            <span className="w-11 shrink-0 text-xs font-medium text-subtle">Access</span>
            <div role="radiogroup" aria-label="Access" className="flex flex-1 gap-0.5 rounded-[9px] border bg-background p-[3px]">
              {agent.access.map((level) => (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={level === access}
                  title={ACCESS[level].hint}
                  className={cn(
                    "h-6 flex-1 rounded-md text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                    level === access && "bg-accent font-medium text-foreground",
                    level === access && level === "full" && "text-destructive hover:text-destructive"
                  )}
                  onClick={() => setPick({ access: level })}
                >
                  {ACCESS[level].label}
                </button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
