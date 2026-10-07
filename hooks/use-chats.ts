"use client"

import * as React from "react"
import { toast } from "sonner"
import { useSettings } from "@/hooks/use-settings"
import { api } from "@/lib/api"
import {
  applyEvent,
  type Access,
  type AgentInfo,
  type AssistantMessage,
  type Attachment,
  type ChatDetail,
  type ChatSummary,
  type Project,
  type StreamEvent,
  type UserMessage,
} from "@/lib/types"

// What the next message is sent with. Model and effort are remembered per agent.
export type Pick = { agent: string; access: Access; models: Record<string, string>; efforts: Record<string, string> }
export type SendOptions = { agent: string; model: string; effort: string; access: Access; files: File[]; skills?: string[] }

// One open tab. A tab without a chat is a new chat that hasn't had its first message yet.
// `personaId` makes it the chat with one of the user's own agents, which is opened from the sidebar instead of the tab strip.
export type Tab = { key: string; chatId: string | null; projectId: string | null; personaId?: string }
type Strip = { tabs: Tab[]; active: string }

const DEFAULT_PICK: Pick = { agent: "", access: "read", models: {}, efforts: {} }
const PICK_STORAGE = "chat-picks"
const BACKGROUND_POLL = 2500
const fail = (err: unknown) => toast.error(err instanceof Error ? err.message : String(err))
const newTab = (projectId: string | null, chatId: string | null = null, personaId?: string): Tab => ({ key: crypto.randomUUID(), chatId, projectId, personaId })
const isRunning = (chat: ChatDetail | undefined) => Boolean(chat?.messages.some((m) => m.role === "assistant" && m.status === "running"))

// A fixed key, so the server and the browser render the same first tab.
const INITIAL: Strip = { tabs: [{ key: "first", chatId: null, projectId: null }], active: "first" }

// Drops the tabs that match. The tab strip is never empty, and the tab beside a closed active tab takes over.
function without(strip: Strip, drop: (tab: Tab) => boolean, fallbackProject: string | null): Strip {
  const tabs = strip.tabs.filter((t) => !drop(t))
  if (!tabs.length) {
    const tab = newTab(fallbackProject)
    return { tabs: [tab], active: tab.key }
  }
  if (tabs.some((t) => t.key === strip.active)) return { tabs, active: strip.active }
  const before = strip.tabs.slice(0, strip.tabs.findIndex((t) => t.key === strip.active)).filter((t) => !drop(t))
  return { tabs, active: (tabs[before.length] ?? tabs[tabs.length - 1]).key }
}

