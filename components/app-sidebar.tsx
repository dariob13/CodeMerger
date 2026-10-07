"use client"

import * as React from "react"
import {
  FolderIcon,
  FolderOpenIcon,
  GitMergeIcon,
  InboxIcon,
  NotebookPenIcon,
  PlusIcon,
  Trash2Icon,
  WorkflowIcon,
} from "lucide-react"
import { AgentIcon } from "@/components/agent-icon"
import { AgentMark } from "@/components/agent-mark"
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
import { UsagePanel } from "@/components/usage-panel"
import { Button } from "@/components/ui/button"
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
import type { AgentInfo, AgentUsage, ChatSummary, Persona, Project } from "@/lib/types"

type Props = {
  state: ChatsState
  view: View
  onView: (view: View) => void
  unread: number
  personas: Persona[]
  onNewAgent: () => void
  // The selected agent and its limits, for the Usage row.
  usageAgent: AgentInfo | undefined
  usage: AgentUsage | undefined
  onReloadUsage: () => Promise<void>
}

const SECTIONS = [
  { view: "inbox", label: "Inbox", icon: InboxIcon },
  { view: "notes", label: "Notes", icon: NotebookPenIcon },
  { view: "automations", label: "Automations", icon: WorkflowIcon },
] as const

export function AppSidebar({ state, view, onView, unread, personas, onNewAgent, usageAgent, usage, onReloadUsage }: Props) {
  const { agents, projects, project, chats, chat, newChat, openChat, deleteChat, selectProject, deleteProject } = state
  const withAgent = view === "chat" ? state.activeTab.personaId : undefined // the agent whose chat is being looked at
  const [creating, setCreating] = React.useState(false)
  const [deletingProject, setDeletingProject] = React.useState<Project | null>(null)
  const { isMobile, setOpenMobile } = useSidebar()
  const [pendingDelete, setPendingDelete] = React.useState<ChatSummary | null>(null)
  const color = (id: string | null) => agents.find((a) => a.id === id)?.color
  const closeOnMobile = () => isMobile && setOpenMobile(false)

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex h-9 items-center gap-2 px-2 text-[15px] font-medium tracking-tight" aria-label="Code Merger">
              <GitMergeIcon className="size-[18px]" aria-hidden />
              <span aria-hidden>
                code<span className="font-normal text-muted-foreground">merger</span>
                <span className="font-normal text-subtle">.</span>
              </span>
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
          <SidebarGroupLabel>Agents</SidebarGroupLabel>
          <SidebarGroupAction title="New agent" aria-label="New agent" onClick={onNewAgent}>
            <PlusIcon />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {!personas.length && <p className="px-2 py-1 text-sm text-muted-foreground">No agents yet</p>}
              {personas.map((p) => (
                <SidebarMenuItem key={p.id}>
                  <SidebarMenuButton
                    isActive={withAgent === p.id}
                    title={project ? `Chat with ${p.name} in ${project.name}` : undefined}
                    onClick={() => {
                      // An agent works in a project's folder, so the first step without one is creating it.
                      if (!project) return setCreating(true)
                      state.openAgent(p.id)
                      onView("chat")
                      closeOnMobile()
                    }}
                  >
                    <AgentMark name={p.name} active={chats.some((c) => c.personaId === p.id && c.running)} className="mx-px size-3.5" />
                    <span>{p.name}</span>
                  </SidebarMenuButton>
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
                const own = chats.filter((c) => c.projectId === p.id && !c.personaId)
                return (
                  <SidebarMenuItem key={p.id}>
                    <SidebarMenuButton
                      isActive={view === "chat" && open && !chat && !withAgent}
                      title={p.cwd}
                      // On wide screens the chats sit in the workspace column, so the open project is the selection here.
                      className={view === "chat" && open && !withAgent ? "lg:bg-sidebar-accent lg:font-medium" : undefined}
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
                      <SidebarMenuSub className="mr-0 pr-0 lg:hidden">
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
                                {c.running ? <Spinner className="size-3" /> : <AgentIcon id={c.lastAgent} color={color(c.lastAgent)} className="size-3" />}
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

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UsagePanel agent={usageAgent} usage={usage} onReload={onReloadUsage} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

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
