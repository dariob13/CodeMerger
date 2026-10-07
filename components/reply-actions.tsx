"use client"

import * as React from "react"
import { CheckIcon, CopyIcon, CornerUpRightIcon, RotateCcwIcon } from "lucide-react"
import { AgentIcon } from "@/components/agent-icon"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import type { AgentInfo } from "@/lib/types"

// Where a reply can be handed off to: a new chat with one of the agents, or a chat already open in a tab.
export type HandoffTarget = { agent: string } | { tabKey: string }
export type Handoffs = {
  agents: AgentInfo[]
  chats: { tabKey: string; title: string; agent: AgentInfo | undefined; running: boolean }[]
}

type Props = {
  text: string // the reply, as the agent wrote it
  from: string // who wrote it
  handoffs: Handoffs
  onHandOff: (reply: { text: string; from: string }, target: HandoffTarget) => void
  onRetry?: () => void // only the chat's last reply can be run again
}

const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-px border-b p-1.5">
    <p className="flex h-6.5 items-center px-2 text-xs font-medium text-subtle">{label}</p>
    {children}
  </div>
)

const Destination = ({ children, ...props }: React.ComponentProps<"button">) => (
  <button
    type="button"
    className="flex h-7.5 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
    {...props}
  >
    {children}
  </button>
)

// What can be done with a finished reply: copy it, give it to another chat, or have the agent answer again.
export function ReplyActions({ text, from, handoffs, onHandOff, onRetry }: Props) {
  const [copied, setCopied] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const handOff = (target: HandoffTarget) => {
    setOpen(false)
    onHandOff({ text, from }, target)
  }

  return (
    <footer className="mt-1.5 -mr-2 flex justify-end gap-0.5">
      {text && (
        <Button
          variant="ghost"
          size="xs"
          className={copied ? "bg-accent text-foreground" : "font-normal text-muted-foreground"}
          onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => {})}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy"}
        </Button>
      )}
      {text && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="xs" className="font-normal text-muted-foreground data-[state=open]:bg-accent data-[state=open]:font-medium data-[state=open]:text-foreground">
              <CornerUpRightIcon />
              Hand off
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" side="top" sideOffset={6} className="w-[300px] gap-0 overflow-hidden rounded-xl p-0">
            <Group label="Hand off this reply to a new chat">
              {handoffs.agents.map((a) => (
                <Destination key={a.id} onClick={() => handOff({ agent: a.id })}>
                  <AgentIcon id={a.id} color={a.color} />
                  <span className="truncate">{a.name}</span>
                </Destination>
              ))}
            </Group>
            {handoffs.chats.length > 0 && (
              <Group label="Or an open chat">
                {handoffs.chats.map((c) => (
                  <Destination key={c.tabKey} onClick={() => handOff({ tabKey: c.tabKey })}>
                    <AgentIcon id={c.agent?.id} color={c.agent?.color} />
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    {c.running && <Spinner className="size-3 shrink-0" aria-label="Replying" />}
                  </Destination>
                ))}
              </Group>
            )}
            <p className="px-3.5 pt-2 pb-2.5 text-[11px] leading-[15px] text-subtle">The reply goes along as a file. You write the next message.</p>
          </PopoverContent>
        </Popover>
      )}
      {onRetry && (
        <Button variant="ghost" size="xs" className="font-normal text-muted-foreground" onClick={onRetry}>
          <RotateCcwIcon />
          Retry
        </Button>
      )}
    </footer>
  )
}
