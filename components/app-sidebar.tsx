"use client"

import * as React from "react"
import {
  FolderIcon,
  FolderOpenIcon,
  InboxIcon,
  NotebookPenIcon,
  PlusIcon,
  RefreshCwIcon,
  SquareTerminalIcon,
  Trash2Icon,
  WorkflowIcon,
} from "lucide-react"
import { AgentDot } from "@/components/agent-dot"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ProjectDialog } from "@/components/project-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import type { View } from "@/components/chat-app"
import type { ChatsState } from "@/hooks/use-chats"
import { UsageTracker } from "@/components/usage-tracker"
import type { AgentInfo, AgentUsage, ChatSummary, Project } from "@/lib/types"

function ConnectDialog({ agent, onClose }: { agent: AgentInfo | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(agent)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {agent?.name}</DialogTitle>
          <DialogDescription>
            Code Merger uses the {agent?.name} CLI and its own sign-in on this machine. Run {agent?.connected ? "this" : "these"} in a
            terminal, then press the recheck button next to Agents.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {!agent?.connected && (
            <div className="grid gap-2">
              <Label htmlFor="agent-install">{agent?.install ? "Install" : "Command not found"}</Label>
              <Input id="agent-install" readOnly className="font-mono" value={agent?.install || agent?.command || ""} onFocus={(e) => e.target.select()} />
            </div>
          )}
          {agent?.login && (
            <div className="grid gap-2">
              <Label htmlFor="agent-login">Sign in</Label>
              <Input id="agent-login" readOnly className="font-mono" value={agent.login} onFocus={(e) => e.target.select()} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

type Props = {
  state: ChatsState
  view: View
  onView: (view: View) => void
  unread: number
  usage: AgentUsage[]
  onReloadUsage: () => Promise<void>
}

const SECTIONS = [
  { view: "inbox", label: "Inbox", icon: InboxIcon },
  { view: "notes", label: "Notes", icon: NotebookPenIcon },
  { view: "automations", label: "Automations", icon: WorkflowIcon },
] as const

export function AppSidebar({ state, view, onView, unread, usage, onReloadUsage }: Props) {
  const { agents, projects, project, chats, chat, newChat, openChat, deleteChat, recheck, selectProject, deleteProject } = state
  const [creating, setCreating] = React.useState(false)
  const [deletingProject, setDeletingProject] = React.useState<Project | null>(null)
  const { isMobile, setOpenMobile } = useSidebar()
  const [pendingDelete, setPendingDelete] = React.useState<ChatSummary | null>(null)
  const [connecting, setConnecting] = React.useState<AgentInfo | null>(null)
  const [checking, setChecking] = React.useState(false)
  const color = (id: string | null) => agents.find((a) => a.id === id)?.color
  const closeOnMobile = () => isMobile && setOpenMobile(false)
  // Agents without a usage row: not installed, or signed out.
  const inactive = agents.filter((a) => !usage.some((u) => u.agent === a.id) && (!a.connected || a.auth === "none"))

  return (
    <Sidebar variant="floating">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2.5 px-1.5 py-1.5 font-semibold tracking-tight">
              <span className="glass grid size-7 place-items-center rounded-lg">
                <SquareTerminalIcon className="size-4" />
              </span>
              Code Merger
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              variant="outline"
              onClick={() => {
                // Chats live in a project, so the first step without one is creating it.
                if (!project) return setCreating(true)
                newChat()
                onView("chat")
                closeOnMobile()
              }}
            >
              <PlusIcon />
              New chat
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {SECTIONS.map((section) => (
                <SidebarMenuItem key={section.view}>
                  <SidebarMenuButton
                    isActive={view === section.view}
                    onClick={() => {
                      onView(section.view)
                      closeOnMobile()
                    }}
                  >
                    <section.icon />
                    <span>{section.label}</span>
                  </SidebarMenuButton>
                  {section.view === "inbox" && unread > 0 && (
                    <SidebarMenuBadge aria-label={`${unread} unread`}>{unread > 99 ? "99+" : unread}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupAction title="New project" aria-label="New project" onClick={() => setCreating(true)}>
            <PlusIcon />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {!projects.length && <p className="px-2 py-1 text-sm text-muted-foreground">No projects yet</p>}
              {projects.map((p) => {
                const open = p.id === project?.id
                const own = chats.filter((c) => c.projectId === p.id)
                return (
                  <SidebarMenuItem key={p.id}>
                    <SidebarMenuButton
                      isActive={view === "chat" && open && !chat}
                      title={p.cwd}
                      onClick={() => {
                        selectProject(p.id)
                        onView("chat")
                        closeOnMobile()
                      }}
                    >
                      {open ? <FolderOpenIcon /> : <FolderIcon />}
                      <span>{p.name}</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction showOnHover aria-label={`Delete project ${p.name}`} onClick={() => setDeletingProject(p)}>
                      <Trash2Icon />
                    </SidebarMenuAction>
                    {open && (
                      <SidebarMenuSub className="mr-0 pr-0">
                        {!own.length && <li className="px-2 py-1 text-xs text-muted-foreground">No chats yet</li>}
                        {own.map((c) => (
                          <SidebarMenuSubItem key={c.id} className="group/chat relative">
                            <SidebarMenuSubButton asChild isActive={view === "chat" && chat?.id === c.id} className="pr-7">
                              <button
                                type="button"
                                className="w-full text-left"
                                onClick={() => {
                                  openChat(c.id)
                                  onView("chat")
                                  closeOnMobile()
                                }}
                              >
                                {c.running ? <Spinner className="size-3" /> : <AgentDot color={color(c.lastAgent)} />}
                                <span>{c.title}</span>
                              </button>
                            </SidebarMenuSubButton>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Delete chat ${c.title}`}
                              className="absolute top-0.5 right-0.5 opacity-0 group-hover/chat:opacity-100 focus-visible:opacity-100"
                              onClick={() => setPendingDelete(c)}
                            >
                              <Trash2Icon />
                            </Button>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-0">
        <SidebarGroup>
          <SidebarGroupLabel>Usage</SidebarGroupLabel>
          <SidebarGroupAction
            title="Recheck agents and usage"
            aria-label="Recheck agents and usage"
            disabled={checking}
            onClick={async () => {
              setChecking(true)
              await Promise.all([recheck(), onReloadUsage()])
              setChecking(false)
            }}
          >
            {checking ? <Spinner /> : <RefreshCwIcon />}
          </SidebarGroupAction>
          <SidebarGroupContent className="grid gap-2">
            <UsageTracker agents={agents} usage={usage} />
            {inactive.length > 0 && (
              <SidebarMenu>
                {inactive.map((a) => (
                  <SidebarMenuItem key={a.id}>
                    <SidebarMenuButton size="sm" className="text-muted-foreground" onClick={() => setConnecting(a)}>
                      <AgentDot color={a.connected ? a.color : undefined} className="mx-0.5" />
                      <span>{a.name}</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge>
                      <Badge variant="outline">{a.connected ? "Sign in" : "Connect"}</Badge>
                    </SidebarMenuBadge>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>

      <ConnectDialog agent={connecting} onClose={() => setConnecting(null)} />
      <ProjectDialog open={creating} root={state.projectsRoot} onCreate={state.createProject} onClose={() => (setCreating(false), onView("chat"))} />
      <ConfirmDialog
        open={Boolean(deletingProject)}
        title="Delete this project?"
        description={`“${deletingProject?.name}”, its chats and its automations will be removed from Code Merger. The folder and its files stay on your computer.`}
        action="Delete project"
        onConfirm={() => deletingProject && deleteProject(deletingProject.id)}
        onClose={() => setDeletingProject(null)}
      />

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingDelete?.title}&rdquo; will be removed from Code Merger. This can&apos;t be undone. Files the agents created stay
              where they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => pendingDelete && deleteChat(pendingDelete.id)}>
              Delete chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  )
}
