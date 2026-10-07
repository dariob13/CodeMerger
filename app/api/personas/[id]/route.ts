import { fail, json, readBody } from "@/lib/server/http"
import { addMemory } from "@/lib/server/personas"
import { saveChat, saveList, state } from "@/lib/server/store"

// Edits an agent. `remember` adds one memory and `forget` removes one by id.
export async function PATCH(request: Request, { params }: RouteContext<"/api/personas/[id]">) {
  const { id } = await params
  const persona = state.personas.find((p) => p.id === id)
  if (!persona) return fail("Agent not found", 404)
  const body = await readBody(request)
  if (typeof body.name === "string") {
    const name = body.name.replace(/\s+/g, " ").trim().slice(0, 40)
    if (!name) return fail("Give the agent a name.")
    if (state.personas.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) return fail(`You already have an agent called ${name}.`)
    persona.name = name
  }
  if (typeof body.duties === "string") persona.duties = body.duties.trim().slice(0, 4000)
  if (typeof body.agent === "string") {
    if (!state.agents.some((a) => a.id === body.agent)) return fail("Choose what the agent runs on.")
    persona.agent = body.agent
  }
  if (typeof body.remember === "string" && !addMemory(persona, body.remember)) return fail("That is empty, or already in its memory.")
  if (typeof body.forget === "string") persona.memories = persona.memories.filter((m) => m.id !== body.forget)
  persona.updatedAt = Date.now()
  await saveList("personas")
  return json({ persona })
}

// Removes the agent. The chats it had are kept, as ordinary chats in their projects.
export async function DELETE(_request: Request, { params }: RouteContext<"/api/personas/[id]">) {
  const { id } = await params
  state.personas = state.personas.filter((p) => p.id !== id)
  await saveList("personas")
  const kept = [...state.chats.values()].filter((c) => c.personaId === id)
  for (const chat of kept) delete chat.personaId
  await Promise.all(kept.map(saveChat))
  return json({ ok: true })
}
