import { json } from "@/lib/server/http"
import { saveList, state } from "@/lib/server/store"

export async function GET() {
  return json({ items: state.inbox })
}

// Marks everything as read.
export async function PATCH() {
  for (const item of state.inbox) item.read = true
  await saveList("inbox")
  return json({ items: state.inbox })
}
