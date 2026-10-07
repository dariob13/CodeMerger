// Agent registry. Each agent is a CLI that can run one turn non-interactively.
// An adapter says how to invoke it (build) and how to turn its output into
// normalized events (createParser). A `session` event carries the id used to
// resume the CLI's own session on the next turn.

import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { execFile } from "node:child_process"
import { isImage, type Access, type AgentEvent, type Attachment, type AuthState, type UsageReport, type UsageWindow } from "@/lib/types"

// How full a session's context window is, in tokens.
export type SessionContext = { used: number; window: number }

export type ParsedEvent = AgentEvent | { type: "session"; id: string } | { type: "usage"; usage: UsageReport }

type BuildOptions = {
  prompt: string // already lists the attachment paths
  sessionId: string | null
  model: string
  effort: string
  access: Access
  attachments: Attachment[]
  uploadsDir: string
}

type AuthCheck = { args: string[]; parse(stdout: string, code: number): { state: AuthState; detail: string } }

export type Agent = {
  id: string
  name: string
  short: string
  vendor: string
  command: string
  aliases?: string[] // other names its CLI is installed under
  color: string
  install: string
  login: string
  models: [string, string][]
  efforts: [string, string][]
  access: Access[]
  auth?: AuthCheck
  // For CLIs that record their rate limits on disk instead of in their output: the limits
  // after the given session's last turn, or the most recent ones known when no session is given.
  readUsage?(sessionId?: string): Promise<UsageReport | null>
  // How much of its context window the session had used after its last turn, when the CLI tells.
  readContext?(sessionId: string): Promise<SessionContext | null>
  // stdout is the answer; no sessions, so the transcript is replayed each turn
  plainText?: boolean
  build(options: BuildOptions): { args: string[]; stdin?: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each CLI has its own JSON event shape
  createParser?(): (ev: any) => ParsedEvent[]
}

export type DetectedAgent = { agent: Agent; bin: string | null; version: string; auth: AuthState; authDetail: string }

function clip(value: unknown, n = 200) {
  const s = String(value ?? "").replace(/\s+/g, " ").trim()
  return s.length > n ? s.slice(0, n - 1) + "…" : s
}

function describeInput(input: unknown) {
  if (input == null) return ""
  if (typeof input === "string") return clip(input)
  const record = input as Record<string, unknown>
  const key = ["command", "file_path", "filePath", "path", "pattern", "url", "query", "description", "prompt"].find(
    (k) => typeof record[k] === "string" && record[k]
  )
  if (key) return clip(record[key])
  const json = JSON.stringify(input)
  return json === "{}" ? "" : clip(json)
}

// Emits a blank line between separate assistant messages within one turn.
function textJoiner() {
  let any = false
  let pendingBreak = false
  return {
    breakNext() {
      if (any) pendingBreak = true
    },
    push(out: ParsedEvent[], delta: unknown) {
      if (typeof delta !== "string" || !delta) return
      if (pendingBreak) {
        out.push({ type: "text", delta: "\n\n" })
        pendingBreak = false
      }
      any = true
      out.push({ type: "text", delta })
    },
    get any() {
      return any
    },
  }
}

function windowLabel(minutes: number) {
  if (minutes === 300) return "5-hour"
  if (minutes === 10080) return "Weekly"
  return minutes % 1440 === 0 ? `${minutes / 1440}-day` : `${Math.round(minutes / 60)}-hour`
}

// Codex writes each session to ~/.codex/sessions/YYYY/MM/DD/rollout-<time>-<thread id>.jsonl, and every turn
// in it ends with a token_count event carrying the account's rate limits and the session's token counts.
// Returns those events for a session, or for the most recent one when no session is given, newest first.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Codex's own event shape
async function codexTokenCounts(sessionId?: string): Promise<any[]> {
  const root = path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "sessions")
  const newestFirst = async (dir: string) => (await fsp.readdir(dir).catch(() => [] as string[])).sort().reverse()
  const days: string[] = []
  for (const year of await newestFirst(root)) {
    for (const month of await newestFirst(path.join(root, year))) {
      for (const day of await newestFirst(path.join(root, year, month))) days.push(path.join(root, year, month, day))
      if (days.length >= 3) break
    }
    if (days.length >= 3) break
  }

  let file: string | null = null
  let newest = 0
  for (const day of days.slice(0, 3)) {
    for (const name of await newestFirst(day)) {
      if (!name.startsWith("rollout-") || !name.endsWith(".jsonl")) continue
      const full = path.join(day, name)
      if (sessionId) {
        if (name.endsWith(`${sessionId}.jsonl`)) file = full
        continue
      }
      const modified = (await fsp.stat(full).catch(() => null))?.mtimeMs ?? 0
      if (modified > newest) [newest, file] = [modified, full]
    }
    if (file && sessionId) break
  }
  if (!file) return []

  // The events we want are near the end; a long session's file can be large.
  const handle = await fsp.open(/* turbopackIgnore: true */ file, "r") // a path outside the project, found at run time
  try {
    const { size } = await handle.stat()
    const length = Math.min(size, 512 * 1024)
    const { buffer } = await handle.read(Buffer.alloc(length), 0, length, size - length)
    const events = []
    for (const line of buffer.toString("utf8").split("\n").reverse()) {
      if (!line.includes('"token_count"')) continue
      try {
        events.push(JSON.parse(line).payload)
      } catch {
        // A line cut in half by the tail read; keep looking.
      }
    }
    return events
  } finally {
    await handle.close()
  }
}

