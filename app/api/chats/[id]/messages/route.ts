import { fail, findChat, json, readBody } from "@/lib/server/http"
import { startTurn } from "@/lib/server/runner"
import { detected, isDir, saveChat, state, summary } from "@/lib/server/store"
import type { Access } from "@/lib/types"
import { resolveSkills } from "@/lib/server/skills"
import { workspaceFailure, workspaceProject } from "@/lib/server/workspace"

export async function POST(request: Request, { params }: RouteContext<"/api/chats/[id]/messages">) {
  const chat = await findChat(params)
  if (!chat) return fail("Chat not found", 404)
  if (state.runs.has(chat.id)) return fail("This chat is still waiting on a reply.", 409)

  const body = await readBody(request)
  const ids = Array.isArray(body.attachments) ? body.attachments.slice(0, 20) : []
  const attachments = ids.flatMap((id) => chat.uploads?.[String(id)] ?? [])
  const text = typeof body.text === "string" ? body.text.trim() : ""
  // In the chat with one of the user's own agents, that agent answers, through the CLI it runs on.
  const persona = state.personas.find((p) => p.id === chat.personaId)
  const info = (await detected()).find((d) => d.agent.id === (persona?.agent ?? body.agent))
  if (!info) return fail("Unknown agent.")
  if (!info.bin) return fail(`${info.agent.name} is not connected. Install its CLI, then recheck.`)
  if (!isDir(chat.cwd)) return fail(`Working folder no longer exists: ${chat.cwd}`)
  const access = info.agent.access.includes(body.access as Access) ? (body.access as Access) : "read"
  const model = typeof body.model === "string" && /^[\w.:/#@-]{0,100}$/.test(body.model) ? body.model : ""
  const effort = info.agent.efforts.some(([value]) => value === body.effort) ? String(body.effort) : ""

  let skills
  try { skills = await resolveSkills(workspaceProject(chat.projectId), info.agent.id, body.skills) } catch (error) { return workspaceFailure(error) }
  if (!text && !attachments.length && !skills.length) return fail("Message is empty.")
  if (state.runs.has(chat.id)) return fail("This chat is still waiting on a reply.", 409)
  const { user, message } = startTurn(chat, info, { text, attachments, model, effort, access, persona, skills })
  await saveChat(chat)
  return json({ user, message, chat: summary(chat) }, 202)
}
