import { fail, findChat, json } from "@/lib/server/http"
import { stopRun } from "@/lib/server/runner"
import { state } from "@/lib/server/store"

export async function POST(_request: Request, { params }: RouteContext<"/api/chats/[id]/stop">) {
  const chat = await findChat(params)
  if (!chat) return fail("Chat not found", 404)
  const run = state.runs.get(chat.id)
  if (run) stopRun(run)
  return json({ ok: true })
}
