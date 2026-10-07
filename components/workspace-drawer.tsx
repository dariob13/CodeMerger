"use client"

import * as React from "react"
import { PanelLeftIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { WorkspacePanel } from "@/components/workspace-panel"
import type { ChatsState } from "@/hooks/use-chats"
import type { WorkspaceState } from "@/hooks/use-workspace"

export function WorkspaceDrawer({ state, workspace }: { state: ChatsState; workspace: WorkspaceState }) {
  const [open, setOpen] = React.useState(false)
  const drawerState = { ...state, newChat: () => { state.newChat(); setOpen(false) } }
  const drawerWorkspace = {
    ...workspace,
    openSession: async (id: string) => { setOpen(false); await workspace.openSession(id) },
    openFile: async (path: string) => { await workspace.openFile(path); setOpen(false) },
    openDiff: async (...args: Parameters<WorkspaceState["openDiff"]>) => { await workspace.openDiff(...args); setOpen(false) },
    openCommit: async (...args: Parameters<WorkspaceState["openCommit"]>) => { await workspace.openCommit(...args); setOpen(false) },
    createFile: async (path: string) => { const created = await workspace.createFile(path); if (created) setOpen(false); return created },
  }
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger asChild><Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open workspace"><PanelLeftIcon className="size-4" /></Button></SheetTrigger>
    <SheetContent side="left" showCloseButton={false} className="w-68! gap-0 p-0" aria-describedby={undefined}>
      <SheetTitle className="sr-only">Workspace</SheetTitle>
      <SheetDescription className="sr-only">Sessions, project files, and Git changes.</SheetDescription>
      <WorkspacePanel state={drawerState} workspace={drawerWorkspace} compact />
      <SheetClose asChild><Button variant="secondary" size="icon-sm" className="absolute top-3 -right-10" aria-label="Close workspace"><XIcon className="size-4" /></Button></SheetClose>
    </SheetContent>
  </Sheet>
}
