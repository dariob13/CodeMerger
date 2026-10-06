import { fail, findChat, json } from "@/lib/server/http"
import { MAX_UPLOAD, saveUpload } from "@/lib/server/store"

// One file per request: the body is the file, its name and type are in the query string.
export async function POST(request: Request, { params }: RouteContext<"/api/chats/[id]/uploads">) {
  const chat = await findChat(params)
  if (!chat) return fail("Chat not found", 404)
  const query = new URL(request.url).searchParams
  const name = query.get("name") || "file"
  const tooBig = () => fail(`${name} is larger than ${MAX_UPLOAD / 1024 / 1024} MB.`, 413)
  if (Number(request.headers.get("content-length")) > MAX_UPLOAD) return tooBig()
  const data = Buffer.from(await request.arrayBuffer())
  if (data.length > MAX_UPLOAD) return tooBig()
  if (!data.length) return fail(`${name} is empty.`)
  return json({ attachment: await saveUpload(chat, name, query.get("type") || "", data) }, 201)
}