async function codexUsage(sessionId?: string): Promise<UsageReport | null> {
  for (const event of await codexTokenCounts(sessionId)) {
    const limits = event?.rate_limits
    const windows: UsageWindow[] = [limits?.primary, limits?.secondary].flatMap((w) =>
      w && typeof w.used_percent === "number" ? [{ label: windowLabel(w.window_minutes), used: w.used_percent, resetsAt: w.resets_at * 1000 }] : []
    )
    if (windows.length) return { windows, plan: typeof limits.plan_type === "string" ? limits.plan_type : undefined }
  }
  return null
}

async function codexContext(sessionId: string): Promise<SessionContext | null> {
  for (const event of await codexTokenCounts(sessionId)) {
    const used = event?.info?.last_token_usage?.total_tokens
    const window = event?.info?.model_context_window
    if (typeof used === "number" && typeof window === "number" && window > 0) return { used, window }
  }
  return null
}

// Codex keeps the models the signed-in account can use in ~/.codex/models_cache.json and refreshes it itself.
// Read again whenever the file changes; the fixed list covers a machine where Codex hasn't written it yet.
const CODEX_MODELS: [string, string][] = [
  ["gpt-6.1-sol", "GPT-6.1-Sol"],
  ["gpt-6-astra", "GPT-6-Astra"],
  ["gpt-6-sol", "GPT-6-Sol"],
  ["gpt-6-luna", "GPT-6-Luna"],
  ["gpt-5.6-sol", "GPT-5.6-Sol"],
  ["gpt-5.6-terra", "GPT-5.6-Terra"],
  ["gpt-5.6-luna", "GPT-5.6-Luna"],
  ["gpt-5.5", "GPT-5.5"],
]
let codexModelCache: { modified: number; models: [string, string][] } | null = null

function codexModels(): [string, string][] {
  const file = path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "models_cache.json")
  try {
    const modified = fs.statSync(file).mtimeMs
    if (codexModelCache?.modified !== modified) {
      const listed: { slug?: unknown; display_name?: unknown; visibility?: unknown; priority?: unknown }[] = JSON.parse(fs.readFileSync(file, "utf8")).models
      const models = listed
        .filter((m) => typeof m.slug === "string" && m.visibility === "list")
        .sort((a, b) => Number(a.priority) - Number(b.priority))
        .map((m): [string, string] => [m.slug as string, typeof m.display_name === "string" ? m.display_name : (m.slug as string)])
      codexModelCache = { modified, models: models.length ? models : CODEX_MODELS }
    }
    return codexModelCache.models
  } catch {
    return CODEX_MODELS
  }
}

// Claude Code reports a session's token counts only in its output, so the last ones seen are kept here
// until the app restarts. On globalThis because every route bundle gets its own copy of this module.
const claudeContexts: Map<string, SessionContext> = ((globalThis as typeof globalThis & { __codeMergerContexts?: Map<string, SessionContext> }).__codeMergerContexts ??=
  new Map())

