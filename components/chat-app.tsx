"use client"

import * as React from "react"
import { FolderIcon, FolderPlusIcon, SquareTerminalIcon } from "lucide-react"
import { AgentsView } from "@/components/agents-view"
import { AppSidebar } from "@/components/app-sidebar"
import { AutomationsView } from "@/components/automations-view"
import { ChatMessage } from "@/components/chat-message"
import { Composer } from "@/components/composer"
import { ProjectForm } from "@/components/project-form"
import { Badge } from "@/components/ui/badge"
import { InboxView } from "@/components/inbox-view"
import { NotesView } from "@/components/notes-view"
import { TabStrip } from "@/components/tab-strip"
import { WorkingSnake } from "@/components/working-snake"
import { WorkspacePanel } from "@/components/workspace-panel"
import { WorkspaceEditor } from "@/components/workspace-editor"
import { WorkspaceDrawer } from "@/components/workspace-drawer"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { useChats } from "@/hooks/use-chats"
import { useInbox } from "@/hooks/use-inbox"
import { usePersonas } from "@/hooks/use-personas"
import { useUsage } from "@/hooks/use-usage"
import { useWorkspace } from "@/hooks/use-workspace"

export type View = "chat" | "inbox" | "notes" | "automations" | "agents"
const TITLES: Record<Exclude<View, "chat">, string> = { inbox: "Inbox", notes: "Notes", automations: "Automations", agents: "Agents" }

