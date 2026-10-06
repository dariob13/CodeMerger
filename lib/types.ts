// Shapes shared by the server (lib/server) and the interface (components).

export type Access = "read" | "edit" | "full"
export type ToolStatus = "running" | "done" | "error"

export type TextPart = { type: "text"; text: string }
export type ToolPart = { type: "tool"; id: string; name: string; detail: string; status: ToolStatus }
export type Part = TextPart | ToolPart

// A file the user added to a message. It is stored on disk and agents are pointed at its path.
export type Attachment = { id: string; name: string; type: string; size: number; path: string }

export type UserMessage = { id: string; role: "user"; text: string; attachments?: Attachment[]; ts: number }
export type AssistantMessage = {
  id: string
  role: "assistant"
  agent: string
  model: string
  parts: Part[]
  status: "running" | "done" | "error" | "stopped"
  error?: string
  ts: number
  finishedAt?: number // persisted when the agent ends; absent in older chats
  persona?: { id: string; name: string } // set when one of the user's own agents answered
  remembered?: string[] // what that agent saved to its memory from this reply
}
export type Message = UserMessage | AssistantMessage

// A folder on disk that every agent works in. Chats and automations belong to a project.
export type Project = { id: string; name: string; cwd: string; createdAt: number }

export type ChatSummary = {
  id: string
  projectId: string
  title: string
  cwd: string
  updatedAt: number
  lastAgent: string | null
  running: boolean
}
export type ChatDetail = ChatSummary & { messages: Message[] }

export type AgentInfo = {
  id: string
  name: string
  short: string
  vendor: string
  color: string
  command: string
  install: string
  login: string
  models: [value: string, label: string][]
  efforts: [value: string, label: string][]
  access: Access[]
  connected: boolean // its CLI is installed
  auth: AuthState
  authDetail: string
  version: string
}

// Whether the CLI is signed in: "unknown" when the CLI has no way to ask.
export type AuthState = "ok" | "none" | "unknown"

export const isImage = (file: { type: string }) => /^image\/(png|jpeg|gif|webp)$/.test(file.type)

// Normalized output of every agent CLI, and what the events stream carries to the browser.
export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; tool: Partial<ToolPart> & { id: string } }
  | { type: "error"; message: string }

export type StreamEvent =
  | AgentEvent
  | { type: "snapshot"; message: AssistantMessage }
  | { type: "done"; message: AssistantMessage; chat: ChatSummary }
  | { type: "idle" }

export function applyEvent(message: AssistantMessage, ev: StreamEvent) {
  if (ev.type === "text") {
    const last = message.parts[message.parts.length - 1]
    if (last && last.type === "text") last.text += ev.delta
    else message.parts.push({ type: "text", text: ev.delta })
  } else if (ev.type === "tool") {
    const given = Object.fromEntries(Object.entries(ev.tool).filter(([, v]) => v !== undefined && v !== ""))
    const existing = message.parts.find((p) => p.type === "tool" && p.id === ev.tool.id)
    if (existing) Object.assign(existing, given)
    else message.parts.push({ type: "tool", name: "Tool", detail: "", status: "running", ...ev.tool })
  } else if (ev.type === "error") {
    message.error = ev.message
  }
}

// ---------- notes, automations, inbox ----------

export type Note = { id: string; title: string; body: string; createdAt: number; updatedAt: number }

export type Schedule =
  | { kind: "manual" }
  | { kind: "interval"; minutes: number }
  | { kind: "daily"; time: string } // "HH:MM", local time

// A prompt the user wrote that runs on a schedule. Each run is a new chat, and its result lands in the inbox.
export type Automation = {
  id: string
  name: string
  prompt: string
  agent: string
  model: string
  effort: string
  access: Access
  projectId: string
  schedule: Schedule
  enabled: boolean
  createdAt: number
  lastRunAt: number | null
  nextRunAt: number | null
}

export type InboxItem = {
  id: string
  title: string
  preview: string
  status: "done" | "error" | "stopped"
  chatId: string | null
  automationId: string
  agent: string
  ts: number
  read: boolean
}

// ---------- agents the user sets up ----------

export type Memory = { id: string; text: string; ts: number }

// A named agent with standing duties and a memory. It answers through one of the agent CLIs.
export type Persona = {
  id: string
  name: string
  duties: string
  agent: string // the CLI it runs on
  memories: Memory[]
  createdAt: number
  updatedAt: number
  lastUsedAt: number | null
}

// ---------- usage ----------

// One rate-limit window as the agent's provider reports it, e.g. "5-hour" at 43% used.
export type UsageWindow = { label: string; used: number; resetsAt: number }
export type UsageReport = { windows: UsageWindow[]; plan?: string }

export type AgentUsage = {
  agent: string
  windows: UsageWindow[] // empty when the CLI doesn't report its limits
  plan: string
  updatedAt: number | null // when the limits were last reported
  // Replies this app got from the agent, counted from its own chats.
  recent: { fiveHours: number; week: number }
}
