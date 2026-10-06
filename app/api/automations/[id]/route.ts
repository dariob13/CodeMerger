import { parseAutomation } from "@/lib/server/automations"
import { fail, json, readBody } from "@/lib/server/http"
import { saveList, state } from "@/lib/server/store"

export async function PATCH(request: Request, { params }: RouteContext<"/api/automations/[id]">) {
  const { id } = await params
  const index = state.automations.findIndex((a) => a.id === id)
  if (index < 0) return fail("Automation not found", 404)
  const automation = parseAutomation(await readBody(request), state.automations[index])
  if (typeof automation === "string") return fail(automation)
  state.automations[index] = automation
  await saveList("automations")
  return json({ automation })
}

// Removes the automation. Chats and inbox items from its past runs are kept.
export async function DELETE(_request: Request, { params }: RouteContext<"/api/automations/[id]">) {
  const { id } = await params
  state.automations = state.automations.filter((a) => a.id !== id)
  await saveList("automations")
  return json({ ok: true })
}
