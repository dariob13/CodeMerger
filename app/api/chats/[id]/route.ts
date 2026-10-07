import { fail, findChat, json, readBody } from "@/lib/server/http"
import { stopRun } from "@/lib/server/runner"
import { removeChat, saveChat, state, summary } from "@/lib/server/store"

export async function GET(_request: Request, { params }: RouteContext<"/api/chats/[id]">) {
  const chat = await findChat(params)
  if (!chat) return fail("Chat not found", 404)
  return json({ chat: { ...summary(chat), messages: chat.messages } })
}

export async function PATCH(request: Request, { params }: RouteContext<"/api/chats/[id]">) {
  const chat = await findChat(params)
  if (!chat) return fail("Chat not found", 404)
  const body = await readBody(request)
  if (typeof body.title === "string" && body.title.trim()) chat.title = body.title.trim().slice(0, 120)
  if (body.read === true) chat.readAt = Date.now()
  await saveChat(chat)
  return json({ chat: summary(chat) })
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/chats/[id]">) {
  const chat = await findChat(params)
  if (!chat) return fail("Chat not found", 404)
  const run = state.runs.get(chat.id)
  if (run) stopRun(run)
  await removeChat(chat)
  return json({ ok: true })
}
