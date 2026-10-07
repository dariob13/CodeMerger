import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { GitChange, GitCommit, Project, WorkspaceEntry, WorkspaceFile, WorkspaceGit } from "@/lib/types"
import { state } from "./store"

const exec = promisify(execFile)
const MAX_FILE = 2 * 1024 * 1024
const OMIT = new Set([".git", "node_modules", ".next", ".DS_Store"])

export class WorkspaceError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export function workspaceProject(id: string) {
  const project = state.projects.find((p) => p.id === id)
  if (!project) throw new WorkspaceError("Project not found", 404)
  return project
}

function inside(root: string, file: string) {
  const relative = path.relative(root, file)
  return !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)
}

// Reject both traversal and symlink escapes, including an absent file's existing parent.
export async function projectPath(project: Project, input: string, create = false) {
  if (input.includes("\0") || path.isAbsolute(input) || input.split(/[\\/]/).some((p) => p === ".." || p === ".git")) {
    throw new WorkspaceError("Invalid project path")
  }
  const root = await fs.realpath(project.cwd)
  const file = path.resolve(root, input || ".")
  if (!inside(root, file)) throw new WorkspaceError("Path is outside this project")
  let checked = file
  for (;;) {
    try {
      const actual = await fs.realpath(/* turbopackIgnore: true */ checked)
      if (!inside(root, actual) || path.relative(root, actual).split(path.sep).includes(".git")) throw new WorkspaceError("Path is outside this project's files")
      break
    } catch (error) {
      if (!create || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      checked = path.dirname(checked)
    }
  }
  return file
}

export async function listFiles(project: Project, directory: string): Promise<WorkspaceEntry[]> {
  const file = await projectPath(project, directory)
  const entries = await fs.readdir(/* turbopackIgnore: true */ file, { withFileTypes: true })
  return entries.filter((e) => !OMIT.has(e.name) && !e.isSymbolicLink() && (e.isDirectory() || e.isFile()))
    .map((e) => ({ name: e.name, path: path.posix.join(directory, e.name), kind: e.isDirectory() ? "directory" as const : "file" as const }))
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "directory" ? -1 : 1))
}

export async function searchFiles(project: Project, query: string) {
  const found: WorkspaceEntry[] = []
  const pending = [""]
  let visited = 0
  while (pending.length && visited++ < 2000 && found.length < 200) {
    const entries = await listFiles(project, pending.shift()!)
    for (const entry of entries) {
      if (entry.kind === "directory") pending.push(entry.path)
      else if (entry.path.toLowerCase().includes(query.toLowerCase())) found.push(entry)
    }
  }
  return { entries: found, truncated: pending.length > 0 }
}

export async function readFile(project: Project, input: string): Promise<WorkspaceFile> {
  const file = await projectPath(project, input)
  const stat = await fs.stat(/* turbopackIgnore: true */ file)
  if (!stat.isFile()) throw new WorkspaceError("Select a file")
  if (stat.size > MAX_FILE) throw new WorkspaceError("This file is too large to open (2 MB limit)")
  const data = await fs.readFile(/* turbopackIgnore: true */ file)
  if (data.length > MAX_FILE) throw new WorkspaceError("This file is too large to open (2 MB limit)")
  if (data.includes(0)) throw new WorkspaceError("Binary files cannot be opened in the text editor")
  const content = data.toString("utf8")
  if (!Buffer.from(content).equals(data)) throw new WorkspaceError("This file is not UTF-8 text")
  return { path: input, content, version: crypto.createHash("sha256").update(data).digest("hex") }
}

// Serialize index and file writes within a project. Never run commands through a shell.
const writes = new Map<string, Promise<unknown>>()
export async function workspaceWrite<T>(project: Project, action: () => Promise<T>): Promise<T> {
  const key = await fs.realpath(project.cwd)
  const previous = writes.get(key) ?? Promise.resolve()
  const current = previous.catch(() => {}).then(action)
  writes.set(key, current)
  try { return await current } finally { if (writes.get(key) === current) writes.delete(key) }
}

