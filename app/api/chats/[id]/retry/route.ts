import { fail, findChat, json, readBody } from "@/lib/server/http"
import { startTurn } from "@/lib/server/runner"
import { detected, isDir, saveChat, state, summary } from "@/lib/server/store"
import type { Access } from "@/lib/types"
import { resolveSkills } from "@/lib/server/skills"
import { workspaceFailure, workspaceProject } from "@/lib/server/workspace"

// Runs the chat's last prompt again, with the same agent and model, in place of the reply it got.
export async function POST(request: Request, { params }: RouteContext<"/api/chats/[id]/retry">) {
  const chat = await findChat(params)
  if (!chat) return fail("Chat not found", 404)
  if (state.runs.has(chat.id)) return fail("This chat is still waiting on a reply.", 409)
  const reply = chat.messages.at(-1)
  const asked = chat.messages.at(-2)
  if (reply?.role !== "assistant" || asked?.role !== "user") return fail("There is no reply to retry.")

  const body = await readBody(request)
  const persona = reply.persona && state.personas.find((p) => p.id === reply.persona!.id)
  const info = (await detected()).find((d) => d.agent.id === reply.agent)
  if (!info) return fail("The agent that replied is no longer available.")
  if (!info.bin) return fail(`${info.agent.name} is not connected. Install its CLI, then recheck.`)
  if (!isDir(chat.cwd)) return fail(`Working folder no longer exists: ${chat.cwd}`)
  const access = info.agent.access.includes(body.access as Access) ? (body.access as Access) : "read"
  const effort = info.agent.efforts.some(([value]) => value === body.effort) ? String(body.effort) : ""

  let skills
  try { skills = await resolveSkills(workspaceProject(chat.projectId), info.agent.id, asked.skills?.map((skill) => skill.id)) } catch (error) { return workspaceFailure(error) }
  if (state.runs.has(chat.id) || chat.messages.at(-1) !== reply) return fail("This chat changed while preparing the retry.", 409)

  chat.messages.splice(-2)
  // The agent's own session holds the attempt being replaced, so it starts over from the transcript.
  delete chat.sessions[info.agent.id]
  const { message } = startTurn(chat, info, { text: asked.text, attachments: asked.attachments, model: reply.model, effort, access, persona, skills })
  chat.messages[chat.messages.length - 2] = asked // the prompt itself is the same message as before
  await saveChat(chat)
  return json({ user: asked, message, chat: summary(chat) }, 202)
}