const claude: Agent = {
  id: "claude",
  name: "Claude Code",
  short: "Claude",
  vendor: "Anthropic",
  command: "claude",
  color: "#d97757",
  install: "npm install -g @anthropic-ai/claude-code",
  login: "claude  (then /login)",
  models: [
    ["", "Default model"],
    ["claude-fable-5-1", "Fable 5.1"],
    ["claude-fable-5", "Fable 5"],
    ["claude-opus-5-5", "Opus 5.5"],
    ["claude-opus-5", "Opus 5"],
    ["claude-opus-4-8", "Opus 4.8"],
    ["claude-opus-4-7", "Opus 4.7"],
    ["claude-opus-4-6", "Opus 4.6"],
    ["claude-opus-4-5", "Opus 4.5"],
    ["claude-sonnet-5-5", "Sonnet 5.5"],
    ["claude-sonnet-5", "Sonnet 5"],
    ["claude-sonnet-4-6", "Sonnet 4.6"],
    ["claude-sonnet-4-5", "Sonnet 4.5"],
    ["claude-haiku-4-5", "Haiku 4.5"],
  ],
  efforts: [["", "Default effort"], ["low", "Low"], ["medium", "Medium"], ["high", "High"], ["xhigh", "Extra high"], ["max", "Max"]],
  access: ["read", "edit", "full"],
  auth: {
    args: ["auth", "status"],
    parse(stdout) {
      try {
        const status = JSON.parse(stdout)
        const plan = status.subscriptionType ? `${status.subscriptionType[0].toUpperCase()}${status.subscriptionType.slice(1)} plan` : status.authMethod
        return status.loggedIn ? { state: "ok", detail: plan || "" } : { state: "none", detail: "" }
      } catch {
        return { state: "unknown", detail: "" }
      }
    },
  },
  build({ prompt, sessionId, model, effort, access, attachments, uploadsDir }) {
    const args = ["-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages"]
    if (access === "edit") args.push("--permission-mode", "acceptEdits")
    if (access === "full") args.push("--permission-mode", "bypassPermissions")
    if (model) args.push("--model", model)
    if (effort) args.push("--effort", effort)
    if (sessionId) args.push("--resume", sessionId)
    // Lets Claude read the attached files. Takes a list, so it has to come last.
    if (attachments.length) args.push("--add-dir", uploadsDir)
    return { args, stdin: prompt }
  },
  readContext: async (sessionId) => claudeContexts.get(sessionId) ?? null,
  createParser() {
    const text = textJoiner()
    let contextUsed = 0 // what the latest request had in its window, and added to it
    return (ev) => {
      const out: ParsedEvent[] = []
      if (ev.session_id && ev.type === "system" && ev.subtype === "init") out.push({ type: "session", id: ev.session_id })
      if (ev.type === "rate_limit_event") {
        const windows = ev.rate_limit_info?.unifiedWindows || {}
        const report = [
          ["5-hour", windows.five_hour],
          ["Weekly", windows.seven_day],
        ].flatMap(([label, w]) => (w && typeof w.utilization === "number" ? [{ label, used: w.utilization * 100, resetsAt: w.resetsAt * 1000 }] : []))
        if (report.length) out.push({ type: "usage", usage: { windows: report } })
      }
      if (ev.parent_tool_use_id) return out // subagent chatter
      if (ev.type === "stream_event") {
        const e = ev.event || {}
        if (e.type === "message_start") text.breakNext()
        if (e.type === "content_block_delta" && e.delta?.type === "text_delta") text.push(out, e.delta.text)
      } else if (ev.type === "assistant") {
        const u = ev.message?.usage
        if (u) contextUsed = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.output_tokens || 0)
        for (const b of ev.message?.content || []) {
          if (b.type === "tool_use") {
            out.push({ type: "tool", tool: { id: b.id, name: b.name, detail: describeInput(b.input), status: "running" } })
          }
        }
      } else if (ev.type === "user") {
        const content = ev.message?.content
        for (const b of Array.isArray(content) ? content : []) {
          if (b.type === "tool_result") {
            out.push({ type: "tool", tool: { id: b.tool_use_id, status: b.is_error ? "error" : "done" } })
          }
        }
      } else if (ev.type === "result") {
        // Subagents on smaller models are listed too; the session runs on the largest window.
        const window = Math.max(0, ...Object.values((ev.modelUsage || {}) as Record<string, { contextWindow?: number }>).map((m) => m.contextWindow || 0))
        if (ev.session_id && contextUsed && window) claudeContexts.set(ev.session_id, { used: contextUsed, window })
        if (ev.is_error) {
          const message = typeof ev.result === "string" && ev.result ? ev.result : `Claude ended with: ${ev.subtype || "error"}`
          out.push({ type: "error", message })
        } else if (!text.any) {
          text.push(out, ev.result)
        }
      }
      return out
    }
  },
}

