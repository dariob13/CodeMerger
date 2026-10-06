// Chats on disk, and the turns currently running. Kept on globalThis so every
// route handler (and every hot reload in development) shares one copy.

import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import crypto from "node:crypto"
import type { ChildProcess } from "node:child_process"
import type {
  AgentInfo,
  AssistantMessage,
  Attachment,
  Automation,
  ChatSummary,
  InboxItem,
  Message,
  UsageReport,
  Note,
  Project,
  StreamEvent,
} from "@/lib/types"
import { detectAgents, loadAgents, type Agent, type DetectedAgent } from "./agents"

export type Chat = {
  id: string
  projectId: string
  title: string
  cwd: string // the project's folder, where the agents run
  createdAt: number
  updatedAt: number
  lastAgent: string | null
  // Per agent: its CLI session, and how many of this chat's messages that session has seen.
  sessions: Record<string, { sessionId: string; seen: number }>
  // Every file uploaded to this chat, by id.
  uploads?: Record<string, Attachment>
  // Set when the chat is a run of an automation.
  automationId?: string
  messages: Message[]
}

export type Listener = { send(ev: StreamEvent): void; close(): void }

export type Run = {
  proc: ChildProcess | null
  stopped: boolean
  message: AssistantMessage
  listeners: Set<Listener>
}

type State = {
  agents: Agent[]
  detected: Promise<DetectedAgent[]> | null
  projects: Project[]
  chats: Map<string, Chat>
  runs: Map<string, Run>
  notes: Note[]
  automations: Automation[]
  inbox: InboxItem[]
  // Rate limits as each agent last reported them, by agent id.
  usage: Record<string, UsageReport & { updatedAt: number }>
  scheduler?: ReturnType<typeof setInterval>
}

const DATA = process.env.CODE_MERGER_DATA || path.join(process.cwd(), "data")
const CHATS = path.join(DATA, "chats")
const UPLOADS = path.join(DATA, "uploads")
export const MAX_UPLOAD = 25 * 1024 * 1024

export const uploadsDir = (chat: Chat) => path.join(UPLOADS, chat.id)

export async function saveUpload(chat: Chat, name: string, type: string, data: Buffer): Promise<Attachment> {
  const id = newId()
  const safe = path.basename(name).replace(/[^\w.-]+/g, "_").slice(-80) || "file"
  const file = path.join(uploadsDir(chat), `${id}-${safe}`)
  await fsp.mkdir(uploadsDir(chat), { recursive: true })
  await fsp.writeFile(file, data)
  const attachment: Attachment = { id, name: path.basename(name).slice(0, 200) || "file", type, size: data.length, path: file }
  ;(chat.uploads ??= {})[id] = attachment
  await saveChat(chat)
  return attachment
}
// Where a new project's folder is created unless the user points it somewhere else.
export const PROJECTS_ROOT = process.env.CODE_MERGER_PROJECTS || path.join(os.homedir(), "Code Merger Projects")

export const newId = () => crypto.randomBytes(8).toString("hex")

export function settleTools(message: AssistantMessage) {
  for (const p of message.parts) if (p.type === "tool" && p.status === "running") p.status = "done"
}

function load(): State {
  fs.mkdirSync(CHATS, { recursive: true })
  const projects = readList<Project>("projects")
  const chats = new Map<string, Chat>()
  for (const file of fs.readdirSync(CHATS)) {
    if (!file.endsWith(".json")) continue
    try {
      const chat: Chat = JSON.parse(fs.readFileSync(path.join(CHATS, file), "utf8"))
      for (const m of chat.messages) {
        // The server went down mid-turn.
        if (m.role === "assistant" && m.status === "running") {
          m.status = "stopped"
          settleTools(m)
        }
      }
      // Chats from before projects existed: file each under a project for the folder it ran in.
      if (!projects.some((p) => p.id === chat.projectId)) {
        let project = projects.find((p) => p.cwd === chat.cwd)
        if (!project) {
          project = { id: newId(), name: path.basename(chat.cwd) || "Project", cwd: chat.cwd, createdAt: chat.createdAt }
          projects.push(project)
          fs.writeFileSync(path.join(DATA, "projects.json"), JSON.stringify(projects, null, 1))
        }
        chat.projectId = project.id
        fs.writeFileSync(path.join(CHATS, file), JSON.stringify(chat, null, 1))
      }
      chats.set(chat.id, chat)
    } catch (err) {
      console.warn(`Skipping unreadable chat ${file}: ${(err as Error).message}`)
    }
  }
  return {
    agents: loadAgents(path.join(DATA, "agents.json")),
    detected: null,
    projects,
    chats,
    runs: new Map(),
    notes: readList<Note>("notes"),
    automations: readList<Automation>("automations"),
    inbox: readList<InboxItem>("inbox"),
    usage: readUsage(),
  }
}

