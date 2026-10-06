// Automations: prompts the user wrote that run on a schedule. Each run opens a
// new chat with the chosen agent, and the outcome is filed in the inbox.

import type { Access, Automation, InboxItem, Schedule } from "@/lib/types"
import { messageText, startTurn } from "./runner"
import { detected, isDir, newId, saveChat, saveList, state, type Chat } from "./store"

const TICK = 30_000
const MIN_INTERVAL = 5 // minutes
const ACCESS: Access[] = ["read", "edit", "full"]

export function nextRun(schedule: Schedule, from = Date.now()): number | null {
  if (schedule.kind === "interval") return from + schedule.minutes * 60_000
  if (schedule.kind === "daily") {
    const [hours, minutes] = schedule.time.split(":").map(Number)
    const at = new Date(from)
    at.setHours(hours, minutes, 0, 0)
    if (at.getTime() <= from) at.setDate(at.getDate() + 1)
    return at.getTime()
  }
  return null
}

function parseSchedule(input: unknown): Schedule | string {
  const s = (input || {}) as Record<string, unknown>
  if (s.kind === "manual") return { kind: "manual" }
  if (s.kind === "interval") {
    const minutes = Math.round(Number(s.minutes))
    if (!Number.isFinite(minutes) || minutes < MIN_INTERVAL) return `Automations can run at most every ${MIN_INTERVAL} minutes.`
    return { kind: "interval", minutes: Math.min(minutes, 60 * 24 * 30) }
  }
  if (s.kind === "daily") {
    if (typeof s.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)) return "Pick a time of day for the automation."
    return { kind: "daily", time: s.time }
  }
  return "Pick when the automation should run."
}

// Builds an automation from a create or edit request. Returns a message if something is missing or wrong.
export function parseAutomation(body: Record<string, unknown>, existing?: Automation): Automation | string {
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : (existing?.name ?? "")
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : (existing?.prompt ?? "")
  if (!name) return "Give the automation a name."
  if (!prompt) return "Write what the agent should do."

  const agentId = typeof body.agent === "string" ? body.agent : existing?.agent
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return "Pick an agent."
  const pick = (key: "model" | "effort") => (typeof body[key] === "string" ? (body[key] as string) : (existing?.[key] ?? ""))
  const model = agent.models.some(([v]) => v === pick("model")) ? pick("model") : ""
  const effort = agent.efforts.some(([v]) => v === pick("effort")) ? pick("effort") : ""
  const wanted = (ACCESS.includes(body.access as Access) ? body.access : existing?.access) as Access | undefined
  const access = wanted && agent.access.includes(wanted) ? wanted : "read"

  const projectId = typeof body.projectId === "string" ? body.projectId : existing?.projectId
  if (!state.projects.some((p) => p.id === projectId)) return "Pick the project this automation works in."

  const schedule = body.schedule === undefined && existing ? existing.schedule : parseSchedule(body.schedule)
  if (typeof schedule === "string") return schedule
  const enabled = typeof body.enabled === "boolean" ? body.enabled : (existing?.enabled ?? true)
  const rescheduled = !existing || JSON.stringify(schedule) !== JSON.stringify(existing.schedule) || enabled !== existing.enabled

  return {
    id: existing?.id ?? newId(),
    name,
    prompt,
    agent: agent.id,
    model,
    effort,
    access,
    projectId: projectId!,
    schedule,
    enabled,
    createdAt: existing?.createdAt ?? Date.now(),
    lastRunAt: existing?.lastRunAt ?? null,
    nextRunAt: !enabled ? null : rescheduled ? nextRun(schedule) : (existing?.nextRunAt ?? null),
  }
}

async function file(automation: Automation, item: Pick<InboxItem, "status" | "preview" | "chatId">) {
  state.inbox.unshift({
    id: newId(),
    title: automation.name,
    automationId: automation.id,
    agent: automation.agent,
    ts: Date.now(),
    read: false,
    ...item,
  })
  state.inbox.length = Math.min(state.inbox.length, 500)
  await saveList("inbox")
}

const running = (automation: Automation) =>
  [...state.chats.values()].some((chat) => chat.automationId === automation.id && state.runs.has(chat.id))

// Starts one run. Returns the chat it runs in, or null if it couldn't start (the reason is filed in the inbox).
export async function runAutomation(automation: Automation): Promise<Chat | null> {
  automation.lastRunAt = Date.now()
  automation.nextRunAt = automation.enabled ? nextRun(automation.schedule) : null
  await saveList("automations")

  const info = (await detected()).find((d) => d.agent.id === automation.agent)
  const project = state.projects.find((p) => p.id === automation.projectId)
  const problem = !info?.bin
    ? `${info?.agent.name || automation.agent} is not installed, so this automation could not run.`
    : !project
      ? "Its project no longer exists, so this automation could not run."
      : !isDir(project.cwd)
        ? `The folder ${project.cwd} no longer exists, so this automation could not run.`
        : null
  if (problem || !info || !project) {
    await file(automation, { status: "error", preview: problem || "", chatId: null })
    return null
  }

  const now = Date.now()
  const stamp = new Date(now).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
  const chat: Chat = {
    id: newId(),
    projectId: project.id,
    title: `${automation.name} · ${stamp}`,
    cwd: project.cwd,
    createdAt: now,
    updatedAt: now,
    lastAgent: null,
    sessions: {},
    automationId: automation.id,
    messages: [],
  }
  state.chats.set(chat.id, chat)
  const { model, effort, access } = automation
  startTurn(chat, info, { text: automation.prompt, model, effort, access }, (message) => {
    const preview = message.status === "error" ? message.error || "The agent failed." : messageText(message)
    file(automation, { status: message.status === "running" ? "done" : message.status, preview: preview.slice(0, 600), chatId: chat.id }).catch(
      console.error
    )
  })
  await saveChat(chat)
  return chat
}

function tick() {
  const now = Date.now()
  for (const automation of state.automations) {
    if (!automation.enabled || !automation.nextRunAt || automation.nextRunAt > now) continue
    if (running(automation)) continue // the previous run is still going; try again next tick
    runAutomation(automation).catch((err) => console.error(`Automation "${automation.name}" failed to start: ${err.message}`))
  }
}

// Called once when the server starts. Runs that were due while the server was off are skipped, not replayed.
export function startScheduler() {
  if (state.scheduler) return
  const now = Date.now()
  for (const automation of state.automations) {
    if (automation.enabled && (!automation.nextRunAt || automation.nextRunAt < now)) automation.nextRunAt = nextRun(automation.schedule, now)
  }
  state.scheduler = setInterval(tick, TICK)
  state.scheduler.unref?.()
}
