import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const appBundle = process.argv[2] || path.join(root, "src-tauri/target/release/bundle/macos/Code Merger.app")
const executable = path.join(appBundle, "Contents/MacOS/code-merger-desktop")
const temporary = await mkdtemp(path.join(os.tmpdir(), "code-merger-desktop-test-"))
const data = path.join(temporary, "data")
const logs = path.join(temporary, "logs")
const environment = { ...process.env, CODE_MERGER_DATA: data, CODE_MERGER_LOGS: logs, CODE_MERGER_PROJECTS: path.join(temporary, "projects"), NODE_PATH: "", PATH: "/usr/bin:/bin:/usr/sbin:/sbin" }
let child
let origin

async function start() {
  await rm(path.join(logs, "next-server.log"), { force: true })
  child = spawn(executable, [], { env: environment, stdio: "ignore" })
  child.on("error", (error) => console.error(error))
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      const log = await readFile(path.join(logs, "next-server.log"), "utf8").catch(() => "No server log was written.")
      throw new Error(`Desktop app exited before startup (${child.exitCode ?? child.signalCode}): ${log.slice(-4000)}`)
    }
    try {
      const log = await readFile(path.join(logs, "next-server.log"), "utf8")
      const match = log.match(/http:\/\/127\.0\.0\.1:\d+/)
      if (match) {
        origin = match[0]
        if ((await fetch(origin)).ok) return
      }
    } catch { /* The server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error("Desktop server failed to start")
}

async function stop() {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit")
    // Exercise graceful termination, including shutdown of the bundled Node server.
    child.kill("SIGTERM")
    const timeout = setTimeout(() => child.kill("SIGKILL"), 10_000)
    try {
      await exited
    } finally {
      clearTimeout(timeout)
    }
  }
  if (origin) {
    let reachable = true
    try { await fetch(origin, { signal: AbortSignal.timeout(1000) }) } catch { reachable = false }
    assert.equal(reachable, false, "The desktop server must stop when the app quits")
  }
}

async function json(route) {
  const response = await fetch(`${origin}${route}`)
  if (!response.ok) throw new Error(`${route}: ${response.status} ${(await response.text()).slice(0, 1000)}`)
  return response.json()
}

try {
  await start()
  const html = await (await fetch(origin)).text()
  assert.match(html, /Code Merger/)
  const stylesheet = html.match(/href="([^"]+\.css[^"]*)"/)
  assert.ok(stylesheet, "The bundled app must serve its styles")
  assert.equal((await fetch(new URL(stylesheet[1], origin))).status, 200)
  assert.equal((await fetch(`${origin}/api/notes`, { headers: { Origin: "https://example.com" } })).status, 403)
  assert.deepEqual((await json("/api/notes")).notes, [])
  const note = await fetch(`${origin}/api/notes`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ title: "Desktop persistence", body: "Saved by the packaged app." }) })
  assert.equal(note.status, 201)
  assert.equal(JSON.parse(await readFile(path.join(data, "notes.json"), "utf8"))[0].title, "Desktop persistence")
  const agents = await json("/api/agents")
  assert.ok(Array.isArray(agents.agents) && agents.agents.length > 0, "Agent discovery must work from a Finder-style environment")
  for (const route of ["/api/projects", "/api/chats", "/api/personas", "/api/inbox", "/api/automations"]) {
    assert.ok(await json(route), `${route} must work without the source repository's dependencies`)
  }
  const secondLaunch = spawn(executable, [], { env: environment, stdio: "ignore" })
  const secondExit = once(secondLaunch, "exit")
  const secondTimeout = setTimeout(() => secondLaunch.kill("SIGKILL"), 5000)
  try {
    assert.equal((await secondExit)[0], 0, "A second launch must focus the existing app and exit successfully")
  } finally {
    clearTimeout(secondTimeout)
  }
  assert.equal((await json("/api/notes")).notes[0].title, "Desktop persistence")
  await stop()
  await start()
  assert.equal((await json("/api/notes")).notes[0].title, "Desktop persistence")
  await stop()
  console.log("Packaged app checks passed: startup, styles, API origin checks, agent discovery, single instance, saved data, relaunch, and server shutdown.")
} catch (error) {
  const log = await readFile(path.join(logs, "next-server.log"), "utf8").catch(() => "No server log was written.")
  console.error(log.slice(-4000))
  throw error
} finally {
  if (child?.exitCode === null && child?.signalCode === null) await stop()
  await rm(temporary, { recursive: true, force: true })
}
