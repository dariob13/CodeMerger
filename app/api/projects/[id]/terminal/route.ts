import { spawn } from "node:child_process"
import { readBody } from "@/lib/server/http"
import { workspaceFailure, workspaceProject, WorkspaceError } from "@/lib/server/workspace"

const MAX_COMMAND = 4000

// Runs one command in the project's folder and streams what it prints, one JSON event per line.
// The command ends when the request is dropped, which is how the terminal's Stop works.
export async function POST(request: Request, { params }: RouteContext<"/api/projects/[id]/terminal">) {
  try {
    const project = workspaceProject((await params).id)
    const { command } = await readBody(request)
    if (typeof command !== "string" || !command.trim() || command.length > MAX_COMMAND) throw new WorkspaceError("Invalid command")

    const encoder = new TextEncoder()
    const posix = process.platform !== "win32"
    const child = spawn(command, { cwd: project.cwd, shell: posix ? process.env.SHELL || true : true, detached: posix, env: { ...process.env, TERM: "dumb", NO_COLOR: "1", FORCE_COLOR: "0" } })
    // Its own process group, so what the command started ends with it.
    const kill = () => {
      try {
        if (posix && child.pid) process.kill(-child.pid, "SIGTERM")
        else child.kill()
      } catch {
        // Already gone.
      }
    }
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false
        const send = (event: object) => !closed && controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))
        const finish = (event: object) => {
          send(event)
          if (!closed) controller.close()
          closed = true
        }
        child.stdout.on("data", (chunk: Buffer) => send({ type: "out", text: chunk.toString("utf8") }))
        child.stderr.on("data", (chunk: Buffer) => send({ type: "out", text: chunk.toString("utf8") }))
        child.on("error", (error) => finish({ type: "exit", code: 127, error: error.message }))
        child.on("close", (code, signal) => finish({ type: "exit", code: code ?? (signal ? 130 : 0) }))
        request.signal.addEventListener("abort", kill)
      },
      cancel: kill,
    })
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } })
  } catch (error) {
    return workspaceFailure(error)
  }
}
