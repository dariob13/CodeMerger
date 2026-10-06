import { parseAutomation } from "@/lib/server/automations"
import { fail, json, readBody } from "@/lib/server/http"
import { saveList, state } from "@/lib/server/store"

export async function GET() {
  return json({ automations: [...state.automations].sort((a, b) => b.createdAt - a.createdAt) })
}

export async function POST(request: Request) {
  const automation = parseAutomation(await readBody(request))
  if (typeof automation === "string") return fail(automation)
  state.automations.push(automation)
  await saveList("automations")
  return json({ automation }, 201)
}
