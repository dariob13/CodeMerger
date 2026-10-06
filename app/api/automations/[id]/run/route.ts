import { runAutomation } from "@/lib/server/automations"
import { fail, json } from "@/lib/server/http"
import { state, summary } from "@/lib/server/store"

export async function POST(_request: Request, { params }: RouteContext<"/api/automations/[id]/run">) {
  const { id } = await params
  const automation = state.automations.find((a) => a.id === id)
  if (!automation) return fail("Automation not found", 404)
  const chat = await runAutomation(automation)
  if (!chat) return fail(state.inbox[0]?.preview || "The automation could not start.", 409)
  return json({ automation, chat: summary(chat) }, 202)
}