export async function writeFile(project: Project, input: string, content: string, version?: string) {
  if (!input || Buffer.byteLength(content) > MAX_FILE) throw new WorkspaceError("Invalid file or file exceeds 2 MB")
  const file = await projectPath(project, input, !version)
  if (version) {
    if ((await readFile(project, input)).version !== version) throw new WorkspaceError("This file changed on disk. Reopen it before saving your edits.", 409)
    await fs.writeFile(file, content)
  } else {
    // Create only: never overwrite a file from the New file dialog.
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, content, { flag: "wx" })
  }
  return readFile(project, input)
}

async function git(project: Project, args: string[], allowed = [0]) {
  try {
    return (await exec("git", ["--literal-pathspecs", "-c", "core.quotepath=false", ...args], {
      cwd: project.cwd, timeout: 20_000, maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
    })).stdout
  } catch (error) {
    const failure = error as Error & { code?: number; stderr?: string; stdout?: string }
    if (allowed.includes(failure.code ?? -1)) return failure.stdout ?? ""
    throw new WorkspaceError(failure.stderr?.trim() || failure.message)
  }
}

const emptyGit = (): WorkspaceGit => ({ available: false, branch: "", upstream: null, ahead: 0, behind: 0, changes: [], history: [] })

export async function stagedDiff(project: Project) {
  return git(project, ["diff", "--cached", "--no-ext-diff", "--no-textconv", "--", "."])
}

