import { fail, findChat } from "@/lib/server/http"
import { state, type Listener } from "@/lib/server/store"
import type { StreamEvent } from "@/lib/types"

// Server-sent events for the reply in progress: a snapshot of what exists so far, then live updates.
export async function GET(request: Request, { params }: RouteContext<"/api/chats/[id]/events">) {
  const chat = await findChat(params)
  if (!chat) return fail("Chat not found", 404)
  const run = state.runs.get(chat.id)
  const encoder = new TextEncoder()
  const frame = (ev: StreamEvent) => encoder.encode(`data: ${JSON.stringify(ev)}\n\n`)

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (!run) {
        controller.enqueue(frame({ type: "idle" }))
        controller.close()
        return
      }
      const listener: Listener = {
        send: (ev) => controller.enqueue(frame(ev)),
        close: () => {
          run.listeners.delete(listener)
          controller.close()
        },
      }
      controller.enqueue(frame({ type: "snapshot", message: run.message }))
      run.listeners.add(listener)
      request.signal.addEventListener("abort", () => run.listeners.delete(listener))
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", Connection: "keep-alive" },
  })
}
