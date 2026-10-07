import { json, readBody } from "@/lib/server/http"
import { listFiles, readFile, searchFiles, workspaceFailure, workspaceProject, workspaceWrite, writeFile, WorkspaceError } from "@/lib/server/workspace"

export async function GET(request: Request, { params }: RouteContext<"/api/projects/[id]/files">) {
  try {
    const project = workspaceProject((await params).id), query = new URL(request.url).searchParams
    if (query.has("file")) return json({ file: await readFile(project, query.get("file")!) })
    if (query.get("query")) return json(await searchFiles(project, query.get("query")!.slice(0, 200)))
    return json({ entries: await listFiles(project, query.get("directory") || "") })
  } catch (error) { return workspaceFailure(error) }
}

async function write(request: Request, params: Promise<{ id: string }>, create: boolean) {
  try {
    const project = workspaceProject((await params).id), body = await readBody(request)
    if (typeof body.path !== "string" || typeof body.content !== "string" || (!create && typeof body.version !== "string")) throw new WorkspaceError("Invalid file request")
    const file = await workspaceWrite(project, () => writeFile(project, body.path as string, body.content as string, create ? undefined : body.version as string))
    return json({ file }, create ? 201 : 200)
  } catch (error) { return workspaceFailure(error) }
}
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[id]/files">) { return write(request, params, true) }
export async function PATCH(request: Request, { params }: RouteContext<"/api/projects/[id]/files">) { return write(request, params, false) }
