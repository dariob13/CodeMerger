import fsp from "node:fs/promises"
import path from "node:path"
import { fail, json, readBody } from "@/lib/server/http"
import { expandPath, isDir, newId, PROJECTS_ROOT, saveList, state } from "@/lib/server/store"
import type { Project } from "@/lib/types"

export async function GET() {
  return json({ projects: [...state.projects].sort((a, b) => b.createdAt - a.createdAt), root: PROJECTS_ROOT })
}

// Creates a project. Its folder is made if it doesn't exist; an existing folder is used as it is.
export async function POST(request: Request) {
  const body = await readBody(request)
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : ""
  if (!name) return fail("Give the project a name.")
  const folderName = name.replace(/[/\\:*?"<>|\u0000-\u001f]/g, "-").replace(/^\.+/, "").trim() || "project"
  const cwd = typeof body.cwd === "string" && body.cwd.trim() ? expandPath(body.cwd) : path.join(/* turbopackIgnore: true */ PROJECTS_ROOT, folderName)

  const taken = state.projects.find((p) => p.cwd === cwd)
  if (taken) return fail(`The project "${taken.name}" already uses that folder.`)
  if (!isDir(cwd)) {
    try {
      await fsp.mkdir(cwd, { recursive: true })
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      return fail(code === "EEXIST" ? `${cwd} is a file, not a folder.` : `Couldn't create ${cwd} (${code || (err as Error).message}).`)
    }
  }

  const project: Project = { id: newId(), name, cwd, createdAt: Date.now() }
  state.projects.push(project)
  await saveList("projects")
  return json({ project }, 201)
}