const codex: Agent = {
  id: "codex",
  name: "Codex",
  short: "Codex",
  vendor: "OpenAI",
  command: "codex",
  color: "#10a37f",
  install: "npm install -g @openai/codex",
  login: "codex login",
  get models(): [string, string][] {
    return [["", "Default model"], ...codexModels()]
  },
  efforts: [["", "Default effort"], ["low", "Low"], ["medium", "Medium"], ["high", "High"]],
  access: ["read", "edit", "full"],
  auth: {
    args: ["login", "status"],
    parse(stdout, code) {
      const line = stdout.trim().split("\n")[0] || ""
      if (/not logged in/i.test(line) || code !== 0) return { state: "none", detail: "" }
      return { state: "ok", detail: line.replace(/^logged in using\s*/i, "") }
    },
  },
  readUsage: codexUsage,
  readContext: codexContext,
  build({ prompt, sessionId, model, effort, access, attachments }) {
    const args = sessionId ? ["exec", "resume"] : ["exec"]
    // Images go in as real image input. -i takes a list, so a flag has to follow it.
    for (const file of attachments) if (isImage(file)) args.push("-i", file.path)
    args.push("--json", "--skip-git-repo-check")
    if (effort) args.push("-c", `model_reasoning_effort="${effort}"`)
    if (access === "full") args.push("--dangerously-bypass-approvals-and-sandbox")
    else args.push("-c", `sandbox_mode="${access === "edit" ? "workspace-write" : "read-only"}"`)
    if (model) args.push("-m", model)
    if (sessionId) args.push(sessionId)
    args.push("-") // prompt from stdin
    return { args, stdin: prompt }
  },
  createParser() {
    const text = textJoiner()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolOf = (item: any, status: "running" | "done" | "error") => {
      switch (item.type) {
        case "command_execution":
          return { id: item.id, name: "Shell", detail: clip(item.command), status: status === "done" && item.exit_code ? ("error" as const) : status }
        case "file_change":
          return { id: item.id, name: "Edit", detail: clip((item.changes || []).map((c: { path: string }) => c.path).join(", ")), status }
        case "mcp_tool_call":
          return { id: item.id, name: [item.server, item.tool].filter(Boolean).join(".") || "Tool", detail: describeInput(item.arguments), status }
        case "web_search":
          return { id: item.id, name: "Web search", detail: clip(item.query), status }
        default:
          return null
      }
    }
    return (ev) => {
      const out: ParsedEvent[] = []
      const item = ev.item || {}
      if (ev.type === "thread.started" && ev.thread_id) out.push({ type: "session", id: ev.thread_id })
      else if (ev.type === "item.started") {
        const tool = toolOf(item, "running")
        if (tool) out.push({ type: "tool", tool })
      } else if (ev.type === "item.completed") {
        if (item.type === "agent_message") {
          text.breakNext()
          text.push(out, item.text)
        } else if (item.type === "error") out.push({ type: "error", message: item.message || "Codex reported an error" })
        else {
          const tool = toolOf(item, item.status === "failed" ? "error" : "done")
          if (tool) out.push({ type: "tool", tool })
        }
      } else if (ev.type === "turn.failed") out.push({ type: "error", message: ev.error?.message || "Codex turn failed" })
      else if (ev.type === "error") out.push({ type: "error", message: ev.message || "Codex error" })
      return out
    }
  },
}

