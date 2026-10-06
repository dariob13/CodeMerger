import { state } from "./store"

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

export const fail = (error: string, status = 400) => json({ error }, status)

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    return body && typeof body === "object" ? body : {}
  } catch {
    return {}
  }
}

export async function findChat(params: Promise<{ id: string }>) {
  const { id } = await params
  return state.chats.get(id)
}
