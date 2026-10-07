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
let temporary, repository, data, server, projectId, freshProjectId, skillsHome, promptFile, buildDirectory, configFile
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
async function makeSkill(root, name, body = "Follow the fixture instructions.", extra = "") {
  const directory = path.join(root, name); await fs.mkdir(directory, { recursive: true })
  const file = path.join(directory, "SKILL.md")
  await fs.writeFile(file, `---\nname: ${name}\ndescription: >\n  Provides fixture skills with a folded\n  description for testing.\n${extra}---\n\n${body}\n`)
  return file
}

before(async () => {
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), "codemerger-workspace-"))
  buildDirectory = `.next-workspace-test-${path.basename(temporary).split("-").at(-1)}`
  configFile = `${buildDirectory}.tsconfig.json`
  const config = JSON.parse(await fs.readFile(path.join(root, "tsconfig.json"), "utf8"))
  config.include = config.include.filter((entry) => !entry.startsWith(".next"))
  config.compilerOptions.tsBuildInfoFile = `${configFile}.tsbuildinfo`
  await fs.writeFile(path.join(root, configFile), JSON.stringify(config, null, 2))
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
  promptFile = path.join(temporary, "captured-prompt.txt")
  await fs.writeFile(agent, `import fs from 'node:fs'; let prompt = ''; process.stdin.on('data', chunk => prompt += chunk); process.stdin.on('end', () => { fs.writeFileSync(${JSON.stringify(promptFile)}, prompt); if (prompt.includes('Write a concise Git commit message')) { console.log('Update workspace tabs and backend'); } else if (prompt.includes('SKILL_FIXTURE_TOKEN') || prompt.includes('SKILLS_TEST_SECOND')) { console.log('Fixture skill request completed'); } else { console.log('Working on the workspace'); setTimeout(() => console.log('Done'), 15000); } });\n`)
  await fs.writeFile(path.join(data, "agents.json"), JSON.stringify([{ id: "fixture", name: "Fixture Agent", command: process.execPath, args: [agent] }, { id: "gemini", name: "Gemini Fixture", command: process.execPath, args: [agent] }]))
  const seededId = "workspace-fixture", now = Date.now()
  await fs.writeFile(path.join(data, "projects.json"), JSON.stringify([{ id: seededId, name: "code-merger", cwd: repository, createdAt: now }]))
  for (const [id, title, agentId, age] of [["finished", "Switch agents mid-conversation", "claude", 120000], ["idle", "Automation run history", "codex", 28800000], ["inbox", "Ask an agent from the inbox", "claude", 64800000]]) {
    await fs.writeFile(path.join(data, "chats", `${id}.json`), JSON.stringify({ id, projectId: seededId, title, cwd: repository, createdAt: now-age-120000, updatedAt: now-age, readAt: id === "finished" ? 0 : now, lastAgent: agentId, sessions: {}, messages: [{ id: `reply-${id}`, role: "assistant", agent: agentId, model: "", parts: [{ type: "text", text: "Ready" }], status: "done", ts: now-age-120000, finishedAt: now-age }] }))
  }
  projectId = seededId
  skillsHome = path.join(temporary, "skill-home")
  await makeSkill(path.join(repository, ".agents/skills"), "project-review", "SKILL_FIXTURE_TOKEN: use the project review procedure and read references/checklist.md relative to this skill.")
  await makeSkill(path.join(skillsHome, ".agents/skills"), "shared-review")
  await makeSkill(path.join(skillsHome, ".agents/skills"), "hidden-skill", "Hidden", "user-invocable: false\n")
  await makeSkill(path.join(skillsHome, ".claude/skills/synced/account"), "synced-review")
  await makeSkill(path.join(skillsHome, ".gemini/skills"), "gemini-review")
  const disabled = await makeSkill(path.join(skillsHome, ".codex/skills"), "disabled-review")
  await makeSkill(path.join(skillsHome, ".codex/skills/.system"), "system-review")
  await makeSkill(path.join(skillsHome, ".codex/plugins/cache/test-market/fixture-plugin/1.0.0/skills"), "old-review")
  await makeSkill(path.join(skillsHome, ".codex/plugins/cache/test-market/fixture-plugin/2.0.0/skills"), "plugin-review")
  await fs.writeFile(path.join(skillsHome, ".codex/config.toml"), `[plugins."fixture-plugin@test-market"]\nenabled = true\n\n[[skills.config]]\npath = ${JSON.stringify(disabled)}\nenabled = false\n`)
  const invalid = path.join(skillsHome, ".agents/skills/invalid"); await fs.mkdir(invalid, { recursive: true }); await fs.writeFile(path.join(invalid, "SKILL.md"), "---\nname: [invalid\n---\n")
  const logFile = await fs.open(path.join(temporary, "server.log"), "a")
  server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: root, env: { ...process.env, CODE_MERGER_DATA: data, CODE_MERGER_PROJECTS: path.join(temporary, "projects"), CODE_MERGER_SKILLS_HOME: skillsHome, CODE_MERGER_BUILD_DIR: buildDirectory, CODE_MERGER_TSCONFIG: configFile }, detached: true, stdio: ["ignore", logFile.fd, logFile.fd],
  })
  server.unref(); await logFile.close()
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) break
    try { const res = await fetch(`${origin}/api/projects`); if (res.ok) { console.log(`Workspace fixture: ${temporary}; preview: ${origin}`); return } } catch {}
    await sleep(500)
  }
  throw new Error(`Server failed to start: ${await fs.readFile(path.join(temporary, "server.log"), "utf8")}`)
}, { timeout: 90_000 })

