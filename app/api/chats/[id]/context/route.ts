import { fail, findChat, json } from "@/lib/server/http"
import { state } from "@/lib/server/store"

// How full the context window is for the agent that last replied in this chat, when its CLI tells.
export async function GET(_request: Request, { params }: RouteContext<"/api/chats/[id]/context">) {
  const chat = await findChat(params)
  if (!chat) return fail("Chat not found", 404)
  const last = chat.messages.findLast((m) => m.role === "assistant")
  const agent = last?.role === "assistant" ? state.agents.find((a) => a.id === last.agent) : undefined
  const sessionId = agent && chat.sessions[agent.id]?.sessionId
  const context = (sessionId && (await agent.readContext?.(sessionId).catch(() => null))) || null
  return json({ context: context && { ...context, agent: agent!.id } })
}
