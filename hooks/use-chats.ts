"use client"

import * as React from "react"
import { toast } from "sonner"
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
export type SendOptions = { model: string; effort: string; access: Access; files: File[] }

const DEFAULT_PICK: Pick = { agent: "", access: "read", models: {}, efforts: {} }
const fail = (err: unknown) => toast.error(err instanceof Error ? err.message : String(err))

// All app state: detected agents, the chat list, the open chat and its live reply.
export function useChats() {
  const [agents, setAgents] = React.useState<AgentInfo[]>([])
  const [projects, setProjects] = React.useState<Project[]>([])
  const [projectsRoot, setProjectsRoot] = React.useState("")
  const [projectId, setProjectId] = React.useState<string | null>(null)
  const [chats, setChats] = React.useState<ChatSummary[]>([])
  const [chat, setChat] = React.useState<ChatDetail | null>(null)
  const [pick, setPickState] = React.useState<Pick>(DEFAULT_PICK)
  const [ready, setReady] = React.useState(false)
  const events = React.useRef<EventSource | null>(null)
  const openId = React.useRef<string | null>(null)
  const openChatRef = React.useRef<(id: string) => Promise<void>>(async () => {})

  const connected = React.useMemo(() => agents.filter((a) => a.connected), [agents])
  const agent = connected.find((a) => a.id === pick.agent) || connected[0] || null
  const project = projects.find((p) => p.id === projectId) || null
  const running = Boolean(chat?.messages.some((m) => m.role === "assistant" && m.status === "running"))

  const setPick = React.useCallback((change: Partial<Pick>) => {
    setPickState((prev) => {
      const next = { ...prev, ...change }
      localStorage.setItem("pick", JSON.stringify(next))
      return next
    })
  }, [])

  const upsertSummary = React.useCallback((summary: ChatSummary) => {
    setChats((prev) => [summary, ...prev.filter((c) => c.id !== summary.id)].sort((a, b) => b.updatedAt - a.updatedAt))
    setChat((prev) => (prev?.id === summary.id ? { ...prev, ...summary, messages: prev.messages } : prev))
  }, [])

  const closeEvents = React.useCallback(() => {
    events.current?.close()
    events.current = null
  }, [])

  const listen = React.useCallback(
    (chatId: string) => {
      closeEvents()
      const source = new EventSource(`/api/chats/${chatId}/events`)
      events.current = source
      const replace = (message: AssistantMessage) =>
        setChat((prev) => {
          if (prev?.id !== chatId) return prev
          const found = prev.messages.some((m) => m.id === message.id)
          return { ...prev, messages: found ? prev.messages.map((m) => (m.id === message.id ? message : m)) : [...prev.messages, message] }
        })

      source.onmessage = (e) => {
        if (openId.current !== chatId) return source.close()
        const ev: StreamEvent = JSON.parse(e.data)
        if (ev.type === "snapshot") replace(ev.message)
        else if (ev.type === "done") {
          source.close()
          replace(ev.message)
          upsertSummary(ev.chat)
        } else if (ev.type === "idle") {
          source.close()
          openChatRef.current(chatId) // finished while we weren't listening
        } else {
          setChat((prev) => {
            if (prev?.id !== chatId) return prev
            return {
              ...prev,
              messages: prev.messages.map((m) => {
                if (m.role !== "assistant" || m.status !== "running") return m
                const next = structuredClone(m)
                applyEvent(next, ev)
                return next
              }),
            }
          })
        }
      }
      source.onerror = () => {
        source.close()
        setTimeout(() => openId.current === chatId && events.current === source && openChatRef.current(chatId), 1500)
      }
    },
    [closeEvents, upsertSummary]
  )

  const newChat = React.useCallback(() => {
    closeEvents()
    openId.current = null
    setChat(null)
    localStorage.removeItem("chat")
    history.replaceState(null, "", location.pathname)
  }, [closeEvents])

  const openChat = React.useCallback(
    async (id: string) => {
      closeEvents()
      openId.current = id
      try {
        const { chat } = await api<{ chat: ChatDetail }>(`chats/${id}`)
        if (openId.current !== id) return
        setChat(chat)
        setProjectId(chat.projectId)
        localStorage.setItem("project", chat.projectId)
        localStorage.setItem("chat", id)
        history.replaceState(null, "", `#${id}`)
        if (chat.lastAgent) setPick({ agent: chat.lastAgent })
        if (chat.running) listen(id)
      } catch (err) {
        newChat()
        fail(err)
      }
    },
    [closeEvents, listen, newChat, setPick]
  )
  React.useEffect(() => {
    openChatRef.current = openChat
  }, [openChat])

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

  const createChat = React.useCallback(
    async () => {
      const { chat } = await api<{ chat: ChatDetail }>("chats", { method: "POST", body: { projectId } })
      openId.current = chat.id
      setChat(chat)
      upsertSummary(chat)
      localStorage.setItem("chat", chat.id)
      history.replaceState(null, "", `#${chat.id}`)
      return chat
    },
    [projectId, upsertSummary]
  )

  const send = React.useCallback(
    async (text: string, { files, ...options }: SendOptions) => {
      if (!agent || running || !projectId) return false
      try {
        const target = chat ?? (await createChat())
        const attachments: string[] = []
        for (const file of files) {
          const query = new URLSearchParams({ name: file.name, type: file.type })
          const res = await fetch(`/api/chats/${target.id}/uploads?${query}`, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: file,
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.error || `Couldn't upload ${file.name}`)
          attachments.push((data.attachment as Attachment).id)
        }
        const res = await api<{ user: UserMessage; message: AssistantMessage; chat: ChatSummary }>(`chats/${target.id}/messages`, {
          method: "POST",
          body: { text, agent: agent.id, attachments, ...options },
        })
        setChat((prev) => (prev?.id === target.id ? { ...prev, messages: [...prev.messages, res.user, res.message] } : prev))
        upsertSummary(res.chat)
        listen(target.id)
        return true
      } catch (err) {
        fail(err)
        return false
      }
    },
    [agent, chat, createChat, listen, projectId, running, upsertSummary]
  )

  const stop = React.useCallback(() => {
    if (chat) api(`chats/${chat.id}/stop`, { method: "POST" }).catch(fail)
  }, [chat])

  const deleteChat = React.useCallback(
    async (id: string) => {
      try {
        await api(`chats/${id}`, { method: "DELETE" })
        setChats((prev) => prev.filter((c) => c.id !== id))
        if (openId.current === id) newChat()
      } catch (err) {
        fail(err)
      }
    },
    [newChat]
  )

  // Switches to a project, ready for a new chat in it.
  const selectProject = React.useCallback(
    (id: string) => {
      newChat()
      setProjectId(id)
      localStorage.setItem("project", id)
    },
    [newChat]
  )

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
        if (projectId === id) {
          newChat()
          setProjectId(rest[0]?.id ?? null)
        }
      } catch (err) {
        fail(err)
      }
    },
    [newChat, projectId, projects]
  )

  React.useEffect(() => {
    ;(async () => {
      try {
        setPickState({ ...DEFAULT_PICK, ...JSON.parse(localStorage.getItem("pick") || "{}") })
        await loadAgents()
        const [{ projects, root }, { chats }] = await Promise.all([
          api<{ projects: Project[]; root: string }>("projects"),
          api<{ chats: ChatSummary[] }>("chats"),
        ])
        setProjects(projects)
        setProjectsRoot(root)
        setChats(chats)
        const remembered = localStorage.getItem("project")
        setProjectId(projects.some((p) => p.id === remembered) ? remembered : (projects[0]?.id ?? null))
        const last = location.hash.slice(1) || localStorage.getItem("chat")
        if (last && chats.some((c) => c.id === last)) await openChatRef.current(last)
      } catch (err) {
        fail(err)
      } finally {
        setReady(true)
      }
    })()
    return () => events.current?.close()
  }, [loadAgents])

  return {
    ready, agents, connected, agent, projects, projectsRoot, project, chats, chat, running, pick,
    setPick, newChat, openChat, deleteChat, send, stop, recheck, reloadChats, upsertSummary,
    selectProject, createProject, deleteProject,
  }
}

export type ChatsState = ReturnType<typeof useChats>