const opencode: Agent = {
  id: "opencode",
  name: "OpenCode",
  short: "OpenCode",
  vendor: "SST",
  command: "opencode",
  color: "#7c6cf0",
  install: "npm install -g opencode-ai",
  login: "opencode auth login",
  models: [["", "Default model"]],
  efforts: [],
  access: ["read", "full"],
  auth: {
    args: ["auth", "list"],
    parse(stdout, code) {
      if (code !== 0) return { state: "unknown", detail: "" }
      return /no authenticated/i.test(stdout) ? { state: "none", detail: "" } : { state: "ok", detail: "" }
    },
  },
  build({ prompt, sessionId, model, access, attachments }) {
    const args = ["run", "--format", "json"]
    if (access === "full") args.push("--auto")
    for (const file of attachments) args.push("--file", file.path)
    if (model) args.push("--model", model)
    if (sessionId) args.push("--session", sessionId)
    // The message is a positional argument; keep it from being read as a flag.
    args.push(prompt.startsWith("-") ? " " + prompt : prompt)
    return { args }
  },
  createParser() {
    const text = textJoiner()
    let session: string | null = null
    return (ev) => {
      const out: ParsedEvent[] = []
      const sid = ev.sessionID || ev.part?.sessionID
      if (sid && sid !== session) {
        session = sid
        out.push({ type: "session", id: sid })
      }
      const part = ev.part || {}
      if (ev.type === "text") {
        text.breakNext()
        text.push(out, part.text)
      } else if (ev.type === "tool_use" || ev.type === "tool") {
        const st = part.state?.status
        out.push({
          type: "tool",
          tool: {
            id: part.callID || part.id,
            name: part.tool || "Tool",
            detail: describeInput(part.state?.input),
            status: st === "error" ? "error" : st === "completed" ? "done" : "running",
          },
        })
      } else if (ev.type === "error") {
        const e = ev.error || {}
        out.push({ type: "error", message: e.message || e.data?.message || e.name || e.type || "OpenCode error" })
      }
      return out
    }
  },
}

// A prompt passed as an argument must not read as a flag.
const asArgument = (prompt: string) => (prompt.startsWith("-") ? " " + prompt : prompt)

// "readToolCall" -> "Read", "shellToolCall" -> "Shell"
const cursorToolName = (key: string) => {
  const name = key.replace(/ToolCall$/, "")
  return name ? name[0].toUpperCase() + name.slice(1) : "Tool"
}

const cursor: Agent = {
  id: "cursor",
  name: "Cursor",
  short: "Cursor",
  vendor: "Anysphere",
  command: "cursor-agent",
  aliases: ["agent"], // the name newer installs use
  color: "#8a8f98",
  install: "curl https://cursor.com/install -fsS | bash",
  login: "cursor-agent login",
  models: [["", "Default model"]],
  efforts: [],
  // Without --force its edits are only proposed, so there is no edit-only level.
  access: ["read", "full"],
  auth: {
    args: ["status"],
    parse(stdout) {
      if (/not logged in/i.test(stdout)) return { state: "none", detail: "" }
      return /logged in/i.test(stdout) ? { state: "ok", detail: "" } : { state: "unknown", detail: "" }
    },
  },
  build({ prompt, sessionId, model, access }) {
    const args = ["-p", "--output-format", "stream-json", "--stream-partial-output", "--trust"]
    if (access === "full") args.push("--force")
    else args.push("--mode", "ask")
    if (model) args.push("--model", model)
    if (sessionId) args.push("--resume", sessionId)
    args.push(asArgument(prompt))
    return { args }
  },
  createParser() {
    const text = textJoiner()
    return (ev) => {
      const out: ParsedEvent[] = []
      if (ev.type === "system" && ev.subtype === "init" && ev.session_id) out.push({ type: "session", id: ev.session_id })
      else if (ev.type === "assistant") {
        // Partial output: the deltas carry a timestamp, and each message is then repeated whole.
        if (!ev.timestamp_ms || ev.model_call_id) text.breakNext()
        else for (const b of ev.message?.content || []) if (b.type === "text") text.push(out, b.text)
      } else if (ev.type === "tool_call" && ev.call_id) {
        const [key, call] = Object.entries((ev.tool_call || {}) as Record<string, { args?: unknown }>)[0] || ["", {}]
        out.push({
          type: "tool",
          tool: { id: ev.call_id, name: cursorToolName(key), detail: describeInput(call?.args), status: ev.subtype === "completed" ? "done" : "running" },
        })
      } else if (ev.type === "result") {
        if (ev.is_error) out.push({ type: "error", message: typeof ev.result === "string" && ev.result ? ev.result : "Cursor reported an error" })
        else if (!text.any) text.push(out, ev.result)
      }
      return out
    }
  },
}

