import { fail, json, readBody } from "@/lib/server/http"
import { newId, saveList, state } from "@/lib/server/store"
import type { Persona } from "@/lib/types"

export async function GET() {
  return json({ personas: [...state.personas].sort((a, b) => a.createdAt - b.createdAt) })
}

export async function POST(request: Request) {
  const body = await readBody(request)
  const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim().slice(0, 40) : ""
  if (!name) return fail("Give the agent a name.")
  if (state.personas.some((p) => p.name.toLowerCase() === name.toLowerCase())) return fail(`You already have an agent called ${name}.`)
  if (!state.agents.some((a) => a.id === body.agent)) return fail("Choose what the agent runs on.")
  const now = Date.now()
  const persona: Persona = {
    id: newId(),
    name,
    duties: typeof body.duties === "string" ? body.duties.trim().slice(0, 4000) : "",
    agent: String(body.agent),
    memories: [],
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
  }
  state.personas.push(persona)
  await saveList("personas")
  return json({ persona }, 201)
}
