import { json } from "@/lib/server/http"
import { agentList } from "@/lib/server/store"

export async function GET(request: Request) {
  const refresh = new URL(request.url).searchParams.has("refresh")
  return json({ agents: await agentList(refresh) })
}
