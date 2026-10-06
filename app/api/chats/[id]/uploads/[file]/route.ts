import fsp from "node:fs/promises"
import { fail } from "@/lib/server/http"
import { state } from "@/lib/server/store"
import { isImage } from "@/lib/types"

export async function GET(_request: Request, { params }: RouteContext<"/api/chats/[id]/uploads/[file]">) {
  const { id, file } = await params
  const attachment = state.chats.get(id)?.uploads?.[file]
  if (!attachment) return fail("File not found", 404)
  try {
    const data = await fsp.readFile(attachment.path)
    // Only plain images are shown in the page; anything else downloads, so an uploaded file can't run as a page here.
    const inline = isImage(attachment)
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": inline ? attachment.type : "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    })
  } catch {
    return fail("File not found", 404)
  }
}
