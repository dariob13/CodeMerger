import { fail, json, readBody } from "@/lib/server/http"
import { stopRun } from "@/lib/server/runner"
import { removeChat, saveList, state } from "@/lib/server/store"

export async function PATCH(request: Request, { params }: RouteContext<"/api/projects/[id]">) {
  const { id } = await params
  const project = state.projects.find((p) => p.id === id)
  if (!project) return fail("Project not found", 404)
  const body = await readBody(request)
  if (typeof body.name === "string" && body.name.trim()) project.name = body.name.trim().slice(0, 60)
  await saveList("projects")
  return json({ project })
}

// Removes the project, its chats and its automations from the app. The folder on disk is left alone.
export async function DELETE(_request: Request, { params }: RouteContext<"/api/projects/[id]">) {
  const { id } = await params
  if (!state.projects.some((p) => p.id === id)) return fail("Project not found", 404)
  for (const chat of [...state.chats.values()].filter((c) => c.projectId === id)) {
    const run = state.runs.get(chat.id)
    if (run) stopRun(run)
    await removeChat(chat)
  }
  state.projects = state.projects.filter((p) => p.id !== id)
  state.automations = state.automations.filter((a) => a.projectId !== id)
  await Promise.all([saveList("projects"), saveList("automations")])
  return json({ ok: true })
}
