import { json, readBody } from "@/lib/server/http"
import { gitAction, gitDiff, workspaceFailure, workspaceProject, workspaceWrite, WorkspaceError } from "@/lib/server/workspace"

export async function GET(request: Request, { params }: RouteContext<"/api/projects/[id]/changes">) {
  try {
    const project = workspaceProject((await params).id), query = new URL(request.url).searchParams
    return json({ diff: await gitDiff(project, query.get("path") || "", query.get("staged") === "true", query.get("commit") || undefined) })
  } catch (error) { return workspaceFailure(error) }
}
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[id]/changes">) {
  try {
    const project = workspaceProject((await params).id), body = await readBody(request)
    if (typeof body.action !== "string" || (body.paths !== undefined && (!Array.isArray(body.paths) || body.paths.some((p) => typeof p !== "string")))) throw new WorkspaceError("Invalid Git request")
    const git = await workspaceWrite(project, () => gitAction(project, String(body.action), body.paths as string[] || [], typeof body.message === "string" ? body.message : ""))
    return json({ git })
  } catch (error) { return workspaceFailure(error) }
}
