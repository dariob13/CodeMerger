import { fail, findChat, json, readBody } from "@/lib/server/http"
import { startTurn } from "@/lib/server/runner"
import { detected, isDir, saveChat, state, summary } from "@/lib/server/store"
import type { Access } from "@/lib/types"

export async function POST(request: Request, { params }: RouteContext<"/api/chats/[id]/messages">) {
  const chat = await findChat(params)
  if (!chat) return fail("Chat not found", 404)
  if (state.runs.has(chat.id)) return fail("This chat is still waiting on a reply.", 409)

  const body = await readBody(request)
  const ids = Array.isArray(body.attachments) ? body.attachments.slice(0, 20) : []
  const attachments = ids.flatMap((id) => chat.uploads?.[String(id)] ?? [])
  const text = typeof body.text === "string" ? body.text.trim() : ""
  if (!text && !attachments.length) return fail("Message is empty.")
  // One of the user's own agents answers through the CLI it runs on.
  const persona = typeof body.persona === "string" && body.persona ? state.personas.find((p) => p.id === body.persona) : undefined
  const info = (await detected()).find((d) => d.agent.id === (persona?.agent ?? body.agent))
  if (!info) return fail("Unknown agent.")
  if (!info.bin) return fail(`${info.agent.name} is not connected. Install its CLI, then recheck.`)
  if (!isDir(chat.cwd)) return fail(`Working folder no longer exists: ${chat.cwd}`)
  const access = info.agent.access.includes(body.access as Access) ? (body.access as Access) : "read"
  const model = typeof body.model === "string" && /^[\w.:/#@-]{0,100}$/.test(body.model) ? body.model : ""
  const effort = info.agent.efforts.some(([value]) => value === body.effort) ? String(body.effort) : ""

  const { user, message } = startTurn(chat, info, { text, attachments, model, effort, access, persona })
  await saveChat(chat)
  return json({ user, message, chat: summary(chat) }, 202)
}