function readList<T>(name: string): T[] {
  try {
    const list = JSON.parse(fs.readFileSync(path.join(DATA, `${name}.json`), "utf8"))
    return Array.isArray(list) ? list : []
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") console.warn(`Ignoring unreadable ${name}.json: ${(err as Error).message}`)
    return []
  }
}

function readUsage(): State["usage"] {
  try {
    const usage = JSON.parse(fs.readFileSync(path.join(DATA, "usage.json"), "utf8"))
    return usage && typeof usage === "object" && !Array.isArray(usage) ? usage : {}
  } catch {
    return {}
  }
}

export async function recordUsage(agentId: string, report: UsageReport | null) {
  if (!report?.windows.length) return
  state.usage[agentId] = { ...state.usage[agentId], ...report, updatedAt: Date.now() }
  const file = path.join(DATA, "usage.json")
  const tmp = `${file}.${newId()}.tmp`
  await fsp.writeFile(tmp, JSON.stringify(state.usage, null, 1))
  await fsp.rename(tmp, file)
}

// Projects, notes, automations and the inbox are small lists, each kept whole in one file.
export async function saveList(name: "projects" | "notes" | "automations" | "inbox") {
  const file = path.join(DATA, `${name}.json`)
  const tmp = `${file}.${newId()}.tmp`
  await fsp.writeFile(tmp, JSON.stringify(state[name], null, 1))
  await fsp.rename(tmp, file)
}

const globalState = globalThis as typeof globalThis & { __codeMerger?: State }
export const state: State = (globalState.__codeMerger ??= load())

export async function saveChat(chat: Chat) {
  const file = path.join(CHATS, `${chat.id}.json`)
  const tmp = `${file}.${newId()}.tmp`
  await fsp.writeFile(tmp, JSON.stringify(chat, null, 1))
  await fsp.rename(tmp, file)
}

export async function removeChat(chat: Chat) {
  state.chats.delete(chat.id)
  await fsp.rm(path.join(CHATS, `${chat.id}.json`), { force: true })
  await fsp.rm(uploadsDir(chat), { recursive: true, force: true })
}

export function summary(chat: Chat): ChatSummary {
  return {
    id: chat.id,
    projectId: chat.projectId,
    title: chat.title,
    cwd: chat.cwd,
    updatedAt: chat.updatedAt,
    lastAgent: chat.lastAgent,
    running: state.runs.has(chat.id),
  }
}

export function expandPath(input: string) {
  const p = input.trim()
  if (p === "~") return os.homedir()
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2))
  return path.resolve(p)
}

export function isDir(p: string) {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

export function detected(refresh = false) {
  if (refresh || !state.detected) state.detected = detectAgents(state.agents)
  return state.detected
}

export async function agentList(refresh = false): Promise<AgentInfo[]> {
  return (await detected(refresh)).map(({ agent, bin, version, auth, authDetail }) => ({
    id: agent.id,
    name: agent.name,
    short: agent.short,
    vendor: agent.vendor,
    color: agent.color,
    command: agent.command,
    install: agent.install,
    login: agent.login,
    models: agent.models,
    efforts: agent.efforts,
    access: agent.access,
    connected: Boolean(bin),
    auth,
    authDetail,
    version,
  }))
}
