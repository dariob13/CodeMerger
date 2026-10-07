import { json, readBody } from "@/lib/server/http"
import { detected } from "@/lib/server/store"
import { draftCommit } from "@/lib/server/runner"
import { stagedDiff, workspaceFailure, workspaceProject, WorkspaceError } from "@/lib/server/workspace"

export async function POST(request: Request, { params }: RouteContext<"/api/projects/[id]/changes/draft">) {
  try {
    const project = workspaceProject((await params).id), body = await readBody(request)
    const info = (await detected()).find((a) => a.agent.id === body.agent)
    if (!info?.bin || !info.agent.access.includes("read")) throw new WorkspaceError("Choose a connected agent with read-only access to draft a message")
    const diff = await stagedDiff(project)
    if (!diff) throw new WorkspaceError("Stage changes before drafting a message")
    const model = typeof body.model === "string" && /^[\w.:/#@-]{0,100}$/.test(body.model) ? body.model : ""
    return json({ message: await draftCommit(project.cwd, info, diff, model, request.signal) })
  } catch (error) { return workspaceFailure(error) }
}
