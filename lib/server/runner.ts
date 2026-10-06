// Runs one turn of a chat through an agent CLI and streams it to whoever is listening.

import { spawn } from "node:child_process"
import {
  applyEvent,
  type Access,
  type AssistantMessage,
  type Attachment,
  type Message,
  type Persona,
  type StreamEvent,
  type UserMessage,
} from "@/lib/types"
import { childEnv, type DetectedAgent, type ParsedEvent } from "./agents"
import { keepMemories, personaPreamble } from "./personas"
import { newId, recordUsage, saveChat, settleTools, state, summary, uploadsDir, type Chat, type Run } from "./store"

const HANDOFF_LIMIT = 60000 // chars of earlier conversation given to an agent that missed it

type TurnOptions = { model: string; effort: string; access: Access; userIndex: number; persona?: Persona }
type AttemptOptions = { prompt: string; sessionId: string | null; model: string; effort: string; access: Access; attachments: Attachment[] }
type AttemptResult = { sessionId: string | null; code: number | null; stderr: string }

// Agents get attachments as paths on disk, which they read with their own tools.
function withAttachments(text: string, attachments: Attachment[] = []) {
  if (!attachments.length) return text
  return [
    text,
    "",
    "<attached_files>",
    ...attachments.map((a) => `${a.path} (${a.type || "unknown type"})`),
    "</attached_files>",
    "The user attached the files above to this message. Open them from those paths as needed.",
  ].join("\n")
}

export function messageText(m: Message) {
  if (m.role === "user") return withAttachments(m.text, m.attachments)
  return m.parts
    .flatMap((p) => (p.type === "text" ? [p.text] : []))
    .join("\n\n")
    .trim()
}

// What the agent hasn't seen yet: turns handled by other agents since it last spoke.
function buildPrompt(earlier: Message[], text: string) {
  const lines = earlier
    .map((m) => {
      const body = messageText(m)
      if (!body) return ""
      const who = m.role === "user" ? "User" : `Assistant (${state.agents.find((a) => a.id === m.agent)?.name || m.agent})`
      return `${who}:\n${body}`
    })
    .filter(Boolean)
  if (!lines.length) return text
  let transcript = lines.join("\n\n")
  if (transcript.length > HANDOFF_LIMIT) transcript = "[…earlier turns omitted…]\n\n" + transcript.slice(-HANDOFF_LIMIT)
  return [
    "You are picking up a conversation in a chat app where the user can switch between AI agents.",
    "The turns below happened without you (some were answered by other agents). Use them as context, then answer the latest message.",
    "",
    "<conversation_so_far>",
    transcript,
    "</conversation_so_far>",
    "",
    "Latest message from the user:",
    text,
  ].join("\n")
}

function broadcast(run: Run, ev: StreamEvent) {
  for (const listener of run.listeners) listener.send(ev)
}

function attempt(run: Run, chat: Chat, info: DetectedAgent, options: AttemptOptions) {
  return new Promise<AttemptResult>((resolve) => {
    const { agent } = info
    const spec = agent.build({ ...options, uploadsDir: uploadsDir(chat) })
    const parse = agent.createParser?.()
    const result: AttemptResult = { sessionId: null, code: null, stderr: "" }
    let buffer = ""

    const emit = (ev: ParsedEvent) => {
      if (ev.type === "session") {
        result.sessionId = ev.id
        return
      }
      if (ev.type === "usage") {
        recordUsage(agent.id, ev.usage).catch(console.error)
        return
      }
      applyEvent(run.message, ev)
      if (ev.type !== "error") broadcast(run, ev)
    }
    const onLine = (line: string) => {
      if (!line.trim() || !parse) return
      let ev: unknown
      try {
        ev = JSON.parse(line)
      } catch {
        result.stderr = (result.stderr + line + "\n").slice(-2000)
        return
      }
      for (const out of parse(ev)) emit(out)
    }

    const proc = spawn(info.bin!, spec.args, { cwd: chat.cwd, env: childEnv(), detached: true, stdio: ["pipe", "pipe", "pipe"] })
    run.proc = proc
    proc.stdin.on("error", () => {})
    proc.stdin.end(spec.stdin ?? "")
    proc.stdout.setEncoding("utf8")
    proc.stderr.setEncoding("utf8")
    proc.stdout.on("data", (chunk: string) => {
      if (!parse) return emit({ type: "text", delta: chunk })
      buffer += chunk
      let nl: number
      while ((nl = buffer.indexOf("\n")) >= 0) {
        onLine(buffer.slice(0, nl))
        buffer = buffer.slice(nl + 1)
      }
    })
    proc.stderr.on("data", (chunk: string) => {
      result.stderr = (result.stderr + chunk).slice(-2000)
    })
    proc.on("error", (err) => {
      result.stderr = err.message
      resolve(result)
    })
    proc.on("close", (code) => {
      if (buffer) onLine(buffer)
      result.code = code
      resolve(result)
    })
  })
}