const pi: Agent = {
  id: "pi",
  name: "Pi",
  short: "Pi",
  vendor: "Earendil Works",
  command: "pi",
  color: "#7bc4a4",
  install: "npm install -g --ignore-scripts @earendil-works/pi-coding-agent",
  login: "pi  (then /login)",
  models: [["", "Default model"]],
  efforts: [["", "Default effort"], ["minimal", "Minimal"], ["low", "Low"], ["medium", "Medium"], ["high", "High"], ["xhigh", "Extra high"]],
  // Pi runs its tools without asking, so the choice is between its read-only tools and all of them.
  access: ["read", "full"],
  build({ prompt, sessionId, model, effort, access, attachments }) {
    const args = ["--mode", "json"]
    if (access === "read") args.push("--tools", "read,grep,find,ls")
    if (model) args.push("--model", model)
    if (effort) args.push("--thinking", effort)
    if (sessionId) args.push("--session", sessionId)
    for (const file of attachments) args.push(`@${file.path}`)
    args.push(asArgument(prompt))
    return { args }
  },
  createParser() {
    const text = textJoiner()
    return (ev) => {
      const out: ParsedEvent[] = []
      if (ev.type === "session" && ev.id) out.push({ type: "session", id: ev.id })
      else if (ev.type === "message_start" && ev.message?.role === "assistant") text.breakNext()
      else if (ev.type === "message_update" && ev.assistantMessageEvent?.type === "text_delta") text.push(out, ev.assistantMessageEvent.delta)
      else if (ev.type === "message_end" && ev.message?.role === "assistant" && ev.message.stopReason === "error") {
        out.push({ type: "error", message: ev.message.errorMessage || "Pi reported an error" })
      } else if (ev.type === "tool_execution_start") {
        out.push({ type: "tool", tool: { id: ev.toolCallId, name: ev.toolName || "Tool", detail: describeInput(ev.args), status: "running" } })
      } else if (ev.type === "tool_execution_end") {
        out.push({ type: "tool", tool: { id: ev.toolCallId, status: ev.isError ? "error" : "done" } })
      }
      return out
    }
  },
}

// The three below print their answer as plain text, so the conversation is replayed to them each turn.
// Their only permission switch is approving everything; left off, they refuse what would need approval.

const grok: Agent = {
  id: "grok",
  name: "Grok",
  short: "Grok",
  vendor: "xAI",
  command: "grok",
  color: "#9aa0a6",
  install: "",
  login: "grok login",
  models: [["", "Default model"]],
  efforts: [],
  access: ["read", "full"],
  plainText: true,
  build({ prompt, model, access }) {
    const args = ["--output-format", "plain", "--no-auto-update"]
    if (access === "full") args.push("--always-approve")
    if (model) args.push("-m", model)
    args.push("-p", prompt)
    return { args }
  },
}

const antigravity: Agent = {
  id: "antigravity",
  name: "Antigravity",
  short: "Antigravity",
  vendor: "Google",
  command: "agy",
  color: "#3186ff",
  install: "curl -fsSL https://antigravity.google/cli/install.sh | bash",
  login: "agy  (sign in on first run)",
  models: [["", "Default model"]],
  efforts: [["", "Default effort"], ["low", "Low"], ["medium", "Medium"], ["high", "High"]],
  access: ["read", "full"],
  plainText: true,
  build({ prompt, model, effort, access }) {
    // A headless run is cut off after five minutes unless told otherwise.
    const args = ["--output-format", "text", "--print-timeout", "2h"]
    if (access === "full") args.push("--dangerously-skip-permissions")
    if (model) args.push("--model", model)
    if (effort) args.push("--effort", effort)
    args.push("-p", prompt)
    return { args }
  },
}

const hermes: Agent = {
  id: "hermes",
  name: "Hermes",
  short: "Hermes",
  vendor: "Nous Research",
  command: "hermes",
  color: "#e0b45a",
  install: "curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash",
  login: "hermes setup",
  models: [["", "Default model"]],
  efforts: [],
  access: ["read", "full"],
  plainText: true,
  build({ prompt, model, access }) {
    const args: string[] = []
    if (model) args.push("--model", model)
    if (access === "full") args.push("--yolo")
    args.push("-z", prompt) // one prompt in, only the final answer out
    return { args }
  },
}