export function ChatApp() {
  const state = useChats()
  const workspace = useWorkspace(state)
  const { chat, agents, project, projects, reloadChats } = state
  const inbox = useInbox(reloadChats) // a new inbox item means an automation made a new chat
  const replies = state.runningTabs.length
  const { usage, reload: reloadUsage } = useUsage(replies) // limits move when a reply finishes
  const personas = usePersonas(replies) // a reply finishing may have added to an agent's memory
  const [view, setView] = React.useState<View>("chat")
  const chatTitle = !project ? "New project" : chat?.title || "New chat"
  const title = view === "chat" ? chatTitle : TITLES[view]
  const bottom = React.useRef<HTMLDivElement>(null)
  const atBottom = React.useRef(true)
  const messages = chat?.messages
  const replying = messages?.[messages.length - 1]
  const working = replying?.role === "assistant" && replying.status === "running" ? (replying.persona?.id ?? null) : null

  // Follow the reply as it streams, unless the user has scrolled up to read.
  React.useEffect(() => {
    const node = bottom.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => (atBottom.current = entry.isIntersecting), { rootMargin: "80px" })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  React.useEffect(() => {
    atBottom.current = true
  }, [state.activeTab.key])
  React.useEffect(() => {
    if (atBottom.current) bottom.current?.scrollIntoView({ block: "end" })
  }, [messages, view, state.activeTab.key])

  // ⌘T opens a new tab. Browsers keep ⌘T for their own tabs unless the app has its own window, so ⌃T and ⌥T work too.
  const { newChat } = state
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyT" || e.shiftKey || !(e.metaKey || e.ctrlKey || e.altKey)) return
      e.preventDefault()
      newChat()
      setView("chat")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [newChat])

  React.useEffect(() => {
    document.title = view !== "chat" || chat ? `${title} · Code Merger` : "Code Merger"
  }, [chat, title, view])

  return (
    <SidebarProvider className="h-svh" style={{ "--agent": state.agent?.color } as React.CSSProperties}>
      <AppSidebar state={state} view={view} onView={setView} unread={inbox.unread} usage={usage} onReloadUsage={reloadUsage} />
      <SidebarInset className="h-svh min-w-0 flex-row overflow-hidden bg-transparent">
        {view === "chat" && project && <WorkspacePanel key={project.id} state={state} workspace={workspace} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <SidebarTrigger />
            {view === "chat" && project && <WorkspaceDrawer key={project.id} state={state} workspace={workspace} />}
            {view === "chat" && project ? (
              <>
                <h1 className="sr-only">{title}</h1>
                <TabStrip state={state} />
              </>
            ) : (
              <h1 className="min-w-0 flex-1 truncate text-sm font-medium tracking-tight">{title}</h1>
            )}
            {view === "chat" && project && (
              <Badge
                variant="outline"
                className="hidden h-7 max-w-[30%] gap-1.5 bg-card px-2.5 font-normal text-muted-foreground md:flex"
                title={`Project folder: ${project.cwd}`}
              >
                <FolderIcon />
                <span className="truncate [direction:rtl]">&lrm;{project.cwd}</span>
              </Badge>
            )}
          </header>

          {view === "inbox" && (
            <InboxView
              inbox={inbox}
              agents={agents}
              onOpen={(item) => {
                inbox.markRead(item.id)
                if (!item.chatId) return
                state.openChat(item.chatId)
                setView("chat")
              }}
            />
          )}
          {view === "notes" && <NotesView />}
          {view === "automations" && <AutomationsView agents={agents} projects={projects} onRunStarted={state.upsertSummary} />}
          {view === "agents" && (
            <AgentsView
              personas={personas}
              agents={agents}
              working={working}
              onChat={(persona) => {
                state.setPick({ persona: persona.id, agent: persona.agent })
                state.newChat()
                setView("chat")
              }}
            />
          )}

          {/* No project yet: the first thing to do is create the folder the agents will work in. */}
          {view === "chat" && state.ready && !project && (
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4">
              <div className="glass grid w-full max-w-md gap-5 rounded-3xl p-6">
                <div className="grid gap-2">
                  <span className="glass grid size-11 place-items-center rounded-2xl">
                    <FolderPlusIcon className="size-5" />
                  </span>
                  <h2 className="text-xl font-semibold tracking-tight">{projects.length ? "Create a project" : "Create your first project"}</h2>
                  <p className="text-sm text-muted-foreground">
                    A project is a folder on your computer. Every agent you chat with in it reads, writes and runs in that folder.
                  </p>
                </div>
                <ProjectForm root={state.projectsRoot} onCreate={state.createProject} />
              </div>
            </div>
          )}

          <ScrollArea className={view === "chat" && project ? "min-h-0 flex-1" : "hidden"}>
            <div className="mx-auto flex min-h-[calc(100svh-11.5rem)] w-full max-w-3xl flex-col gap-6 px-4 pt-6 pb-8">
              {messages?.length ? (
                messages.map((m) => (
                  <ChatMessage
                    key={m.id}
                    chatId={chat!.id}
                    message={m}
                    agent={m.role === "assistant" ? agents.find((a) => a.id === m.agent) : undefined}
                  />
                ))
              ) : (
                <Empty className="flex-1">
                  <EmptyHeader className="max-w-lg">
                    <EmptyMedia variant="icon" className="glass size-12 rounded-2xl">
                      <SquareTerminalIcon className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle className="pb-1 text-3xl font-medium tracking-tight">
                      What are we working on?
                    </EmptyTitle>
                    <EmptyDescription className="text-base">
                      New chat in <span className="font-medium text-foreground">{project?.name}</span>.{" "}
                      Pick an agent below and start typing. You can switch agents at any point; the next one is handed the conversation so
                      far.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
              <div ref={bottom} aria-hidden />
            </div>
          </ScrollArea>

          {view === "chat" && project && replying?.role === "assistant" && replying.status === "running" && (
            <div className="mx-auto w-full max-w-3xl px-4">
              <WorkingSnake label={`${replying.persona?.name ?? agents.find((a) => a.id === replying.agent)?.short ?? "Agent"} is working`} />
            </div>
          )}

          {/* One composer per tab, so a draft stays with its tab. */}
          {view === "chat" &&
            project &&
            state.tabs.map((tab) => <Composer key={tab.key} state={state} personas={personas.personas} active={tab.key === state.activeTab.key} />)}
        </div>
        {view === "chat" && project && workspace.activeDocument && <WorkspaceEditor workspace={workspace} />}
      </SidebarInset>
    </SidebarProvider>
  )
}
