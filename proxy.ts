import { NextResponse, type NextRequest } from "next/server"

// This app can run agents on the machine, so only its own page on this machine may talk to it.
const LOCAL = new Set(["localhost", "127.0.0.1"])

const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 })

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || ""
  if (!LOCAL.has(host.replace(/:\d+$/, ""))) return forbidden()

  const origin = request.headers.get("origin")
  if (origin && origin !== `http://${host}`) return forbidden()

  if (request.nextUrl.pathname.startsWith("/api/") && request.method !== "GET") {
    // Neither type can be sent cross-site without a preflight, which the Origin check above fails.
    const type = request.headers.get("content-type") || ""
    if (!type.startsWith("application/json") && !type.startsWith("application/octet-stream")) return forbidden()
  }
  return NextResponse.next()
}
