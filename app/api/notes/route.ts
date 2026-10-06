import { json, readBody } from "@/lib/server/http"
import { newId, saveList, state } from "@/lib/server/store"
import type { Note } from "@/lib/types"

export async function GET() {
  return json({ notes: [...state.notes].sort((a, b) => b.updatedAt - a.updatedAt) })
}

export async function POST(request: Request) {
  const body = await readBody(request)
  const now = Date.now()
  const note: Note = {
    id: newId(),
    title: typeof body.title === "string" ? body.title.slice(0, 200) : "",
    body: typeof body.body === "string" ? body.body : "",
    createdAt: now,
    updatedAt: now,
  }
  state.notes.push(note)
  await saveList("notes")
  return json({ note }, 201)
}
