import { fail, json, readBody } from "@/lib/server/http"
import { isDir, newId, saveChat, state, summary, type Chat } from "@/lib/server/store"

export async function GET() {
  const chats = [...state.chats.values()].map(summary).sort((a, b) => b.updatedAt - a.updatedAt)
  return json({ chats })
}

// A chat always belongs to a project, and its agents run in that project's folder.
export async function POST(request: Request) {
  const body = await readBody(request)
  const project = state.projects.find((p) => p.id === body.projectId)
  if (!project) return fail("Create a project first.")
  if (!isDir(project.cwd)) return fail(`The folder for ${project.name} no longer exists: ${project.cwd}`)
  const now = Date.now()
  const chat: Chat = {
    id: newId(),
    projectId: project.id,
    title: "New chat",
    cwd: project.cwd,
    createdAt: now,
    updatedAt: now,
    lastAgent: null,
    sessions: {},
    messages: [],
  }
  state.chats.set(chat.id, chat)
  await saveChat(chat)
  return json({ chat: { ...summary(chat), messages: [] } }, 201)
}
