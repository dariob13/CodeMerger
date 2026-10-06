import { fail, json, readBody } from "@/lib/server/http"
import { saveList, state } from "@/lib/server/store"

export async function PATCH(request: Request, { params }: RouteContext<"/api/notes/[id]">) {
  const { id } = await params
  const note = state.notes.find((n) => n.id === id)
  if (!note) return fail("Note not found", 404)
  const body = await readBody(request)
  if (typeof body.title === "string") note.title = body.title.slice(0, 200)
  if (typeof body.body === "string") note.body = body.body
  note.updatedAt = Date.now()
  await saveList("notes")
  return json({ note })
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/notes/[id]">) {
  const { id } = await params
  state.notes = state.notes.filter((n) => n.id !== id)
  await saveList("notes")
  return json({ ok: true })
}
