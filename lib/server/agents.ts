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

// Codex writes each session to ~/.codex/sessions/YYYY/MM/DD/rollout-<time>-<thread id>.jsonl,
// and every turn in it ends with a token_count event carrying the account's rate limits.
async function codexUsage(sessionId?: string): Promise<UsageReport | null> {
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
  if (!file) return null

  // The event we want is near the end; a long session's file can be large.
  const handle = await fsp.open(/* turbopackIgnore: true */ file, "r") // a path outside the project, found at run time
  try {
    const { size } = await handle.stat()
    const length = Math.min(size, 512 * 1024)
    const { buffer } = await handle.read(Buffer.alloc(length), 0, length, size - length)
    for (const line of buffer.toString("utf8").split("\n").reverse()) {
      if (!line.includes('"token_count"')) continue
      try {
        const limits = JSON.parse(line).payload?.rate_limits
        const windows: UsageWindow[] = [limits?.primary, limits?.secondary].flatMap((w) =>
          w && typeof w.used_percent === "number" ? [{ label: windowLabel(w.window_minutes), used: w.used_percent, resetsAt: w.resets_at * 1000 }] : []
        )
        if (windows.length) return { windows, plan: typeof limits.plan_type === "string" ? limits.plan_type : undefined }
      } catch {
        // A line cut in half by the tail read; keep looking.
      }
    }
    return null
  } finally {
    await handle.close()
  }
}

const claude: Agent = {
  id: "claude",
  name: "Claude Code",
  short: "Claude",
  vendor: "Anthropic",
  command: "claude",
  color: "#d97757",
  install: "npm install -g @anthropic-ai/claude-code",
  login: "claude  (then /login)",
  models: [["", "Default model"], ["opus", "Opus"], ["sonnet", "Sonnet"], ["haiku", "Haiku"]],
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
  createParser() {
    const text = textJoiner()
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
  models: [["", "Default model"]],
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

const gemini: Agent = {
  id: "gemini",
  name: "Gemini CLI",
  short: "Gemini",
  vendor: "Google",
  command: "gemini",
  color: "#4c8df6",
  install: "npm install -g @google/gemini-cli",
  login: "gemini  (sign in on first run)",
  models: [["", "Default model"]],
  efforts: [],
  access: ["read", "edit", "full"],
  plainText: true,
  build({ prompt, model, access }) {
    const args: string[] = []
    if (access === "edit") args.push("--approval-mode", "auto_edit")
    if (access === "full") args.push("--approval-mode", "yolo")
    if (model) args.push("-m", model)
    args.push("-p", prompt)
    return { args }
  },
}

const BUILTIN = [claude, codex, opencode, gemini]

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
  for (const dir of searchPath()) {
    const full = path.join(dir, command)
    if (isExecutable(full)) return full
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
      const bin = which(agent.command)
      if (!bin) return { agent, bin, version: "", auth: "unknown" as const, authDetail: "" }
      const [v, auth] = await Promise.all([version(bin), agent.auth ? authStatus(bin, agent.auth) : { state: "unknown" as const, detail: "" }])
      return { agent, bin, version: v, auth: auth.state, authDetail: auth.detail }
    })
  )
}
