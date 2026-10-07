"use client"

import * as React from "react"
import { CornerUpRightIcon, FolderIcon, FolderPlusIcon, PanelRightIcon, PencilIcon, SquareTerminalIcon, XIcon } from "lucide-react"
import { PanelResizeHandle } from "@/components/panel-resize-handle"
import { usePanelWidth } from "@/hooks/use-panel-width"
import { AgentIcon } from "@/components/agent-icon"
import { AgentMark, AgentMarkTile } from "@/components/agent-mark"
import { AgentDialog, AgentPanel } from "@/components/agent-panel"
import { AppSidebar } from "@/components/app-sidebar"
import { AutomationsView } from "@/components/automations-view"
import { ChatMessage } from "@/components/chat-message"
import { Composer } from "@/components/composer"
import { ContextRing } from "@/components/context-ring"
import { ProjectForm } from "@/components/project-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InboxView } from "@/components/inbox-view"
import { NotesView } from "@/components/notes-view"
import { SearchDialog } from "@/components/search-dialog"
import { SettingsView } from "@/components/settings-view"
import { TerminalPanel } from "@/components/terminal-panel"
import { TabStrip } from "@/components/tab-strip"
import { WorkspacePanel } from "@/components/workspace-panel"
import { WorkspaceEditor } from "@/components/workspace-editor"
import { WorkspaceDrawer } from "@/components/workspace-drawer"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { useChats } from "@/hooks/use-chats"
import { useContext } from "@/hooks/use-context"
import { useInbox } from "@/hooks/use-inbox"
import { usePersonas } from "@/hooks/use-personas"
import { useSettings } from "@/hooks/use-settings"
import { useUsage } from "@/hooks/use-usage"
import { useWorkspace } from "@/hooks/use-workspace"
import type { Persona } from "@/lib/types"

export type View = "chat" | "inbox" | "notes" | "automations" | "settings"
const TITLES: Record<Exclude<View, "chat">, string> = { inbox: "Inbox", notes: "Notes", automations: "Automations", settings: "Settings" }

