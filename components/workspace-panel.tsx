"use client"

import * as React from "react"
import { WorkspaceIcon } from "@/components/workspace-icon"
import { WorkspaceSessions } from "@/components/workspace-sessions"
import { WorkspaceExplorer } from "@/components/workspace-explorer"
import { WorkspaceChanges } from "@/components/workspace-changes"
import { Button } from "@/components/ui/button"
import type { ChatsState } from "@/hooks/use-chats"
import type { WorkspaceState, WorkspaceTab } from "@/hooks/use-workspace"
import { cn } from "@/lib/utils"

const TABS: WorkspaceTab[] = ["sessions", "explorer", "changes"]
export function WorkspacePanel({ state, workspace, compact = false }: { state: ChatsState; workspace: WorkspaceState; compact?: boolean }) {
  const panel = React.useRef<HTMLElement>(null)
  const id = React.useId()
  const selectTab = (tab: WorkspaceTab) => workspace.setTab(tab)
  return (
    <aside ref={panel} className={cn("workspace-panel w-68 shrink-0 flex-col border-r", compact ? "flex h-full" : "hidden lg:flex")} aria-label="Workspace">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b pr-3.5 pl-4">
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium tracking-[-0.21px]">Workspace</h2>
        <Button variant="ghost" size="icon-xs" className="size-[15px] rounded-sm" aria-label="Search workspace" title="Search workspace" onClick={() => {
          if (workspace.tab === "changes") selectTab("explorer")
          requestAnimationFrame(() => panel.current?.querySelector<HTMLInputElement>('[role="tabpanel"]:not([hidden]) input[type=search]')?.focus())
        }}><WorkspaceIcon name="0-imgIconSearch" /></Button>
        <Button variant="ghost" size="icon-xs" className="size-[15px] rounded-sm" aria-label="New session" title="New session" onClick={() => { selectTab("sessions"); state.newChat() }}><WorkspaceIcon name="0-imgIconPlus" /></Button>
      </header>
      <div role="tablist" aria-label="Workspace tabs" className="flex h-[45px] shrink-0 gap-0.5 border-b px-2.5 py-2">
        {TABS.map((tab, index) => <Button key={tab} id={`${id}-tab-${tab}`} role="tab" data-workspace-tab={tab} aria-selected={workspace.tab === tab} aria-controls={`${id}-${tab}`} tabIndex={workspace.tab === tab ? 0 : -1} variant="ghost" className={cn("h-7 rounded-lg px-2.5 text-[13px] font-normal tracking-[-0.078px] text-subtle", workspace.tab === tab && "bg-muted font-medium text-foreground")} onClick={() => selectTab(tab)} onKeyDown={(e) => {
          const next = e.key === "ArrowRight" ? (index + 1) % 3 : e.key === "ArrowLeft" ? (index + 2) % 3 : e.key === "Home" ? 0 : e.key === "End" ? 2 : -1
          if (next < 0) return
          e.preventDefault(); selectTab(TABS[next]); panel.current?.querySelector<HTMLButtonElement>(`[data-workspace-tab="${TABS[next]}"]`)?.focus()
        }}>{tab[0].toUpperCase() + tab.slice(1)}</Button>)}
      </div>
      {workspace.error && <div role="alert" className="px-4 py-2 text-xs text-destructive">{workspace.error} <button className="underline" onClick={() => workspace.refresh()}>Retry</button></div>}
      {TABS.map((tab) => <div key={tab} role="tabpanel" id={`${id}-${tab}`} aria-labelledby={`${id}-tab-${tab}`} hidden={workspace.tab !== tab} className={cn("min-h-0 flex-1 flex-col", workspace.tab === tab ? "flex" : "hidden")}>
        {tab === "sessions" && <WorkspaceSessions state={state} workspace={workspace} />}
        {tab === "explorer" && <WorkspaceExplorer state={state} workspace={workspace} />}
        {tab === "changes" && <WorkspaceChanges state={state} workspace={workspace} />}
      </div>)}
    </aside>
  )
}
