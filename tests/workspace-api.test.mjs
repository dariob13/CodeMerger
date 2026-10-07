import { after, before, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawn, execFile } from "node:child_process"
import { promisify } from "node:util"

const exec = promisify(execFile)
const root = process.cwd()
const port = Number(process.env.WORKSPACE_TEST_PORT || 4321)
const origin = `http://127.0.0.1:${port}`
const keep = process.env.KEEP_WORKSPACE_PREVIEW === "1"
let temporary, repository, data, server, projectId, freshProjectId
const command = (cwd, ...args) => exec("git", args, { cwd })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function api(url, method = "GET", body, expected = 200) {
  const response = await fetch(`${origin}/api/${url}`, { method, headers: { "Content-Type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body || {}) })
  const result = await response.json()
  assert.equal(response.status, expected, `${method} ${url}: ${JSON.stringify(result)}`)
  return result
}
const changes = () => api(`projects/${projectId}/workspace`)
const action = (action, paths = [], message = "") => api(`projects/${projectId}/changes`, "POST", { action, paths, message })
const file = (file) => api(`projects/${projectId}/files?${new URLSearchParams({ file })}`)

before(async () => {
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), "codemerger-workspace-"))
  repository = path.join(temporary, "repository"); data = path.join(temporary, "data")
  await fs.mkdir(path.join(data, "chats"), { recursive: true }); await fs.mkdir(repository)
  await command(repository, "init", "-b", "main")
  await command(repository, "config", "user.name", "Workspace Test")
  await command(repository, "config", "user.email", "workspace@example.test")
  await fs.mkdir(path.join(repository, "components")); await fs.mkdir(path.join(repository, "lib/server"), { recursive: true })
  await fs.writeFile(path.join(repository, "components/chat-app.tsx"), "export const ChatApp = () => 'before'\n")
  await fs.writeFile(path.join(repository, "components/composer.tsx"), "export const Composer = () => 'message'\n")
  await fs.writeFile(path.join(repository, "lib/server/runner.ts"), "export async function runTurn() {\n  return 'done'\n}\n")
  await fs.writeFile(path.join(repository, "README.md"), "# Workspace\n")
  await command(repository, "add", "."); await command(repository, "commit", "-m", "Initial workspace", "--author", "Codex <codex@example.test>")
  await fs.writeFile(path.join(repository, "components/chat-app.tsx"), "export const ChatApp = () => 'after'\n")
  await fs.writeFile(path.join(repository, "components/tab-strip.tsx"), "export const Tabs = () => 'tabs'\n")
  const agent = path.join(temporary, "fixture-agent.mjs")
  await fs.writeFile(agent, "let prompt = ''; process.stdin.on('data', chunk => prompt += chunk); process.stdin.on('end', () => { if (prompt.includes('Write a concise Git commit message')) { console.log('Update workspace tabs and backend'); } else { console.log('Working on the workspace'); setTimeout(() => console.log('Done'), 15000); } });\n")
  await fs.writeFile(path.join(data, "agents.json"), JSON.stringify([{ id: "fixture", name: "Fixture Agent", command: process.execPath, args: [agent] }]))
  const seededId = "workspace-fixture", now = Date.now()
  await fs.writeFile(path.join(data, "projects.json"), JSON.stringify([{ id: seededId, name: "code-merger", cwd: repository, createdAt: now }]))
  for (const [id, title, agentId, age] of [["finished", "Switch agents mid-conversation", "claude", 120000], ["idle", "Automation run history", "codex", 28800000], ["inbox", "Ask an agent from the inbox", "claude", 64800000]]) {
    await fs.writeFile(path.join(data, "chats", `${id}.json`), JSON.stringify({ id, projectId: seededId, title, cwd: repository, createdAt: now-age-120000, updatedAt: now-age, readAt: id === "finished" ? 0 : now, lastAgent: agentId, sessions: {}, messages: [{ id: `reply-${id}`, role: "assistant", agent: agentId, model: "", parts: [{ type: "text", text: "Ready" }], status: "done", ts: now-age-120000, finishedAt: now-age }] }))
  }
  projectId = seededId
  const logFile = await fs.open(path.join(temporary, "server.log"), "a")
  server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: root, env: { ...process.env, CODE_MERGER_DATA: data, CODE_MERGER_PROJECTS: path.join(temporary, "projects") }, detached: true, stdio: ["ignore", logFile.fd, logFile.fd],
  })
  server.unref(); await logFile.close()
  for (let i = 0; i < 120; i++) {
    try { const res = await fetch(`${origin}/api/projects`); if (res.ok) { console.log(`Workspace fixture: ${temporary}; preview: ${origin}`); return } } catch {}
    await sleep(500)
  }
  throw new Error(`Server failed to start: ${await fs.readFile(path.join(temporary, "server.log"), "utf8")}`)
}, { timeout: 90_000 })

