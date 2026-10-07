import { json } from "@/lib/server/http"
import { state, summary } from "@/lib/server/store"
import { gitSnapshot, workspaceFailure, workspaceProject } from "@/lib/server/workspace"

export async function GET(_request: Request, { params }: RouteContext<"/api/projects/[id]/workspace">) {
  try {
    const project = workspaceProject((await params).id)
    const git = await gitSnapshot(project)
    const sessions = [...state.chats.values()].filter((c) => c.projectId === project.id && !c.personaId).map(summary).sort((a, b) => b.updatedAt - a.updatedAt)
    return json({ sessions, git })
  } catch (error) { return workspaceFailure(error) }
}
