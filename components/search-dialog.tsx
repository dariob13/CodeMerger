"use client"

import * as React from "react"
import { SearchIcon } from "lucide-react"
import { AgentIcon } from "@/components/agent-icon"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { ChatsState } from "@/hooks/use-chats"
import { cn } from "@/lib/utils"

const LIMIT = 30

// Finds a chat or a project by name, across every project.
export function SearchDialog({ state, open, onOpenChange, onPicked }: { state: ChatsState; open: boolean; onOpenChange: (open: boolean) => void; onPicked: () => void }) {
  const [query, setQuery] = React.useState("")
  const [position, setPosition] = React.useState(0)
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (text: string) => words.every((word) => text.toLowerCase().includes(word))
  const results = [
    ...state.projects.filter((p) => words.length && matches(p.name)).map((p) => ({ key: `project:${p.id}`, title: p.name, detail: "Project", agent: null as string | null, pick: () => state.selectProject(p.id) })),
    ...state.chats
      .filter((c) => !c.personaId)
      .map((c) => ({ chat: c, project: state.projects.find((p) => p.id === c.projectId)?.name ?? "" }))
      .filter(({ chat, project }) => matches(`${chat.title} ${project}`))
      .map(({ chat, project }) => ({ key: chat.id, title: chat.title, detail: project, agent: chat.lastAgent, pick: () => state.openChat(chat.id) })),
  ].slice(0, LIMIT)
  const pick = (result: (typeof results)[number] | undefined) => {
    if (!result) return
    result.pick()
    onPicked()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) (setQuery(""), setPosition(0))
        onOpenChange(next)
      }}
    >
      <DialogContent showCloseButton={false} className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">Find a chat or a project.</DialogDescription>
        <label className="flex h-12 items-center gap-2.5 border-b px-4">
          <SearchIcon className="size-4 text-subtle" aria-hidden />
          <input
            autoFocus
            type="search"
            aria-label="Search chats and projects"
            placeholder="Search chats and projects…"
            value={query}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
            onChange={(e) => (setQuery(e.target.value), setPosition(0))}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault()
                setPosition((position + (e.key === "ArrowDown" ? 1 : -1) + results.length) % Math.max(results.length, 1))
              } else if (e.key === "Enter") pick(results[position])
            }}
          />
        </label>
        <ul role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-1.5">
          {!results.length && <li className="px-2.5 py-6 text-center text-sm text-subtle">{words.length ? "Nothing matches" : "No chats yet"}</li>}
          {results.map((result, i) => (
            <li key={result.key} role="option" aria-selected={i === position}>
              <button
                type="button"
                className={cn("flex h-[34px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-sm outline-none", i === position && "bg-accent")}
                onMouseMove={() => setPosition(i)}
                onClick={() => pick(result)}
              >
                {result.agent !== null ? <AgentIcon id={result.agent} className="size-[13px]" /> : <span className="size-3 rounded-[4.5px] bg-foreground" />}
                <span className="min-w-0 flex-1 truncate">{result.title}</span>
                <span className="shrink-0 text-xs text-subtle">{result.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
