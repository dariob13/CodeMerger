"use client"

import * as React from "react"
import { WorkspaceIcon, workspaceFileIcon } from "@/components/workspace-icon"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ChatsState } from "@/hooks/use-chats"
import type { WorkspaceState } from "@/hooks/use-workspace"
import { api } from "@/lib/api"
import type { WorkspaceEntry } from "@/lib/types"
import { cn } from "@/lib/utils"

export function WorkspaceExplorer({ state, workspace }: { state: ChatsState; workspace: WorkspaceState }) {
  const [query, setQuery] = React.useState("")
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const [directories, setDirectories] = React.useState<Record<string, WorkspaceEntry[]>>({})
  const [results, setResults] = React.useState<WorkspaceEntry[]>([])
  const [error, setError] = React.useState("")
  const [truncated, setTruncated] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [newFile, setNewFile] = React.useState(false)
  const [name, setName] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const directoryKey = [...expanded].sort().join("\0")
  const changes = workspace.data?.git.changes ?? []
  const changeKey = changes.map((c) => c.path).join("\0")

  React.useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        if (query.trim()) {
          const result = await api<{ entries: WorkspaceEntry[]; truncated: boolean }>(`${workspace.base}/files?${new URLSearchParams({ query: query.trim() })}`)
          if (!cancelled) { setResults(result.entries); setTruncated(result.truncated) }
        } else {
          const entries = await Promise.all(["", ...(directoryKey ? directoryKey.split("\0") : [])].map(async (directory) => {
            try {
              const result = await api<{ entries: WorkspaceEntry[] }>(`${workspace.base}/files?${new URLSearchParams({ directory })}`)
              return [directory, result.entries] as const
            } catch (error) {
              if (!directory) throw error
              return [directory, []] as const // An agent may have removed an expanded folder.
            }
          }))
          if (!cancelled) { setDirectories(Object.fromEntries(entries)); setTruncated(false) }
        }
        if (!cancelled) setError("")
      } catch (error) { if (!cancelled) setError(error instanceof Error ? error.message : String(error)) }
      finally { if (!cancelled) setLoading(false) }
    }, query ? 180 : 0)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [workspace.base, workspace.fileRevision, directoryKey, query, changeKey])

  const renderEntry = (entry: WorkspaceEntry, depth: number) => {
    const folder = entry.kind === "directory", open = expanded.has(entry.path)
    const status = changes.find((c) => c.path === entry.path)?.status
    const changed = folder && changes.some((c) => c.path.startsWith(`${entry.path}/`))
    const active = workspace.activeDocument === `file:${entry.path}`
    return <React.Fragment key={entry.path}>
      <button role="treeitem" aria-expanded={folder ? open : undefined} aria-selected={active} aria-level={depth + 1} title={entry.path} className={cn("flex h-[26px] w-full items-center gap-1.5 rounded-lg pr-2 text-left text-[13px] text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring", active && "bg-muted font-medium text-foreground")} style={{ paddingLeft: 8 + depth * 14 }} onClick={() => {
        if (folder) setExpanded((prev) => { const next = new Set(prev); if (next.has(entry.path)) next.delete(entry.path); else next.add(entry.path); return next })
        else void workspace.openFile(entry.path)
      }}>
        {folder ? <WorkspaceIcon name={open ? "1-imgIconChevronDown" : "1-imgIconChevronRight"} /> : <span className="w-3 shrink-0" />}
        <WorkspaceIcon name={folder ? "1-imgIconFolder1" : workspaceFileIcon(entry.path)} />
        <span className="min-w-0 flex-1 truncate">{query.trim() ? entry.path : entry.name}</span>
        {(status || changed) && <span className="font-mono text-[11px] text-subtle">{status || "•"}</span>}
      </button>
      {folder && open && <div role="group" className="grid gap-px">{directories[entry.path]?.map((child) => renderEntry(child, depth + 1))}</div>}
    </React.Fragment>
  }

  const changedCount = new Set(changes.map((c) => c.path)).size
  return <div className="flex min-h-0 flex-1 flex-col gap-px px-2 py-2.5">
    <div className="flex h-8 shrink-0 items-center gap-2 px-2"><WorkspaceIcon name="1-imgIconFolder" /><span className="min-w-0 flex-1 truncate text-[13px] font-medium">{state.project?.name}</span><Button variant="ghost" size="icon-xs" className="size-3.5 rounded-sm" aria-label="New file" onClick={() => setNewFile(true)}><WorkspaceIcon name="1-imgIconFilePlus" /></Button><Button variant="ghost" size="icon-xs" className="size-3.5 rounded-sm" aria-label="Collapse folders" onClick={() => setExpanded(new Set())}><WorkspaceIcon name="1-imgIconCollapse" /></Button></div>
    <label className="flex h-8 shrink-0 items-center gap-2 px-2"><WorkspaceIcon name="1-imgIconSearch1" /><input type="search" aria-label="Search files" placeholder="Search files…" className="workspace-search" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
    <div className="h-1 shrink-0" />
    <ScrollArea className="min-h-0 flex-1"><div role="tree" aria-label="Project files" className="grid gap-px">{(query.trim() ? results : directories[""] ?? []).map((entry) => renderEntry(entry, 0))}</div>
      {error && <p role="alert" className="px-2 py-3 text-xs text-destructive">{error}</p>}
      {loading && !Object.keys(directories).length && <p className="px-2 py-3 text-xs text-subtle">Loading files…</p>}
      {!loading && query.trim() && !results.length && <p className="px-2 py-3 text-xs text-subtle">No files match</p>}
      {truncated && <p className="px-2 py-3 text-xs text-subtle">Showing the first matches. Narrow your search to find more.</p>}
    </ScrollArea>
    <div className="flex h-8 shrink-0 items-center gap-2 px-2.5 text-xs"><span className="flex-1 text-subtle">{changedCount} {changedCount === 1 ? "file" : "files"} changed</span><button className="font-medium text-muted-foreground hover:text-foreground" onClick={() => workspace.setTab("changes")}>View changes</button></div>
    <Dialog open={newFile} onOpenChange={setNewFile}><DialogContent><DialogHeader><DialogTitle>New file</DialogTitle><DialogDescription>Enter a path relative to {state.project?.name}.</DialogDescription></DialogHeader><form onSubmit={async (e) => { e.preventDefault(); setCreating(true); if (await workspace.createFile(name.trim())) { setNewFile(false); setName("") }; setCreating(false) }}><Input aria-label="New file path" placeholder="components/example.tsx" value={name} onChange={(e) => setName(e.target.value)} autoFocus /><DialogFooter className="mt-4"><Button type="submit" disabled={!name.trim() || creating}>{creating ? "Creating…" : "Create file"}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>
}