const BUILTIN = [claude, codex, opencode, cursor, antigravity, grok, hermes, pi]

// Extra agents from data/agents.json: [{ id, name, command, args: ["--flag", "{prompt}"], color? }]
// Their stdout is shown as the reply. If no arg contains {prompt}, the prompt is sent on stdin.
function customAgent(def: Record<string, unknown>): Agent {
  const template = Array.isArray(def.args) ? def.args.map(String) : []
  const inline = template.some((a) => a.includes("{prompt}"))
  return {
    id: String(def.id),
    name: String(def.name || def.id),
    short: String(def.short || def.name || def.id),
    vendor: "Custom",
    command: String(def.command),
    color: typeof def.color === "string" ? def.color : "#8a8f98",
    install: "",
    login: "",
    models: [["", "Default model"]],
    efforts: [],
    access: ["read"],
    plainText: true,
    build({ prompt }) {
      const args = template.map((a) => a.replaceAll("{prompt}", prompt))
      return inline ? { args } : { args, stdin: prompt }
    },
  }
}

export function loadAgents(customFile: string): Agent[] {
  const agents = [...BUILTIN]
  try {
    const defs = JSON.parse(fs.readFileSync(customFile, "utf8"))
    for (const def of Array.isArray(defs) ? defs : []) {
      if (!def || !/^[a-z0-9_-]+$/i.test(def.id || "") || !def.command) continue
      if (agents.some((a) => a.id === def.id)) continue
      agents.push(customAgent(def))
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code !== "ENOENT") console.warn(`Ignoring ${customFile}: ${e.message}`)
  }
  return agents
}

function searchPath() {
  const home = os.homedir()
  const extra = [
    path.join(home, ".local/bin"),
    path.join(home, ".opencode/bin"),
    path.join(home, ".bun/bin"),
    path.join(home, ".npm-global/bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ]
  return [...new Set([...(process.env.PATH || "").split(path.delimiter), ...extra].filter(Boolean))]
}

function isExecutable(file: string) {
  try {
    fs.accessSync(file, fs.constants.X_OK)
    return fs.statSync(file).isFile()
  } catch {
    return false
  }
}

function which(command: string) {
  if (command.includes(path.sep)) return isExecutable(command) ? command : null
  // On Windows a CLI is installed as command.exe. Script shims (.cmd) are left out: they can't be spawned without a shell.
  const names = process.platform === "win32" && !path.extname(command) ? [`${command}.exe`, command] : [command]
  for (const dir of searchPath()) {
    for (const name of names) {
      const full = path.join(dir, name)
      if (isExecutable(full)) return full
    }
  }
  return null
}

export function childEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: searchPath().join(path.delimiter), NO_COLOR: "1" }
}

function version(bin: string) {
  return new Promise<string>((resolve) => {
    execFile(bin, ["--version"], { timeout: 8000, env: childEnv() }, (err, stdout) => {
      const line = String(stdout || "").trim().split("\n")[0] || ""
      resolve(err && !line ? "" : clip(line, 60))
    })
  })
}

function authStatus(bin: string, check: AuthCheck) {
  return new Promise<{ state: AuthState; detail: string }>((resolve) => {
    execFile(bin, check.args, { timeout: 10000, env: childEnv() }, (err, stdout, stderr) => {
      const code = err ? (typeof err.code === "number" ? err.code : 1) : 0
      resolve(check.parse(String(stdout || "") || String(stderr || ""), code)) // some CLIs report on stderr
    })
  })
}

// Which agent CLIs are installed on this machine, and whether each is signed in.
export function detectAgents(agents: Agent[]): Promise<DetectedAgent[]> {
  return Promise.all(
    agents.map(async (agent) => {
      const bin = [agent.command, ...(agent.aliases || [])].map(which).find(Boolean) ?? null
      if (!bin) return { agent, bin, version: "", auth: "unknown" as const, authDetail: "" }
      const [v, auth] = await Promise.all([version(bin), agent.auth ? authStatus(bin, agent.auth) : { state: "unknown" as const, detail: "" }])
      return { agent, bin, version: v, auth: auth.state, authDetail: auth.detail }
    })
  )
}
