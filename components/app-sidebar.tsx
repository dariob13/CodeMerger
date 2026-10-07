"use client"

import * as React from "react"
import { Clock3Icon, FileTextIcon, InboxIcon, PlusIcon, SearchIcon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react"
import { AgentIcon } from "@/components/agent-icon"
import { AgentMark } from "@/components/agent-mark"
import { BoalsFace, BoalsWordmark } from "@/components/boals"
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
import { useModKey } from "@/hooks/use-mod-key"
import { cn } from "@/lib/utils"
import type { AgentInfo, AgentUsage, ChatSummary, Persona, Project } from "@/lib/types"

type Props = {
  state: ChatsState
  view: View
  onView: (view: View) => void
  unread: number
  personas: Persona[]
  onNewAgent: () => void
  onSearch: () => void
  // The selected agent and its limits, for the Usage row.
  usageAgent: AgentInfo | undefined
  usage: AgentUsage | undefined
  onReloadUsage: () => Promise<void>
}

const SECTIONS = [
  { view: "inbox", label: "Inbox", icon: InboxIcon },
  { view: "notes", label: "Notes", icon: FileTextIcon },
  { view: "automations", label: "Automations", icon: Clock3Icon },
] as const

// One row of the sidebar, as drawn in the Figma file: 34px tall, 10px corners, a 16px mark.
export const SIDEBAR_ROW = "h-[34px] gap-2.5 rounded-[10px] px-2.5 text-muted-foreground data-active:text-foreground"

export function AppSidebar({ state, view, onView, unread, personas, onNewAgent, onSearch, usageAgent, usage, onReloadUsage }: Props) {
  const { agents, projects, project, chats, chat, newChat, openChat, deleteChat, selectProject, deleteProject } = state
  const withAgent = view === "chat" ? state.activeTab.personaId : undefined // the agent whose chat is being looked at
  const [creating, setCreating] = React.useState(false)
  const [deletingProject, setDeletingProject] = React.useState<Project | null>(null)
  const { isMobile, setOpenMobile } = useSidebar()
  const [pendingDelete, setPendingDelete] = React.useState<ChatSummary | null>(null)
  const color = (id: string | null) => agents.find((a) => a.id === id)?.color
  const closeOnMobile = () => isMobile && setOpenMobile(false)
  const mod = useModKey()

  return (
    <Sidebar>
      <SidebarHeader className="gap-2 px-2.5 pt-3 pb-1">
        <div role="img" aria-label="boals" className="flex h-9 items-center gap-[7px] px-2">
          <BoalsFace />
          <BoalsWordmark />
        </div>
        <button
          type="button"
          className="flex h-[34px] items-center gap-2 rounded-[10px] border bg-card pr-2 pl-2.5 text-sm text-subtle outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          onClick={() => {
            onSearch()
            closeOnMobile()
          }}
        >
          <SearchIcon className="size-[15px]" aria-hidden />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded-md border bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted-foreground">{mod} K</kbd>
        </button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-2.5 py-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {SECTIONS.map((section) => (
                <SidebarMenuItem key={section.view}>
                  <SidebarMenuButton
                    isActive={view === section.view}
                    className={SIDEBAR_ROW}
                    onClick={() => {
                      onView(section.view)
                      closeOnMobile()
                    }}
                  >
                    <section.icon />
                    <span>{section.label}</span>
                  </SidebarMenuButton>
                  {section.view === "inbox" && unread > 0 && (
                    <SidebarMenuBadge className="top-[7px]! right-2 font-normal text-subtle" aria-label={`${unread} unread`}>{unread > 99 ? "99+" : unread}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-2.5 py-0">
          <SidebarGroupLabel className="h-9 items-end px-2.5 pb-1.5 text-[13px] text-subtle">Agents</SidebarGroupLabel>
          <SidebarGroupAction className="top-2.5 right-4 text-muted-foreground" title="New agent" aria-label="New agent" onClick={onNewAgent}>
            <PlusIcon />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {!personas.length && <p className="px-2.5 py-1.5 text-sm text-subtle">No agents yet</p>}
              {personas.map((p) => (
                <SidebarMenuItem key={p.id}>
                  <SidebarMenuButton
                    isActive={withAgent === p.id}
                    className={SIDEBAR_ROW}
                    title={project ? `Chat with ${p.name} in ${project.name}` : undefined}
                    onClick={() => {
                      // An agent works in a project's folder, so the first step without one is creating it.
                      if (!project) return setCreating(true)
                      state.openAgent(p.id)
                      onView("chat")
                      closeOnMobile()
                    }}
                  >
                    <AgentMark name={p.name} active={chats.some((c) => c.personaId === p.id && c.running)} className="mx-px size-3.5!" />
                    <span>{p.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-2.5 py-0">
          <SidebarGroupLabel className="h-9 items-end px-2.5 pb-1.5 text-[13px] text-subtle">Projects</SidebarGroupLabel>
          <SidebarGroupAction className="top-2.5 right-4 text-muted-foreground" title="New project" aria-label="New project" onClick={() => setCreating(true)}>
            <PlusIcon />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {!projects.length && <p className="px-2.5 py-1.5 text-sm text-subtle">No projects yet</p>}
              {projects.map((p, index) => {
                const open = p.id === project?.id
                const own = chats.filter((c) => c.projectId === p.id && !c.personaId)
                return (
                  <SidebarMenuItem key={p.id}>
                    <SidebarMenuButton
                      isActive={view === "chat" && open && !chat && !withAgent}
                      title={p.cwd}
                      // On wide screens the chats sit in the workspace column, so the open project is the selection here.
                      className={cn(SIDEBAR_ROW, view === "chat" && open && !withAgent && "lg:bg-sidebar-accent lg:font-medium lg:text-foreground")}
                      onClick={() => {
                        selectProject(p.id)
                        onView("chat")
                        closeOnMobile()
                      }}
                    >
                      {/* Each project's tile is a step fainter than the one above; the open one is solid. */}
                      <span aria-hidden className="grid size-4 shrink-0 place-items-center">
                        <span className="size-3 rounded-[4.5px] bg-foreground" style={{ opacity: open ? 1 : Math.max(0.2, 0.55 - index * 0.05) }} />
                      </span>
                      <span>{p.name}</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction showOnHover className="top-[7px]! right-1.5" aria-label={`Delete project ${p.name}`} onClick={() => setDeletingProject(p)}>
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

      <SidebarFooter className="px-2.5 pb-2.5">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <UsagePanel agent={usageAgent} usage={usage} onReload={onReloadUsage} />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={view === "settings"}
              className={SIDEBAR_ROW}
              onClick={() => {
                onView("settings")
                closeOnMobile()
              }}
            >
              <SlidersHorizontalIcon />
              <span className="flex-1">Settings</span>
              <span className="text-xs text-subtle">{mod} ,</span>
            </SidebarMenuButton>
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