export async function gitSnapshot(project: Project): Promise<WorkspaceGit> {
  let root: string
  try { root = (await git(project, ["rev-parse", "--show-toplevel"])).trim() } catch { return emptyGit() }
  const cwd = await fs.realpath(project.cwd)
  const prefix = path.relative(root, cwd).split(path.sep).join("/")
  const relative = (file: string) => prefix ? (file.startsWith(`${prefix}/`) ? file.slice(prefix.length + 1) : null) : file
  const [status, branch, upstream, stagedStats, workStats, log, unpushed] = await Promise.all([
    git(project, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
    git(project, ["symbolic-ref", "--short", "HEAD"], [0, 1]).then(async (b) => b.trim() || (await git(project, ["rev-parse", "--short", "HEAD"])).trim()),
    git(project, ["rev-parse", "--abbrev-ref", "@{upstream}"], [0, 128]).then((s) => s.trim() || null),
    git(project, ["diff", "--cached", "--numstat", "-z", "--no-renames"]),
    git(project, ["diff", "--numstat", "-z", "--no-renames"]),
    git(project, ["log", "-30", "--format=%H%x00%s%x00%an%x00%at%x00%B%x00%x1e"], [0, 128]),
    git(project, ["log", "@{upstream}..HEAD", "--format=%H"], [0, 128]),
  ])
  const stats = (raw: string) => new Map(raw.split("\0").filter(Boolean).map((row) => {
    const [a, d, ...file] = row.split("\t")
    return [file.join("\t"), { added: Number(a) || 0, deleted: Number(d) || 0, binary: a === "-" }]
  }))
  const staged = stats(stagedStats), work = stats(workStats)
  const changes: GitChange[] = []
  const rows = status.split("\0")
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const code = row.slice(0, 2), rawPath = row.slice(3), file = relative(rawPath)
    const original = /[RC]/.test(code) ? relative(rows[++i]) : undefined
    if (file === null || file.split("/").includes(".git")) continue
    const add = (isStaged: boolean, letter: string) => {
      const source = isStaged ? staged : work
      const stats = source.get(rawPath) || { added: 0, deleted: 0, binary: false }
      const old = original ? source.get(prefix ? `${prefix}/${original}` : original) : undefined
      changes.push({ path: file, originalPath: original ?? undefined, status: letter, staged: isStaged, ...stats, deleted: stats.deleted + (old?.deleted || 0) })
    }
    if (code === "??") {
      let count = 0, binary = false
      try { const content = await readFile(project, file); count = content.content ? content.content.split("\n").length - (content.content.endsWith("\n") ? 1 : 0) : 0 } catch { binary = true }
      changes.push({ path: file, status: "U", staged: false, added: count, deleted: 0, binary })
    } else {
      if (code[0] !== " " && code[0] !== "?") add(true, code[0])
      if (code[1] !== " " && code[1] !== "?") add(false, code[1])
    }
  }
  const history: GitCommit[] = log.split("\x1e").filter((s) => s.trim()).map((entry) => {
    const [hash, subject, author, ts, body] = entry.trimStart().split("\0")
    const identity = `${author}\n${body}`
    const agent = /claude/i.test(identity) ? "claude" : /codex|openai/i.test(identity) ? "codex" : /opencode/i.test(identity) ? "opencode" : null
    return { hash, subject, author, agent, ts: Number(ts) * 1000, unpushed: unpushed.split("\n").includes(hash) }
  })
  let ahead = 0, behind = 0
  if (upstream) { const counts = (await git(project, ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"])).trim().split(/\s+/); ahead = Number(counts[0]); behind = Number(counts[1]) }
  return { available: true, branch, upstream, ahead, behind, changes, history }
}

export async function gitDiff(project: Project, input: string, staged: boolean, commit?: string) {
  if (commit) {
    if (!/^[a-f0-9]{40}$/.test(commit)) throw new WorkspaceError("Invalid commit")
    return git(project, ["show", "--format=fuller", "--no-ext-diff", "--no-textconv", commit, "--", "."])
  }
  const change = (await gitSnapshot(project)).changes.find((c) => c.path === input && c.staged === staged)
  if (!change) throw new WorkspaceError("This change no longer exists", 404)
  const file = await projectPath(project, input, true)
  const diff = await git(project, ["diff", ...(staged ? ["--cached"] : []), "--no-ext-diff", "--no-textconv", "--", input, ...(change.originalPath ? [change.originalPath] : [])])
  if (diff || staged) return diff
  return git(project, ["diff", "--no-index", "--no-ext-diff", "--no-textconv", "--", "/dev/null", file], [0, 1])
}

export async function gitAction(project: Project, action: string, paths: string[], message: string) {
  const snapshot = await gitSnapshot(project)
  if (!snapshot.available) throw new WorkspaceError("This folder is not a Git repository")
  if (action === "stage" || action === "unstage") {
    const candidates = snapshot.changes.filter((c) => c.staged === (action === "unstage"))
    const selected = paths.length ? candidates.filter((c) => paths.includes(c.path)) : candidates
    if (!selected.length || (paths.length && paths.some((p) => !selected.some((c) => c.path === p)))) throw new WorkspaceError("The selected changes no longer exist")
    const files = [...new Set(selected.flatMap((c) => [c.path, ...(c.originalPath ? [c.originalPath] : [])]))]
    for (const file of files) await projectPath(project, file, true)
    if (action === "stage") await git(project, ["add", "--", ...files])
    else {
      const head = await git(project, ["rev-parse", "--verify", "HEAD"], [0, 128])
      if (head) await git(project, ["restore", "--staged", "--", ...files])
      else await git(project, ["rm", "--cached", "--ignore-unmatch", "--", ...files])
    }
  } else if (action === "commit") {
    if (!message.trim() || message.length > 10_000) throw new WorkspaceError("Enter a commit message")
    if (!snapshot.changes.some((c) => c.staged)) throw new WorkspaceError("Stage changes before committing")
    const root = (await git(project, ["rev-parse", "--show-toplevel"])).trim()
    const prefix = path.relative(root, await fs.realpath(project.cwd)).split(path.sep).join("/")
    if (prefix && (await git(project, ["diff", "--cached", "--name-only", "-z"])).split("\0").some((file) => file && !file.startsWith(`${prefix}/`))) {
      throw new WorkspaceError("There are staged changes outside this project. Open the repository root to review and commit them together.")
    }
    await git(project, ["commit", "-m", message.trim()])
  } else if (action === "push") {
    if (!snapshot.upstream) throw new WorkspaceError("This branch has no upstream. Configure its remote before pushing.")
    await git(project, ["push"])
  } else throw new WorkspaceError("Unknown Git action")
  return gitSnapshot(project)
}

export function workspaceFailure(error: unknown) {
  const e = error as Error & { code?: string; status?: number }
  const message = e.code === "ENOENT" ? "The file or project folder no longer exists" : e.code === "EEXIST" ? "A file with this name already exists" : e.message
  return Response.json({ error: message || "Workspace request failed" }, { status: e.status ?? 400, headers: { "Cache-Control": "no-store" } })
}
