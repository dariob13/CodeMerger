"use client"

import * as React from "react"
import { PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"
import { AgentIcon } from "@/components/agent-icon"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import type { ChatsState } from "@/hooks/use-chats"
import { shortAge } from "@/lib/format"
import type { ChatSummary } from "@/lib/types"
import { cn } from "@/lib/utils"

// The open project's chats, in a column beside the conversation.
export function WorkspacePanel({ state }: { state: ChatsState }) {
  const { agents, project, chats, chat, newChat, openChat, deleteChat } = state
  const [query, setQuery] = React.useState("")
  const [pendingDelete, setPendingDelete] = React.useState<ChatSummary | null>(null)
  const own = chats.filter((c) => c.projectId === project?.id)
  const shown = own.filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <aside className="hidden w-68 shrink-0 flex-col border-r lg:flex" aria-label="Workspace">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b pr-2 pl-4">
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium tracking-tight">Workspace</h2>
        <Button variant="ghost" size="icon-sm" aria-label="New chat" title="New chat" onClick={newChat}>
          <PlusIcon />
        </Button>
      </header>

      <label className="flex h-11 shrink-0 items-center gap-2 border-b px-4 text-subtle focus-within:text-foreground">
        <SearchIcon className="size-3.5 shrink-0" aria-hidden />
        <input
          type="search"
          value={query}
          aria-label="Search conversations"
          placeholder="Search conversations…"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-subtle"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <ScrollArea className="min-h-0 flex-1">
        <ul className="grid gap-0.5 p-2">
          {!shown.length && <li className="px-2.5 py-2 text-[13px] text-subtle">{own.length ? "No chats match" : "No chats yet"}</li>}
          {shown.map((c) => {
            const agent = agents.find((a) => a.id === c.lastAgent)
            const active = chat?.id === c.id
            return (
              <li key={c.id} className="group/chat relative">
                <button
                  type="button"
                  aria-current={active || undefined}
                  className={cn("grid w-full gap-1 rounded-[10px] px-2.5 py-2 text-left hover:bg-accent/60", active && "bg-accent hover:bg-accent")}
                  onClick={() => openChat(c.id)}
                >
                  <span className="flex items-center gap-1.5 text-xs text-subtle">
                    {c.running ? <Spinner className="size-3" /> : <AgentIcon id={agent?.id} color={agent?.color} className="size-3" />}
                    <span className="min-w-0 flex-1 truncate">{agent?.name || "No reply yet"}</span>
                    <span className="tabular-nums group-hover/chat:invisible group-focus-within/chat:invisible">{shortAge(c.updatedAt)}</span>
                  </span>
                  <span className={cn("truncate text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>{c.title}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Delete chat ${c.title}`}
                  className="absolute top-1 right-1 opacity-0 group-hover/chat:opacity-100 focus-visible:opacity-100"
                  onClick={() => setPendingDelete(c)}
                >
                  <Trash2Icon />
                </Button>
              </li>
            )
          })}
        </ul>
      </ScrollArea>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this chat?"
        description={`“${pendingDelete?.title}” will be removed from Code Merger. This can't be undone. Files the agents created stay where they are.`}
        action="Delete chat"
        onConfirm={() => pendingDelete && deleteChat(pendingDelete.id)}
        onClose={() => setPendingDelete(null)}
      />
    </aside>
  )
}