async function runTurn(chat: Chat, run: Run, info: DetectedAgent, { model, effort, access, userIndex, persona }: TurnOptions) {
  const { agent } = info
  const message = run.message
  const user = chat.messages[userIndex]
  const text = messageText(user)
  const shared = { model, effort, access, attachments: (user.role === "user" && user.attachments) || [] }
  const known = agent.plainText ? undefined : chat.sessions[agent.id]
  const failed = (r: AttemptResult) => !run.stopped && Boolean(message.error || r.code !== 0)
  // One of the user's own agents: its duties and memory go ahead of every prompt.
  const role = persona ? personaPreamble(persona) : ""

  let result = await attempt(run, chat, info, {
    prompt: role + buildPrompt(chat.messages.slice(known ? known.seen : 0, userIndex), text),
    sessionId: known?.sessionId || null,
    ...shared,
  })

  // A stored session can go stale (expired, cleared by the CLI). Start over with the full transcript.
  if (known && failed(result) && !messageText(message)) {
    message.parts = []
    delete message.error
    broadcast(run, { type: "snapshot", message })
    result = await attempt(run, chat, info, { prompt: role + buildPrompt(chat.messages.slice(0, userIndex), text), sessionId: null, ...shared })
  }

  settleTools(message)
  if (run.stopped) {
    message.status = "stopped"
    delete message.error
  } else if (failed(result)) {
    message.status = "error"
    message.error ||= result.stderr.trim().split("\n").slice(-6).join("\n") || `${agent.name} exited with code ${result.code}`
  } else if (!message.parts.length) {
    message.status = "error"
    message.error = `${agent.name} finished without a reply.`
  } else {
    message.status = "done"
  }
  if (persona && message.status !== "error") await keepMemories(persona, message).catch(console.error)

  message.finishedAt = Date.now()
  if (result.sessionId) chat.sessions[agent.id] = { sessionId: result.sessionId, seen: chat.messages.length }
  if (agent.readUsage && result.sessionId) await recordUsage(agent.id, await agent.readUsage(result.sessionId).catch(() => null)).catch(console.error)
  chat.updatedAt = Date.now()
}

type NewTurn = { text: string; attachments?: Attachment[]; model: string; effort: string; access: Access; persona?: Persona }

// Adds the user's message and an empty reply to the chat, then starts the agent on it.
export function startTurn(chat: Chat, info: DetectedAgent, turn: NewTurn, onDone?: (message: AssistantMessage) => void) {
  const now = Date.now()
  const userIndex = chat.messages.length
  const user: UserMessage = { id: newId(), role: "user", text: turn.text, ts: now }
  if (turn.attachments?.length) user.attachments = turn.attachments
  const message: AssistantMessage = { id: newId(), role: "assistant", agent: info.agent.id, model: turn.model, parts: [], status: "running", ts: now }
  if (turn.persona) message.persona = { id: turn.persona.id, name: turn.persona.name }
  if (!userIndex && chat.title === "New chat") chat.title = (turn.text || user.attachments?.[0].name || "New chat").replace(/\s+/g, " ").slice(0, 60)
  chat.messages.push(user, message)
  chat.lastAgent = info.agent.id
  chat.updatedAt = now

  const run: Run = { proc: null, stopped: false, message, listeners: new Set() }
  state.runs.set(chat.id, run)
  runTurn(chat, run, info, { model: turn.model, effort: turn.effort, access: turn.access, userIndex, persona: turn.persona })
    .catch((err: Error) => {
      console.error(err)
      settleTools(message)
      message.status = "error"
      message.error = err.message
    })
    .finally(async () => {
      message.finishedAt ??= Date.now() // also covers errors thrown before a CLI result
      chat.updatedAt = Date.now()
      state.runs.delete(chat.id)
      await saveChat(chat).catch((err) => console.error(`Could not save chat ${chat.id}: ${err.message}`))
      broadcast(run, { type: "done", message, chat: summary(chat) })
      for (const listener of run.listeners) listener.close()
      onDone?.(message)
    })
  return { user, message }
}

export function stopRun(run: Run) {
  run.stopped = true
  const pid = run.proc?.pid
  if (!pid) return
  try {
    process.kill(-pid, "SIGTERM")
  } catch {
    run.proc?.kill("SIGTERM")
  }
}
