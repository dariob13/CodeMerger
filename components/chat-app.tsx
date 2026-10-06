"use client"

import * as React from "react"
import { ChevronRightIcon, FolderIcon, FolderPlusIcon, SquareTerminalIcon } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { AutomationsView } from "@/components/automations-view"
import { ChatMessage } from "@/components/chat-message"
import { Composer } from "@/components/composer"
import { ProjectForm } from "@/components/project-form"
import { Badge } from "@/components/ui/badge"
import { InboxView } from "@/components/inbox-view"
import { NotesView } from "@/components/notes-view"
import { WorkspacePanel } from "@/components/workspace-panel"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { useChats } from "@/hooks/use-chats"
import { useInbox } from "@/hooks/use-inbox"
import { useUsage } from "@/hooks/use-usage"

export type View = "chat" | "inbox" | "notes" | "automations"
const TITLES: Record<Exclude<View, "chat">, string> = { inbox: "Inbox", notes: "Notes", automations: "Automations" }

export function ChatApp() {
  const state = useChats()
  const { chat, agents, project, projects, reloadChats } = state
  const inbox = useInbox(reloadChats) // a new inbox item means an automation made a new chat
  const { usage, reload: reloadUsage } = useUsage(state.running) // limits move when a reply finishes
  const [view, setView] = React.useState<View>("chat")
  const chatTitle = !project ? "New project" : chat?.title || "New chat"
  const title = view === "chat" ? chatTitle : TITLES[view]
  const bottom = React.useRef<HTMLDivElement>(null)
  const atBottom = React.useRef(true)
  const messages = chat?.messages

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
  }, [chat?.id])
  React.useEffect(() => {
    if (atBottom.current) bottom.current?.scrollIntoView({ block: "end" })
  }, [messages, view])

  React.useEffect(() => {
    document.title = view !== "chat" || chat ? `${title} · Code Merger` : "Code Merger"
  }, [chat, title, view])

  return (
    <SidebarProvider className="h-svh" style={{ "--agent": state.agent?.color } as React.CSSProperties}>
      <AppSidebar state={state} view={view} onView={setView} unread={inbox.unread} usage={usage} onReloadUsage={reloadUsage} />
      <SidebarInset className="h-svh min-w-0 flex-row overflow-hidden bg-transparent">
        {view === "chat" && project && <WorkspacePanel state={state} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <SidebarTrigger />
            <h1 className="flex min-w-0 flex-1 items-center gap-1 text-sm font-medium tracking-tight">
              {view === "chat" && project && (
                <>
                  <span className="shrink-0 text-muted-foreground">{project.name}</span>
                  <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                </>
              )}
              <span className="truncate">{title}</span>
            </h1>
            {view === "chat" && project && (
              <Badge variant="outline" className="h-7 max-w-[40%] gap-1.5 bg-card px-2.5 font-normal text-muted-foreground" title={`Project folder: ${project.cwd}`}>
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

          {view === "chat" && project && <Composer state={state} />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