after(async () => {
  if (keep) return
  if (server?.pid) { try { process.kill(-server.pid, "SIGTERM") } catch {} }
  if (server && server.exitCode === null && server.signalCode === null) await new Promise((resolve) => {
    const timer = setTimeout(resolve, 5000)
    server.once("exit", () => { clearTimeout(timer); resolve() })
  })
  // Remove only the temporary test fixture that this suite created.
  if (temporary) await fs.rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  if (buildDirectory) await fs.rm(path.join(root, buildDirectory), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  if (configFile) { await fs.rm(path.join(root, configFile), { force: true }); await fs.rm(path.join(root, `${configFile}.tsbuildinfo`), { force: true }) }
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
  await t.test("discovers shared, project, native and enabled plugin skills without exposing their instructions", async () => {
    const list = async (agent, project = projectId) => (await api(`projects/${project}/skills?agent=${agent}`)).skills
    const shared = await list("fixture")
    assert.deepEqual(shared.map((s) => s.name), ["project-review", "shared-review"])
    assert.equal(shared[0].scope, "project"); assert.equal(shared[1].scope, "personal")
    assert.match(shared[0].description, /folded description/)
    assert.equal(Object.hasOwn(shared[0], "content"), false)
    const codex = await list("codex")
    assert.deepEqual(codex.map((s) => s.name), ["fixture-plugin:plugin-review", "project-review", "shared-review", "system-review"])
    assert((await list("claude")).some((s) => s.name === "synced-review"))
    assert((await list("gemini")).some((s) => s.name === "gemini-review"))
    assert(!(await list("fixture", freshProjectId)).some((s) => s.name === "project-review"))
    const nested = (await api("projects")).projects.find((p) => p.name === "Nested")
    assert((await list("fixture", nested.id)).some((s) => s.name === "project-review"))
    await api(`projects/${projectId}/skills?agent=missing`, "GET", undefined, 400)
  })
  await t.test("validates selected skills, passes their instructions to the CLI and persists message references", async () => {
    const { skills } = await api(`projects/${projectId}/skills?agent=fixture`)
    const projectSkill = skills.find((s) => s.name === "project-review")
    const { chat } = await api("chats", "POST", { projectId }, 201)
    for (const ids of [["/etc/passwd"], ["f".repeat(64)], Array(6).fill(projectSkill.id), "invalid"]) {
      await api(`chats/${chat.id}/messages`, "POST", { text: "invalid request", agent: "fixture", skills: ids }, 400)
    }
    const native = (await api(`projects/${projectId}/skills?agent=gemini`)).skills.find((s) => s.name === "gemini-review")
    await api(`chats/${chat.id}/messages`, "POST", { text: "wrong agent", agent: "fixture", skills: [native.id] }, 400)
    const { chat: other } = await api("chats", "POST", { projectId: freshProjectId }, 201)
    await api(`chats/${other.id}/messages`, "POST", { text: "wrong project", agent: "fixture", skills: [projectSkill.id] }, 400)
    const sent = await api(`chats/${chat.id}/messages`, "POST", { agent: "fixture", access: "read", skills: [projectSkill.id, projectSkill.id] }, 202)
    assert.deepEqual(sent.user.skills, [{ id: projectSkill.id, name: projectSkill.name, path: projectSkill.path }])
    let completed
    const wait = async () => {
      for (let i = 0; i < 100; i++) { completed = (await api(`chats/${chat.id}`)).chat; if (!completed.running) return; await sleep(50) }
      assert.fail("Fixture reply did not finish")
    }
    await wait()
    assert.equal(completed.title, "project-review"); assert.equal(completed.messages.at(-1).status, "done")
    const prompt = await fs.readFile(promptFile, "utf8")
    assert.match(prompt, /SKILL_FIXTURE_TOKEN/); assert(prompt.includes(path.dirname(projectSkill.path)))
    assert.match(prompt, /existing access and permission limits/)
    assert.equal((await fs.readFile(path.join(data, "chats", `${chat.id}.json`), "utf8")).includes('"skills"'), true)
    const definition = await fs.readFile(projectSkill.path, "utf8")
    await fs.rm(projectSkill.path)
    await api(`chats/${chat.id}/retry`, "POST", { access: "read" }, 400)
    assert.equal((await api(`chats/${chat.id}`)).chat.messages.length, 2)
    await fs.writeFile(projectSkill.path, definition)
    await api(`chats/${chat.id}/retry`, "POST", { access: "read" }, 202)
    await wait()
    assert.equal(completed.messages.length, 2)
    assert.equal(completed.messages[0].id, sent.user.id)
    assert.deepEqual(completed.messages[0].skills, sent.user.skills)
    assert.match(await fs.readFile(promptFile, "utf8"), /SKILL_FIXTURE_TOKEN/)
    await api(`chats/${chat.id}/messages`, "POST", { text: "SKILLS_TEST_SECOND", agent: "fixture", access: "read" }, 202)
    await wait()
    const second = await fs.readFile(promptFile, "utf8")
    assert(second.includes(projectSkill.path)); assert(!second.includes("SKILL_FIXTURE_TOKEN"))
    await fs.rm(projectSkill.path)
    await api(`chats/${chat.id}/messages`, "POST", { text: "removed skill", agent: "fixture", skills: [projectSkill.id] }, 400)
    await fs.writeFile(projectSkill.path, "---\nname: project-review\ndescription: Review the project\n---\nSKILL_FIXTURE_TOKEN\n")
  })
})