after(async () => {
  if (keep) return
  if (server?.pid) { try { process.kill(-server.pid, "SIGTERM") } catch {} }
  // Remove only the temporary test fixture that this suite created.
  if (temporary) await fs.rm(temporary, { recursive: true, force: true })
})

test("files and Git operations use the selected project and preserve unstaged edits", { timeout: 120_000 }, async (t) => {
  await t.test("lists, searches, and reads actual files", async () => {
    const { entries } = await api(`projects/${projectId}/files`)
    assert(entries.some((e) => e.path === "components" && e.kind === "directory"))
    assert(!entries.some((e) => e.name === ".git"))
    const search = await api(`projects/${projectId}/files?query=runner`)
    assert.equal(search.entries[0].path, "lib/server/runner.ts")
    assert.match((await file("components/chat-app.tsx")).file.content, /after/)
  })
  await t.test("rejects traversal, Git internals, and symlink escapes", async () => {
    for (const input of ["../outside", ".git/config", "/etc/passwd"]) await api(`projects/${projectId}/files?${new URLSearchParams({ file: input })}`, "GET", undefined, 400)
    await fs.symlink(temporary, path.join(repository, "escape"))
    await api(`projects/${projectId}/files`, "POST", { path: "escape/stolen.txt", content: "no" }, 400)
    await api(`projects/${projectId}/changes`, "POST", { action: "stage", paths: ["../outside"] }, 400)
  })
  await t.test("creates files without overwriting and detects external save conflicts", async () => {
    const { file: created } = await api(`projects/${projectId}/files`, "POST", { path: "notes/new.md", content: "first\n" }, 201)
    await api(`projects/${projectId}/files`, "POST", { path: "notes/new.md", content: "overwrite" }, 400)
    const { file: saved } = await api(`projects/${projectId}/files`, "PATCH", { path: created.path, content: "saved\n", version: created.version })
    await fs.writeFile(path.join(repository, created.path), "agent edit\n")
    await api(`projects/${projectId}/files`, "PATCH", { path: created.path, content: "stale", version: saved.version }, 409)
    assert.equal((await file(created.path)).file.content, "agent edit\n")
    await fs.writeFile(path.join(repository, "binary.bin"), Buffer.from([0, 1, 2]))
    await api(`projects/${projectId}/files?file=binary.bin`, "GET", undefined, 400)
  })
  await t.test("shows status, line counts, untracked diffs, staging and unstaging", async () => {
    let snapshot = await changes()
    assert.equal(snapshot.git.branch, "main")
    const modified = snapshot.git.changes.find((c) => c.path === "components/chat-app.tsx")
    assert.deepEqual([modified.status, modified.added, modified.deleted], ["M", 1, 1])
    assert.equal(snapshot.git.changes.find((c) => c.path === "binary.bin").binary, true)
    const diff = await api(`projects/${projectId}/changes?path=components/tab-strip.tsx`)
    assert.match(diff.diff, /\+export const Tabs/)
    await action("stage", ["components/tab-strip.tsx"])
    assert((await changes()).git.changes.some((c) => c.path === "components/tab-strip.tsx" && c.staged))
    await action("unstage", ["components/tab-strip.tsx"])
    assert((await changes()).git.changes.some((c) => c.path === "components/tab-strip.tsx" && !c.staged))
    await action("stage", ["components/tab-strip.tsx"])
    await fs.writeFile(path.join(repository, "components/tab-strip.tsx"), "export const Tabs = () => 'new unsaved-to-index value'\n")
    snapshot = await changes()
    assert.equal(snapshot.git.changes.filter((c) => c.path === "components/tab-strip.tsx").length, 2)
  })
  await t.test("drafts through the agent adapter and commits only the index", async () => {
    const draft = await api(`projects/${projectId}/changes/draft`, "POST", { agent: "fixture" })
    assert.equal(draft.message, "Update workspace tabs and backend")
    const result = await action("commit", [], draft.message)
    assert.equal(result.git.history[0].subject, draft.message)
    assert(result.git.changes.some((c) => c.path === "components/chat-app.tsx" && !c.staged))
    assert(result.git.changes.some((c) => c.path === "components/tab-strip.tsx" && !c.staged))
    assert.match((await command(repository, "show", "HEAD:components/tab-strip.tsx")).stdout, /'tabs'/)
    const diff = await api(`projects/${projectId}/changes?commit=${result.git.history[0].hash}`)
    assert.match(diff.diff, /Update workspace tabs/)
    await api(`projects/${projectId}/changes?commit=--help`, "GET", undefined, 400)
  })
  await t.test("supports an unborn repository and refuses commits outside a nested project", async () => {
    const fresh = path.join(temporary, "fresh"); await fs.mkdir(fresh); await command(fresh, "init", "-b", "main")
    freshProjectId = (await api("projects", "POST", { name: "Fresh", cwd: fresh }, 201)).project.id
    await api(`projects/${freshProjectId}/files`, "POST", { path: "hello.txt", content: "hello" }, 201)
    const act = (action) => api(`projects/${freshProjectId}/changes`, "POST", { action })
    await act("stage"); await act("unstage")
    assert.equal((await api(`projects/${freshProjectId}/workspace`)).git.changes[0].staged, false)
    const nested = (await api("projects", "POST", { name: "Nested", cwd: path.join(repository, "components") }, 201)).project.id
    await action("stage", ["notes/new.md", "components/chat-app.tsx"])
    await api(`projects/${nested}/changes`, "POST", { action: "commit", message: "Should not commit unrelated files" }, 400)
    await action("unstage")
  })
  await t.test("pushes to a local bare remote and reports ahead/behind", async () => {
    const remote = path.join(temporary, "remote.git"); await command(temporary, "init", "--bare", remote)
    await command(repository, "remote", "add", "origin", remote); await command(repository, "push", "-u", "origin", "main")
    await action("stage", ["components/chat-app.tsx"]); await action("commit", [], "Connect workspace backend")
    const before = (await changes()).git
    assert.equal(before.ahead, 1); assert.equal(before.history[0].unpushed, true)
    const pushed = await action("push")
    assert.equal(pushed.git.ahead, 0)
    assert.equal((await command(remote, "rev-parse", "main")).stdout.trim(), pushed.git.history[0].hash)
  })
  await t.test("returns session metadata, persists read state, and stops a background run", async () => {
    const original = await changes()
    assert.equal(original.sessions.find((c) => c.id === "finished").unread, true)
    await api("chats/finished", "PATCH", { read: true })
    assert.equal((await changes()).sessions.find((c) => c.id === "finished").unread, false)
    const { chat } = await api("chats", "POST", { projectId }, 201)
    await api(`chats/${chat.id}/messages`, "POST", { text: "Inspect workspace files", agent: "fixture", access: "read" }, 202)
    let session = (await changes()).sessions.find((c) => c.id === chat.id)
    assert.equal(session.running, true); assert.equal(typeof session.startedAt, "number")
    await api(`chats/${chat.id}/stop`, "POST")
    for (let i = 0; i < 50; i++) { session = (await changes()).sessions.find((c) => c.id === chat.id); if (!session.running) break; await sleep(100) }
    assert.equal(session.running, false); assert.equal(session.status, "stopped")
    assert.equal((await api(`chats/${chat.id}`)).chat.messages.at(-1).status, "stopped")
    await api(`projects/missing/workspace`, "GET", undefined, 404)
  })
})
