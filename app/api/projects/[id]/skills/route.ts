import { json } from "@/lib/server/http"
import { state } from "@/lib/server/store"
import { discoverSkills, skillSummary } from "@/lib/server/skills"
import { workspaceProject, workspaceFailure, WorkspaceError } from "@/lib/server/workspace"

export async function GET(request: Request, { params }: RouteContext<"/api/projects/[id]/skills">) {
  try {
    const project = workspaceProject((await params).id)
    const agent = new URL(request.url).searchParams.get("agent") || ""
    if (!state.agents.some((a) => a.id === agent)) throw new WorkspaceError("Unknown agent")
    return json({ skills: (await discoverSkills(project, agent)).map(skillSummary) })
  } catch (error) { return workspaceFailure(error) }
}
