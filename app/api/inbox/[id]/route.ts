import { fail, json, readBody } from "@/lib/server/http"
import { saveList, state } from "@/lib/server/store"

export async function PATCH(request: Request, { params }: RouteContext<"/api/inbox/[id]">) {
  const { id } = await params
  const item = state.inbox.find((i) => i.id === id)
  if (!item) return fail("Inbox item not found", 404)
  const body = await readBody(request)
  if (typeof body.read === "boolean") item.read = body.read
  await saveList("inbox")
  return json({ item })
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/inbox/[id]">) {
  const { id } = await params
  state.inbox = state.inbox.filter((i) => i.id !== id)
  await saveList("inbox")
  return json({ ok: true })
}