// All app state: detected agents, the chat list, the open tabs and the live reply in the one being looked at.
// Replies in the other tabs keep running on the server; their progress is picked up when the tab is shown.
export function useChats() {
  const [agents, setAgents] = React.useState<AgentInfo[]>([])
  const [projects, setProjects] = React.useState<Project[]>([])
  const [projectsRoot, setProjectsRoot] = React.useState("")
  const [chats, setChats] = React.useState<ChatSummary[]>([])
  const [strip, setStrip] = React.useState<Strip>(INITIAL)
  const [details, setDetails] = React.useState<Record<string, ChatDetail>>({})
  const [picks, setPicks] = React.useState<Record<string, Pick>>({})
  const settings = useSettings()
  const [ready, setReady] = React.useState(false)
  const [retry, setRetry] = React.useState(0)
  // A reply handed to a tab, as a file that goes out with the next message sent from it.
  const [handoffs, setHandoffs] = React.useState<Record<string, File>>({})
  // Counts the changes made here to each chat, so a slower fetch of it doesn't undo them.
  const versions = React.useRef<Record<string, number>>({})

  const { tabs } = strip
  const activeTab = tabs.find((t) => t.key === strip.active) ?? tabs[0]
  const activeChatId = activeTab.chatId
  const chat = (activeChatId && details[activeChatId]) || null
  const pickKey = activeChatId ?? `tab:${activeTab.key}`
  const summary = activeChatId ? chats.find((item) => item.id === activeChatId) : undefined
  const savedReply = chat?.messages.slice().reverse().find((message) => message.role === "assistant")
  const lastAgent = chat?.lastAgent ?? summary?.lastAgent ?? ""
  // A chat without a pick of its own starts from the defaults in Settings.
  const pick = picks[pickKey] ?? {
    ...DEFAULT_PICK,
    access: settings.access,
    efforts: settings.efforts,
    agent: lastAgent,
    models: lastAgent && (savedReply?.model ?? summary?.model) ? { ...settings.models, [lastAgent]: savedReply?.model ?? summary?.model! } : settings.models,
  }
  const connected = React.useMemo(() => agents.filter((a) => a.connected), [agents])
  const agent = connected.find((a) => a.id === pick.agent) || connected[0] || null
  const project = projects.find((p) => p.id === activeTab.projectId) || null
  const running = isRunning(chat ?? undefined)
  // Replies in progress across the open tabs. The chat list knows about the ones not being watched.
  const runningTabs = tabs.filter((t) => t.chatId && (t.key === activeTab.key ? running : chats.find((c) => c.id === t.chatId)?.running)).map((t) => t.key)
  const backgroundBusy = runningTabs.some((key) => key !== activeTab.key)

  const setPick = React.useCallback((change: Partial<Pick>) => {
    setPicks((prev) => {
      const next = { ...prev, [pickKey]: { ...pick, ...change } }
      localStorage.setItem(PICK_STORAGE, JSON.stringify(next))
      return next
    })
  }, [pick, pickKey])

  const mutate = React.useCallback((chatId: string, change: (chat: ChatDetail) => ChatDetail) => {
    versions.current[chatId] = (versions.current[chatId] ?? 0) + 1
    setDetails((prev) => (prev[chatId] ? { ...prev, [chatId]: change(prev[chatId]) } : prev))
  }, [])

  const upsertSummary = React.useCallback((summary: ChatSummary) => {
    setChats((prev) => [summary, ...prev.filter((c) => c.id !== summary.id)].sort((a, b) => b.updatedAt - a.updatedAt))
    setDetails((prev) => (prev[summary.id] ? { ...prev, [summary.id]: { ...prev[summary.id], ...summary } } : prev))
  }, [])

  // Fetches a chat into its tab. A fetch that was overtaken by changes made here is dropped, unless `force`d.
  const loadChat = React.useCallback(async (id: string, force = false) => {
    const version = versions.current[id] ?? 0
    try {
      const { chat } = await api<{ chat: ChatDetail }>(`chats/${id}`)
      if (!force && (versions.current[id] ?? 0) !== version) return null
      setDetails((prev) => ({ ...prev, [id]: chat }))
      setStrip((prev) => ({ ...prev, tabs: prev.tabs.map((t) => (t.chatId === id && (t.projectId !== chat.projectId || t.personaId !== chat.personaId) ? { ...t, projectId: chat.projectId, personaId: chat.personaId } : t)) }))
      return chat
    } catch (err) {
      if (force) return null
      // Gone, or unreachable: its tab goes back to a new chat.
      setStrip((prev) => ({ ...prev, tabs: prev.tabs.map((t) => (t.chatId === id ? { ...t, chatId: null } : t)) }))
      fail(err)
      return null
    }
  }, [])

  const selectTab = React.useCallback((key: string) => setStrip((prev) => ({ ...prev, active: key })), [])

  const closeTab = React.useCallback((key: string) => {
    setStrip((prev) => without(prev, (t) => t.key === key, prev.tabs.find((t) => t.key === key)?.projectId ?? null))
  }, [])

  // Opens a new tab in the project being looked at.
  const newChat = React.useCallback(() => {
    setStrip((prev) => {
      const tab = newTab(prev.tabs.find((t) => t.key === prev.active)?.projectId ?? null)
      return { tabs: [...prev.tabs, tab], active: tab.key }
    })
  }, [])

  // Shows a chat: in the tab it is already open in, in place of an unused new chat, or in a new tab.
  const openChat = React.useCallback(
    (id: string, knownProjectId?: string) => {
      const known = chats.find((c) => c.id === id)
      const projectId = knownProjectId ?? known?.projectId ?? null
      setStrip((prev) => {
        const open = prev.tabs.find((t) => t.chatId === id)
        if (open) return { ...prev, active: open.key }
        const current = prev.tabs.find((t) => t.key === prev.active)
        if (current && !current.chatId && !current.personaId && !known?.personaId) {
          return { ...prev, tabs: prev.tabs.map((t) => (t === current ? { ...t, chatId: id, projectId: projectId ?? t.projectId } : t)) }
        }
        const tab = newTab(projectId, id, known?.personaId)
        return { tabs: [...prev.tabs, tab], active: tab.key }
      })
    },
    [chats]
  )

  // Shows the chat with one of the user's own agents in the project being looked at. Each agent has one per project.
  const openAgent = React.useCallback(
    (personaId: string) => {
      setStrip((prev) => {
        const projectId = prev.tabs.find((t) => t.key === prev.active)?.projectId ?? null
        const open = prev.tabs.find((t) => t.personaId === personaId && t.projectId === projectId)
        if (open) return { ...prev, active: open.key }
        const tab = newTab(projectId, chats.find((c) => c.personaId === personaId && c.projectId === projectId)?.id ?? null, personaId)
        return { tabs: [...prev.tabs, tab], active: tab.key }
      })
    },
    [chats]
  )

  // An agent that was deleted leaves its chats behind as ordinary chats.
  const releasePersona = React.useCallback((personaId: string) => {
    const release = <T extends { personaId?: string }>(item: T) => (item.personaId === personaId ? { ...item, personaId: undefined } : item)
    setChats((prev) => prev.map(release))
    setDetails((prev) => Object.fromEntries(Object.entries(prev).map(([id, chat]) => [id, release(chat)])))
    setStrip((prev) => ({ ...prev, tabs: prev.tabs.map(release) }))
  }, [])

  const loadAgents = React.useCallback(async (refresh = false) => {
    setAgents((await api<{ agents: AgentInfo[] }>(`agents${refresh ? "?refresh" : ""}`)).agents)
  }, [])

  const reloadChats = React.useCallback(async () => {
    try {
      setChats((await api<{ chats: ChatSummary[] }>("chats")).chats)
    } catch {
      // Keep the list we have; the next reload will catch up.
    }
  }, [])

  const recheck = React.useCallback(() => loadAgents(true).catch(fail), [loadAgents])

  const send = React.useCallback(
    async (text: string, { files, ...options }: SendOptions) => {
      const tab = activeTab
      if (!options.agent || running || !tab.projectId) return false
      try {
        let id = tab.chatId
        if (!id) {
          const { chat } = await api<{ chat: ChatDetail }>("chats", { method: "POST", body: { projectId: tab.projectId, personaId: tab.personaId } })
          id = chat.id
          versions.current[id] = 1
          setDetails((prev) => ({ ...prev, [chat.id]: chat }))
          setStrip((prev) => ({ ...prev, tabs: prev.tabs.map((t) => (t.key === tab.key ? { ...t, chatId: chat.id } : t)) }))
          upsertSummary(chat)
          setPicks((prev) => {
            const temporary = `tab:${tab.key}`
            const next = { ...prev, [chat.id]: { ...(prev[temporary] ?? DEFAULT_PICK), agent: options.agent, models: { ...(prev[temporary]?.models ?? {}), [options.agent]: options.model }, efforts: { ...(prev[temporary]?.efforts ?? {}), [options.agent]: options.effort }, access: options.access } }
            delete next[temporary]
            localStorage.setItem(PICK_STORAGE, JSON.stringify(next))
            return next
          })
        }
        const attachments: string[] = []
        const handed = handoffs[tab.key]
        for (const file of handed ? [handed, ...files] : files) {
          const query = new URLSearchParams({ name: file.name, type: file.type })
          const res = await fetch(`/api/chats/${id}/uploads?${query}`, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: file,
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.error || `Couldn't upload ${file.name}`)
          attachments.push((data.attachment as Attachment).id)
        }
        const res = await api<{ user: UserMessage; message: AssistantMessage; chat: ChatSummary }>(`chats/${id}/messages`, {
          method: "POST",
          body: { text, attachments, ...options },
        })
        // A fetch of the chat may have brought the new messages in already.
        mutate(id, (chat) => ({ ...chat, messages: [...chat.messages, ...[res.user, res.message].filter((m) => !chat.messages.some((old) => old.id === m.id))] }))
        upsertSummary(res.chat)
        if (handed) setHandoffs((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== tab.key)))
        return true
      } catch (err) {
        fail(err)
        return false
      }
    },
    [activeTab, handoffs, mutate, running, upsertSummary]
  )

  // Runs a chat's last prompt again; the new reply takes the place of the one it got.
  const retryReply = React.useCallback(
    async (chatId: string, agentId: string) => {
      const replier = agents.find((a) => a.id === agentId)
      try {
        const res = await api<{ user: UserMessage; message: AssistantMessage; chat: ChatSummary }>(`chats/${chatId}/retry`, {
          method: "POST",
          body: { effort: pick.efforts[agentId] ?? "", access: replier?.access.includes(pick.access) ? pick.access : "read" },
        })
        mutate(chatId, (chat) => ({ ...chat, messages: [...chat.messages.slice(0, -2), res.user, res.message] }))
        upsertSummary(res.chat)
      } catch (err) {
        fail(err)
      }
    },
    [agents, mutate, pick.access, pick.efforts, upsertSummary]
  )

  // Gives a reply to a new chat with an agent, or to a chat already open in a tab, and goes there.
  const handOff = React.useCallback(
    (reply: { text: string; from: string }, target: { agent: string } | { tabKey: string }) => {
      const name = `reply-from-${reply.from.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agent"}.md`
      const file = new File([reply.text], name, { type: "text/markdown" })
      if ("tabKey" in target) {
        setHandoffs((prev) => ({ ...prev, [target.tabKey]: file }))
        setStrip((prev) => (prev.tabs.some((t) => t.key === target.tabKey) ? { ...prev, active: target.tabKey } : prev))
        return
      }
      const tab = newTab(activeTab.projectId)
      setHandoffs((prev) => ({ ...prev, [tab.key]: file }))
      setStrip((prev) => ({ tabs: [...prev.tabs, tab], active: tab.key }))
      setPick({ agent: target.agent })
    },
    [activeTab.projectId, setPick]
  )

  const dropHandoff = React.useCallback((tabKey: string) => {
    setHandoffs((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== tabKey)))
  }, [])

  const stop = React.useCallback(() => {
    if (activeChatId) api(`chats/${activeChatId}/stop`, { method: "POST" }).catch(fail)
  }, [activeChatId])

  const deleteChat = React.useCallback(async (id: string) => {
    try {
      await api(`chats/${id}`, { method: "DELETE" })
      setChats((prev) => prev.filter((c) => c.id !== id))
      // Its tab stays, as a new chat in the same project.
      setStrip((prev) => ({ ...prev, tabs: prev.tabs.map((t) => (t.chatId === id ? { ...t, chatId: null } : t)) }))
    } catch (err) {
      fail(err)
    }
  }, [])

  // Switches to a project, ready for a new chat in it.
  const selectProject = React.useCallback((id: string) => {
    localStorage.setItem("project", id)
    setStrip((prev) => {
      const current = prev.tabs.find((t) => t.key === prev.active)
      if (current && !current.chatId && !current.personaId) return { ...prev, tabs: prev.tabs.map((t) => (t === current ? { ...t, projectId: id } : t)) }
      const unused = prev.tabs.find((t) => !t.chatId && !t.personaId && t.projectId === id)
      if (unused) return { ...prev, active: unused.key }
      const tab = newTab(id)
      return { tabs: [...prev.tabs, tab], active: tab.key }
    })
  }, [])

  // Returns an error message for the form to show, or null on success.
  const createProject = React.useCallback(
    async (name: string, cwd: string) => {
      try {
        const { project } = await api<{ project: Project }>("projects", { method: "POST", body: { name, cwd } })
        setProjects((prev) => [project, ...prev])
        selectProject(project.id)
        return null
      } catch (err) {
        return err instanceof Error ? err.message : String(err)
      }
    },
    [selectProject]
  )

  const deleteProject = React.useCallback(
    async (id: string) => {
      try {
        await api(`projects/${id}`, { method: "DELETE" })
        const rest = projects.filter((p) => p.id !== id)
        setProjects(rest)
        setChats((prev) => prev.filter((c) => c.projectId !== id))
        setStrip((prev) => without(prev, (t) => t.projectId === id, rest[0]?.id ?? null))
      } catch (err) {
        fail(err)
      }
    },
    [projects]
  )

  // The reply in the tab being looked at, as it is written.
  React.useEffect(() => {
    if (!activeChatId || !running) return
    const chatId = activeChatId
    const source = new EventSource(`/api/chats/${chatId}/events`)
    let reconnect: ReturnType<typeof setTimeout> | undefined
    const replace = (message: AssistantMessage) =>
      mutate(chatId, (chat) => {
        const found = chat.messages.some((m) => m.id === message.id)
        return { ...chat, messages: found ? chat.messages.map((m) => (m.id === message.id ? message : m)) : [...chat.messages, message] }
      })

    source.onmessage = (e) => {
      const ev: StreamEvent = JSON.parse(e.data)
      if (ev.type === "snapshot") replace(ev.message)
      else if (ev.type === "done") {
        source.close()
        replace(ev.message)
        upsertSummary(ev.chat)
      } else if (ev.type === "idle") {
        source.close()
        loadChat(chatId, true) // finished while we weren't listening
      } else {
        mutate(chatId, (chat) => ({
          ...chat,
          messages: chat.messages.map((m) => {
            if (m.role !== "assistant" || m.status !== "running") return m
            const next = structuredClone(m)
            applyEvent(next, ev)
            return next
          }),
        }))
      }
    }
    source.onerror = () => {
      source.close()
      reconnect = setTimeout(() => loadChat(chatId, true).finally(() => setRetry((n) => n + 1)), 1500)
    }
    return () => {
      source.close()
      clearTimeout(reconnect)
    }
  }, [activeChatId, running, retry, loadChat, mutate, upsertSummary])

  // Coming to a tab: catch up on what its chat did in the background.
  React.useEffect(() => {
    if (!ready) return
    history.replaceState(null, "", activeChatId ? `#${activeChatId}` : location.pathname)
    if (!activeChatId) return
    const timer = setTimeout(() => void loadChat(activeChatId), 0)
    return () => {
      clearTimeout(timer)
    }
  }, [activeChatId, activeTab.key, loadChat, ready])

  // The tabs not being looked at report back through the chat list.
  React.useEffect(() => {
    if (!backgroundBusy) return
    const timer = setInterval(reloadChats, BACKGROUND_POLL)
    return () => clearInterval(timer)
  }, [backgroundBusy, reloadChats])

  React.useEffect(() => {
    if (!ready) return
    // An agent's chat that hasn't had a message yet is opened again from the sidebar.
    const kept = tabs.filter((t) => t.chatId || !t.personaId)
    localStorage.setItem("tabs", JSON.stringify({ tabs: kept.map(({ chatId, projectId }) => ({ chatId, projectId })), active: kept.indexOf(activeTab) }))
    if (activeTab.projectId) localStorage.setItem("project", activeTab.projectId)
  }, [activeTab, ready, tabs])

  React.useEffect(() => {
    ;(async () => {
      try {
        const storedPicks = JSON.parse(localStorage.getItem(PICK_STORAGE) || "{}")
        if (storedPicks && typeof storedPicks === "object" && !Array.isArray(storedPicks)) setPicks(storedPicks)
        await loadAgents()
        const [{ projects, root }, { chats }] = await Promise.all([
          api<{ projects: Project[]; root: string }>("projects"),
          api<{ chats: ChatSummary[] }>("chats"),
        ])
        setProjects(projects)
        setProjectsRoot(root)
        setChats(chats)

        // Last session's tabs, without the chats and projects that are gone since.
        const remembered = localStorage.getItem("project")
        const fallback = projects.some((p) => p.id === remembered) ? remembered : (projects[0]?.id ?? null)
        let saved: { tabs?: { chatId?: unknown; projectId?: unknown }[]; active?: unknown } = {}
        try {
          saved = JSON.parse(localStorage.getItem("tabs") || "{}") || {}
        } catch {
          // Unreadable: start with one tab.
        }
        const restored = (Array.isArray(saved.tabs) ? saved.tabs : []).flatMap((t) => {
          const found = chats.find((c) => c.id === t?.chatId)
          if (found) return [newTab(found.projectId, found.id, found.personaId)]
          return !t?.chatId && projects.some((p) => p.id === t?.projectId) ? [newTab(t.projectId as string)] : []
        })
        let active: Tab | undefined = restored[typeof saved.active === "number" ? saved.active : -1]
        const linked = chats.find((c) => c.id === location.hash.slice(1))
        if (linked) {
          active = restored.find((t) => t.chatId === linked.id)
          if (!active) restored.push((active = newTab(linked.projectId, linked.id, linked.personaId)))
        }
        if (!restored.length) restored.push(newTab(fallback))
        setStrip({ tabs: restored, active: (active ?? restored[0]).key })
      } catch (err) {
        fail(err)
      } finally {
        setReady(true)
      }
    })()
  }, [loadAgents])

  return {
    ready, agents, connected, agent, projects, projectsRoot, project, chats, chat, running, pick,
    tabs, activeTab, runningTabs, selectTab, closeTab,
    handoffs, handOff, dropHandoff, retryReply,
    setPick, newChat, openChat, openAgent, releasePersona, deleteChat, send, stop, recheck, reloadChats, upsertSummary,
    selectProject, createProject, deleteProject,
  }
}

export type ChatsState = ReturnType<typeof useChats>