export function ChatApp() {
  const agentPanel = usePanelWidth("agent-details", 240, 720)
  const state = useChats()
  const workspace = useWorkspace(state)
  const { chat, agents, project, projects, reloadChats } = state
  const inbox = useInbox(reloadChats) // a new inbox item means an automation made a new chat
  const replies = state.runningTabs.length
  const { usage, reload: reloadUsage } = useUsage(replies) // limits move when a reply finishes
  const context = useContext(chat?.id ?? null, state.running) // and so does how full the chat's context window is
  const handedOff = state.handoffs[state.activeTab.key]
  // Where a reply can go: any connected agent in a new chat, or another chat that is open in a tab.
  const handoffs = React.useMemo(
    () => ({
      agents: state.connected,
      chats: state.tabs.flatMap((tab) => {
        const summary = tab.key !== state.activeTab.key && state.chats.find((c) => c.id === tab.chatId)
        return summary ? [{ tabKey: tab.key, title: summary.title, agent: state.agents.find((a) => a.id === summary.lastAgent), running: summary.running }] : []
      }),
    }),
    [state.activeTab.key, state.agents, state.chats, state.connected, state.tabs]
  )
  const { retryReply } = state
  const lastReply = chat?.messages.at(-1)
  const lastAgent = lastReply?.role === "assistant" ? lastReply.agent : null
  const chatId = chat?.id
  const retryLast = React.useCallback(() => {
    if (chatId && lastAgent) retryReply(chatId, lastAgent)
  }, [chatId, lastAgent, retryReply])
  const personas = usePersonas(replies) // a reply finishing may have added to an agent's memory
  const [view, setView] = React.useState<View>("chat")
  const [editing, setEditing] = React.useState<Persona | "new" | null>(null)
  const [searching, setSearching] = React.useState(false)
  const [terminalOpen, setTerminalOpen] = React.useState(false)
  // The chat with one of the user's own agents takes the place of the workspace and the tab strip.
  const persona = view === "chat" && project ? personas.personas.find((p) => p.id === state.activeTab.personaId) : undefined
  const engine = persona ? agents.find((a) => a.id === persona.agent) : state.agent
  const workspaceShown = view === "chat" && project && !state.activeTab.personaId
  const chatTitle = !project ? "New project" : (persona?.name ?? (chat?.title || "New chat"))
  const title = view === "chat" ? chatTitle : TITLES[view]
  const bottom = React.useRef<HTMLDivElement>(null)
  const atBottom = React.useRef(true)
  const messages = chat?.messages
  const replying = messages?.at(-1)
  const working = replying?.role === "assistant" && replying.status === "running"

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
      if (e.key === "," && (e.metaKey || e.ctrlKey)) return e.preventDefault(), setView("settings")
      if (e.code === "KeyK" && !e.shiftKey && !e.altKey && (e.metaKey || e.ctrlKey)) return e.preventDefault(), setSearching(true)
      if (e.code !== "KeyT" || e.shiftKey || !(e.metaKey || e.ctrlKey || e.altKey)) return
      e.preventDefault()
      newChat()
      setView("chat")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [newChat])

  // Appearance settings are attributes on the page, so the stylesheet can act on them.
  const settings = useSettings()
  React.useEffect(() => {
    document.documentElement.toggleAttribute("data-reduce-motion", settings.reduceMotion)
    document.documentElement.dataset.textSize = settings.textSize
  }, [settings.reduceMotion, settings.textSize])

  // A reply that finishes while the window is in the background is announced, if the user asked for that.
  const runningKeys = state.runningTabs.join(",")
  const wasRunning = React.useRef("")
  React.useEffect(() => {
    const finished = wasRunning.current.split(",").filter((key) => key && !runningKeys.split(",").includes(key))
    wasRunning.current = runningKeys
    if (!finished.length || !settings.notify || !document.hidden || typeof Notification === "undefined" || Notification.permission !== "granted") return
    for (const key of finished) {
      const tab = state.tabs.find((t) => t.key === key)
      new Notification(state.chats.find((c) => c.id === tab?.chatId)?.title || "Code Merger", { body: "The reply is ready." })
    }
  }, [runningKeys, settings.notify, state.chats, state.tabs])

  React.useEffect(() => {
    document.title = view !== "chat" || chat ? `${title} · Code Merger` : "Code Merger"
  }, [chat, title, view])

  return (
    <SidebarProvider className="app-layout h-svh" style={{ "--agent": engine?.color, "--desktop-panel-reserve": `${240 + (workspaceShown ? 220 : 0) + (workspaceShown && workspace.activeDocument ? 240 : 0) + (persona ? 240 : 0)}px` } as React.CSSProperties}>
      <AppSidebar state={state} view={view} onView={setView} unread={inbox.unread} personas={personas.personas} onNewAgent={() => setEditing("new")} onSearch={() => setSearching(true)} usageAgent={engine} usage={usage.find((u) => u.agent === engine?.id)} onReloadUsage={reloadUsage} />
      <SidebarInset className="h-svh min-w-0 flex-row overflow-hidden bg-transparent">
        {workspaceShown && <WorkspacePanel key={project.id} state={state} workspace={workspace} />}
        {/* The terminal runs under the chat and the editor together. */}
        <div className="flex min-w-0 flex-1 flex-col" style={{ "--terminal-height": workspaceShown ? (terminalOpen ? "13.25rem" : "2.25rem") : "0px" } as React.CSSProperties}>
        <div className="flex min-h-0 flex-1">
        <div data-resize-center className="flex min-w-0 flex-1 flex-col lg:min-w-60">
          <header className={workspaceShown ? "flex h-12 shrink-0 items-center gap-1 border-b px-2.5" : "flex h-12 shrink-0 items-center gap-2 border-b px-3"}>
            {/* Beside the workspace the tabs take the whole bar; the sidebar still folds with its shortcut. */}
            <SidebarTrigger className={workspaceShown ? "lg:hidden" : undefined} />
            {workspaceShown && <WorkspaceDrawer key={project.id} state={state} workspace={workspace} />}
            {workspaceShown ? (
              <>
                <h1 className="sr-only">{title}</h1>
                <TabStrip state={state} />
              </>
            ) : persona ? (
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <AgentMarkTile name={persona.name} active={working} className="size-7 rounded-lg" />
                <h1 className="truncate text-[15px] font-medium tracking-tight">{persona.name}</h1>
                <p className="hidden shrink-0 items-center gap-1.5 text-[13px] text-subtle sm:flex">
                  <AgentIcon id={engine?.id} color={engine?.color} className="size-3" />
                  Runs on {engine?.name || persona.agent}
                </p>
              </div>
            ) : (
              <h1 className="min-w-0 flex-1 truncate text-sm font-medium tracking-tight">{title}</h1>
            )}
            {view === "chat" && project && !workspaceShown && (
              <Badge
                variant="outline"
                className="hidden h-7 max-w-[30%] gap-1.5 bg-card px-2.5 font-normal text-muted-foreground md:flex"
                title={`Project folder: ${project.cwd}`}
              >
                <FolderIcon />
                <span className="truncate [direction:rtl]">&lrm;{project.cwd}</span>
              </Badge>
            )}
            {persona && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(persona)}>
                  <PencilIcon data-icon="inline-start" />
                  Edit agent
                </Button>
                {/* Below the width the duties and memory sit beside the chat at, they open over it. */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label={`${persona.name}: duties and memory`}>
                      <PanelRightIcon />
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="gap-0 p-0 pt-8" aria-describedby={undefined}>
                    <SheetTitle className="sr-only">{persona.name}</SheetTitle>
                    <SheetDescription className="sr-only">Duties and memory.</SheetDescription>
                    <AgentPanel key={persona.id} persona={persona} personas={personas} onDeleted={state.releasePersona} className="flex-1" />
                  </SheetContent>
                </Sheet>
              </>
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
          {view === "settings" && <SettingsView state={state} />}
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

          <div className={view === "chat" && project ? "flex min-h-0 flex-1" : "hidden"}>
            <div data-resize-center className="flex min-w-0 flex-1 flex-col lg:min-w-60">
              <ScrollArea className="min-h-0 flex-1">
                <div data-chat-messages className="mx-auto flex min-h-[calc(100svh-9.75rem-var(--terminal-height))] w-full max-w-3xl flex-col gap-6 px-4 pt-6 pb-8">
                  {messages?.length ? (
                    messages.map((m, i) => (
                      <ChatMessage
                        key={m.id}
                        chatId={chat!.id}
                        message={m}
                        agent={m.role === "assistant" ? agents.find((a) => a.id === m.agent) : undefined}
                        handoffs={handoffs}
                        onHandOff={state.handOff}
                        onRetry={i === messages.length - 1 && i > 0 ? retryLast : undefined}
                      />
                    ))
                  ) : (
                    <Empty className="flex-1">
                      <EmptyHeader className="max-w-lg">
                        <EmptyMedia variant="icon" className="glass size-12 rounded-2xl">
                          {persona ? <AgentMark name={persona.name} className="size-5" /> : <SquareTerminalIcon className="size-5" />}
                        </EmptyMedia>
                        <EmptyTitle className="pb-1 text-3xl font-medium tracking-tight">
                          {persona ? `What should ${persona.name} work on?` : "What are we working on?"}
                        </EmptyTitle>
                        <EmptyDescription className="text-base">
                          {persona ? (
                            <>
                              This is {persona.name}&apos;s chat in <span className="font-medium text-foreground">{project?.name}</span>. It keeps
                              its duties and its memory here, and picks the conversation up where you left it.
                            </>
                          ) : (
                            <>
                              New chat in <span className="font-medium text-foreground">{project?.name}</span>.{" "}
                              Pick an agent below and start typing. You can switch agents at any point; the next one is handed the conversation
                              so far.
                            </>
                          )}
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                  <div ref={bottom} aria-hidden />
                </div>
              </ScrollArea>

              {view === "chat" && project && (
                <div className="relative">
                  {/* One composer per tab, so a draft stays with its tab. */}
                  {handedOff && (
                    <div className="mx-auto flex w-full max-w-3xl px-4 pt-2">
                      <Badge variant="secondary" className="h-7 gap-1.5 pr-1 pl-2 text-foreground">
                        <CornerUpRightIcon />
                        <span className="max-w-64 truncate">{handedOff.name}</span>
                        <span className="font-normal text-muted-foreground">goes with your next message</span>
                        <Button variant="ghost" size="icon-xs" className="rounded-full" aria-label="Remove the handed-off reply" onClick={() => state.dropHandoff(state.activeTab.key)}>
                          <XIcon />
                        </Button>
                      </Badge>
                    </div>
                  )}
                  {state.tabs.map((tab) => (
                    <Composer key={tab.key} branch={workspaceShown ? workspace.data?.git.branch : undefined} state={state} persona={personas.personas.find((p) => p.id === tab.personaId)} active={tab.key === state.activeTab.key} />
                  ))}
                  {context && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto w-full max-w-3xl">
                      <ContextRing
                        context={context}
                        agentName={agents.find((a) => a.id === context.agent)?.short ?? context.agent}
                        className="pointer-events-auto absolute top-4.5 right-6.5"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            {persona && <div style={{ width: agentPanel.width ?? 360 }} className="relative hidden min-w-60 flex-col border-l lg:flex">
              <PanelResizeHandle label="agent details" width={agentPanel.width ?? 360} min={240} max={720} edge="left" onResize={agentPanel.resize} />
              <AgentPanel key={persona.id} persona={persona} personas={personas} onDeleted={state.releasePersona} className="flex-1" />
            </div>}
          </div>
        </div>
        {workspaceShown && workspace.activeDocument && <WorkspaceEditor workspace={workspace} />}
        </div>
        {workspaceShown && <TerminalPanel key={project.id} project={project} branch={workspace.data?.git.branch} open={terminalOpen} onOpenChange={setTerminalOpen} />}
        </div>
        <SearchDialog state={state} open={searching} onOpenChange={setSearching} onPicked={() => setView("chat")} />
        <AgentDialog editing={editing} agents={agents} personas={personas} onClose={() => setEditing(null)} />
      </SidebarInset>
    </SidebarProvider>
  )
}
