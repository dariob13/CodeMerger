"use client"

import * as React from "react"
import { Trash2Icon } from "lucide-react"
import { AgentIcon } from "@/components/agent-icon"
import { WorkspaceIcon } from "@/components/workspace-icon"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ChatsState } from "@/hooks/use-chats"
import type { WorkspaceState } from "@/hooks/use-workspace"
import { elapsedDuration, shortAge } from "@/lib/format"
import type { ChatSummary } from "@/lib/types"
import { cn } from "@/lib/utils"

export function WorkspaceSessions({ state, workspace }: { state: ChatsState; workspace: WorkspaceState }) {
  const [query, setQuery] = React.useState("")
  const [now, setNow] = React.useState(() => Date.now())
  const [pendingDelete, setPendingDelete] = React.useState<ChatSummary | null>(null)
  React.useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  const sessions = (workspace.data?.sessions ?? state.chats.filter((c) => c.projectId === state.project?.id)).filter((c) => `${c.title} ${c.lastAgent} ${c.model}`.toLowerCase().includes(query.toLowerCase().trim()))
  const groups = [
    { title: "Running", sessions: sessions.filter((c) => c.running) },
    { title: "Finished", sessions: sessions.filter((c) => !c.running && (c.unread || Boolean(c.finishedAt && now - c.finishedAt < 3_600_000))) },
    { title: "Idle", sessions: sessions.filter((c) => !c.running && !c.unread && !(c.finishedAt && now - c.finishedAt < 3_600_000)) },
  ]
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col px-2 py-2.5">
    <label className="flex h-8 shrink-0 items-center gap-2 px-2"><WorkspaceIcon name="0-imgIconSearch1" /><input type="search" aria-label="Filter sessions" placeholder="Filter sessions…" value={query} onChange={(e) => setQuery(e.target.value)} className="workspace-search" /></label>
    <ScrollArea className="min-h-0 min-w-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block"><div className="flex min-w-0 flex-col gap-0.5">
      {groups.map((group) => group.sessions.length > 0 && <section key={group.title} aria-label={`${group.title} sessions`}>
        <div className="flex h-[30px] items-center gap-2 px-2.5 pt-1.5 text-xs text-subtle"><h3 className="flex-1 font-medium">{group.title}</h3><span>{group.sessions.length}</span></div>
        <ul className="grid min-w-0 grid-cols-1 gap-0.5">{group.sessions.map((session) => {
          const agent = state.agents.find((a) => a.id === session.lastAgent), active = state.chat?.id === session.id
          const icon = session.lastAgent === "codex" ? "0-imgIconOpenai" : session.lastAgent === "claude" ? "0-imgIconClaude" : session.lastAgent === "opencode" ? "0-imgIconOpencode" : null
          const model = session.model ? agent?.models.find(([id]) => id === session.model)?.[1] || session.model : "", finished = group.title === "Finished"
          return <li key={session.id} className={cn("group/session relative min-w-0 rounded-[10px] hover:bg-card", active && "bg-card")}>
            <button onClick={() => workspace.openSession(session.id)} aria-current={active || undefined} className="flex w-full min-w-0 flex-col gap-1.5 rounded-[10px] px-2.5 pt-[9px] pb-2.5 text-left whitespace-normal outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex w-full min-w-0 items-start gap-[7px] pr-5 text-xs text-subtle">{icon ? <WorkspaceIcon name={icon} /> : <AgentIcon id={session.lastAgent} className="size-[13px]" />}<span className="min-w-0 flex-1 wrap-anywhere">{agent?.name || "No reply yet"}{model ? ` · ${model}` : ""}</span><span className="shrink-0 font-mono text-[11px] whitespace-nowrap">{session.running && session.startedAt ? elapsedDuration(now - session.startedAt) : `${shortAge(session.finishedAt ?? session.updatedAt, now)}${finished ? " ago" : ""}`}</span></span>
              <span className={cn("w-full min-w-0 text-sm font-medium wrap-anywhere", active ? "text-foreground" : "text-muted-foreground")}>{session.title}</span>
              {(session.running || finished) && <span className="flex w-full min-w-0 items-start gap-1.5 text-xs text-muted-foreground"><WorkspaceIcon name={session.running ? "0-imgIconLoader" : "0-imgIconCheck"} className={session.running ? "motion-safe:animate-spin" : undefined} /><span className="min-w-0 flex-1 wrap-anywhere">{session.running ? session.activity || "Thinking…" : session.status === "error" ? "Run failed" : session.status === "stopped" ? "Stopped" : "Replied"}</span>{session.unread && <WorkspaceIcon name="0-imgUnread" />}</span>}
              <span className={cn("flex w-full min-w-0 items-start gap-1.5 text-xs text-subtle", session.running && "min-h-5")}><WorkspaceIcon name="0-imgIconBranch" /><span className="min-w-0 flex-1 wrap-anywhere">{state.project?.name}{workspace.data?.git.branch ? `/${workspace.data.git.branch}` : ""}</span>{session.running && <span className="size-5 shrink-0 self-end" />}</span>
            </button>
            {session.running && <button aria-label={`Stop session ${session.title}`} title="Stop session" onClick={() => workspace.stopSession(session.id)} className="absolute right-2.5 bottom-2.5 grid size-5 place-items-center rounded-md bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="size-[7px] rounded-[1.5px] bg-muted-foreground" /></button>}
            <Button variant="ghost" size="icon-xs" aria-label={`Delete session ${session.title}`} className="absolute top-1 right-1 size-6 opacity-0 group-hover/session:opacity-100 focus-visible:opacity-100" onClick={() => setPendingDelete(session)}><Trash2Icon className="size-3" /></Button>
          </li>
        })}</ul>
      </section>)}
      {!sessions.length && <p className="px-2.5 py-4 text-[13px] text-subtle">{query ? "No sessions match" : workspace.loading ? "Loading sessions…" : "No sessions yet"}</p>}
    </div></ScrollArea>
    <Button variant="ghost" className="mt-0.5 h-8 w-full justify-start gap-2 rounded-lg px-2.5 text-[13px] font-normal text-subtle" onClick={state.newChat}><WorkspaceIcon name="0-imgIconPlus1" /><span className="flex-1 text-left">New session</span><span className="text-xs">⌘T</span></Button>
    <ConfirmDialog open={Boolean(pendingDelete)} title="Delete this session?" description={`“${pendingDelete?.title}” will be removed. Files created by its agents stay on disk.`} action="Delete session" onConfirm={async () => { if (pendingDelete) await state.deleteChat(pendingDelete.id); void workspace.refresh() }} onClose={() => setPendingDelete(null)} />
  </div>
}
