"use client"

import * as React from "react"
import { toast } from "sonner"
import { AgentIcon } from "@/components/agent-icon"
import { WorkspaceIcon, workspaceFileIcon } from "@/components/workspace-icon"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ChatsState } from "@/hooks/use-chats"
import type { WorkspaceState } from "@/hooks/use-workspace"
import { api } from "@/lib/api"
import { shortAge } from "@/lib/format"
import type { GitChange } from "@/lib/types"
import { cn } from "@/lib/utils"

export function WorkspaceChanges({ state, workspace }: { state: ChatsState; workspace: WorkspaceState }) {
  const [message, setMessage] = React.useState("")
  const [drafting, setDrafting] = React.useState(false)
  const messageRevision = React.useRef(0)
  const git = workspace.data?.git
  const staged = git?.changes.filter((c) => c.staged) ?? [], changes = git?.changes.filter((c) => !c.staged) ?? []
  const draftAgent = state.agents.find((a) => a.id === "claude" && a.connected && a.access.includes("read")) || state.agent
  const draft = async () => {
    if (!draftAgent) return
    setDrafting(true)
    const revision = messageRevision.current
    try {
      const result = await api<{ message: string }>(`${workspace.base}/changes/draft`, { method: "POST", body: { agent: draftAgent.id, model: state.pick.models[draftAgent.id] || "" } })
      if (revision === messageRevision.current) setMessage(result.message)
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)) }
    finally { setDrafting(false) }
  }
  const renderChanges = (title: string, files: GitChange[], isStaged: boolean) => <section aria-label={title}>
    <div className="flex h-[34px] items-center gap-2 px-2.5 pt-2 text-xs text-subtle"><h3 className="font-medium">{title}</h3><span className="flex-1">{files.length}</span><Button variant="ghost" size="icon-xs" className="size-[13px] rounded-sm" disabled={workspace.busy || !files.length} aria-label={isStaged ? "Unstage all files" : "Stage all files"} onClick={() => workspace.act(isStaged ? "unstage" : "stage")}><WorkspaceIcon name={isStaged ? "2-imgIconAction" : "2-imgIconAction1"} /></Button></div>
    <ul className="grid gap-0.5">{files.map((change) => <li key={change.path} className="group/change relative">
      <button onClick={() => workspace.openDiff(change)} title={change.path} className="flex h-7 w-full items-center gap-[7px] rounded-lg px-2.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
        <WorkspaceIcon name={workspaceFileIcon(change.path)} /><span className={cn("max-w-[55%] truncate text-[13px] text-muted-foreground", change.status === "D" && "line-through")}>{change.path.split("/").pop()}</span><span className="min-w-0 flex-1 truncate text-xs text-subtle">{change.path.includes("/") ? change.path.slice(0, change.path.lastIndexOf("/")) : ""}</span><span className="shrink-0 font-mono text-[11px] text-subtle">{change.binary ? "binary" : [change.added ? `+${change.added}` : "", change.deleted ? `−${change.deleted}` : ""].filter(Boolean).join(" ")}</span><span className="grid size-4 shrink-0 place-items-center rounded bg-secondary font-mono text-[10px] group-hover/change:invisible group-focus-within/change:invisible">{change.status}</span>
      </button>
      <Button variant="ghost" size="icon-xs" className="absolute top-1.5 right-2.5 size-4 rounded opacity-0 group-hover/change:opacity-100 focus-visible:opacity-100" disabled={workspace.busy} aria-label={`${isStaged ? "Unstage" : "Stage"} ${change.path}`} onClick={() => workspace.act(isStaged ? "unstage" : "stage", [change.path])}><WorkspaceIcon name={isStaged ? "2-imgIconAction" : "2-imgIconAction1"} /></Button>
    </li>)}</ul>
  </section>
  if (!git) return <p className="px-4 py-5 text-[13px] text-subtle">{workspace.loading ? "Loading changes…" : "Changes unavailable"}</p>
  if (!git.available) return <p className="px-4 py-5 text-[13px] text-subtle">This project is not a Git repository.</p>
  return <ScrollArea className="min-h-0 flex-1"><div className="flex flex-col gap-0.5 px-2 py-2.5">
    <div className="flex h-8 items-center gap-[7px] px-2"><WorkspaceIcon name="2-imgIconBranch" /><span className="max-w-20 truncate text-[13px] font-medium" title={git.branch}>{git.branch}</span><span className="min-w-0 flex-1 truncate text-xs text-subtle">{git.ahead ? `${git.ahead} ${git.ahead === 1 ? "commit" : "commits"} to push` : git.behind ? `${git.behind} behind` : git.upstream ? "Up to date" : "No upstream"}</span><Button variant="ghost" size="icon-xs" className="size-3.5 rounded-sm" aria-label="Push commits" title={git.upstream ? "Push commits" : "Configure an upstream to push"} disabled={workspace.busy || !git.upstream || !git.ahead} onClick={() => workspace.act("push")}><WorkspaceIcon name="2-imgIconPush" /></Button><Button variant="ghost" size="icon-xs" className="size-[13px] rounded-sm" aria-label="Refresh changes" disabled={workspace.busy} onClick={() => workspace.refresh()}><WorkspaceIcon name="2-imgIconRefresh" /></Button></div>
    <form className="flex flex-col gap-2.5 rounded-[10px] border bg-card p-2.5" onSubmit={async (e) => { e.preventDefault(); const revision = messageRevision.current; if (await workspace.act("commit", [], message) && revision === messageRevision.current) setMessage("") }}>
      <textarea aria-label="Commit message" placeholder="Describe what changed and why…" value={message} onChange={(e) => { messageRevision.current++; setMessage(e.target.value) }} className="h-9 w-full resize-none bg-transparent text-[13px] leading-normal outline-none placeholder:text-subtle focus-visible:ring-1 focus-visible:ring-ring" />
      <div className="flex gap-1.5"><Button type="submit" className="h-[30px] flex-1 rounded-lg px-3 text-[13px] shadow-none!" disabled={workspace.busy || !staged.length || !message.trim()}>Commit {staged.length} {staged.length === 1 ? "file" : "files"}</Button><Button type="button" variant="secondary" className="h-[30px] gap-1.5 rounded-lg px-2.5 text-[13px] text-muted-foreground" title={`Draft with ${draftAgent?.name || "a connected agent"}`} disabled={drafting || workspace.busy || !staged.length || !draftAgent?.connected || !draftAgent.access.includes("read")} onClick={draft}>{draftAgent?.id === "claude" ? <WorkspaceIcon name="2-imgIconClaude" /> : <AgentIcon id={draftAgent?.id} className="size-3" />}{drafting ? "Drafting…" : "Draft"}</Button></div>
    </form>
    {renderChanges("Staged", staged, true)}{renderChanges("Changes", changes, false)}
    <section aria-label="Commit history"><div className="flex h-[34px] items-center gap-2 px-2.5 pt-2 text-xs text-subtle"><h3 className="font-medium">History</h3><span className="truncate">{git.branch}</span></div><ul className="grid gap-0.5">{git.history.map((commit) => <li key={commit.hash}><button onClick={() => workspace.openCommit(commit)} title={commit.subject} className="flex w-full flex-col gap-1 rounded-lg px-2.5 pt-[7px] pb-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><span className="w-full truncate text-[13px] text-muted-foreground">{commit.subject}</span><span className="flex w-full items-center gap-1.5 text-xs text-subtle">{commit.agent === "claude" ? <WorkspaceIcon name="2-imgIconClaude1" /> : commit.agent === "codex" ? <WorkspaceIcon name="2-imgIconOpenai" /> : <AgentIcon id={commit.agent} className="size-[13px]" />}<span className="max-w-[45%] truncate">{commit.agent === "claude" ? "Claude Code" : commit.agent === "codex" ? "Codex" : commit.author}</span><span className="min-w-0 flex-1 truncate font-mono text-[11px]">{commit.hash.slice(0, 7)}</span>{commit.unpushed && <WorkspaceIcon name="2-imgIconUnpushed" />}<span className="shrink-0">{shortAge(commit.ts)}</span></span></button></li>)}</ul>{!git.history.length && <p className="px-2.5 py-2 text-xs text-subtle">No commits yet</p>}</section>
  </div></ScrollArea>
}
