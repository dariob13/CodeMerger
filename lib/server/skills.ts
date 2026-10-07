import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import crypto from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { parse as parseYaml } from "yaml"
import { parse as parseToml } from "smol-toml"
import type { AgentSkill, Project, SkillReference } from "@/lib/types"
import { WorkspaceError } from "./workspace"

const exec = promisify(execFile)
export const MAX_SKILLS = 5
const MAX_BYTES = 128 * 1024
type Root = { directory: string; scope: AgentSkill["scope"]; origin: string; plugin?: string }
export type ResolvedSkill = AgentSkill & { content: string }

async function readText(file: string) {
  const stat = await fs.stat(/* turbopackIgnore: true */ file)
  if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error("Skill file exceeds 128 KB")
  const buffer = await fs.readFile(/* turbopackIgnore: true */ file)
  if (buffer.length > MAX_BYTES || buffer.includes(0)) throw new Error("Invalid skill file")
  const text = buffer.toString("utf8")
  if (!Buffer.from(text).equals(buffer)) throw new Error("Skill file must be UTF-8")
  return text
}

async function directories(directory: string) {
  try {
    return (await fs.readdir(/* turbopackIgnore: true */ directory, { withFileTypes: true }))
      .filter((entry) => !entry.name.startsWith(".") && (entry.isDirectory() || entry.isSymbolicLink()))
      .map((entry) => path.join(directory, entry.name)).sort()
  } catch { return [] }
}

async function projectFolders(project: Project) {
  const cwd = await fs.realpath(project.cwd)
  let root = cwd
  try {
    const result = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, timeout: 2000 })
    const candidate = await fs.realpath(result.stdout.trim())
    if (cwd === candidate || cwd.startsWith(candidate + path.sep)) root = candidate
  } catch { /* A project without Git still has its own skill folders. */ }
  const folders = [cwd]
  while (folders.at(-1) !== root) folders.push(path.dirname(folders.at(-1)!))
  return folders
}

async function codexPlugins(codex: string): Promise<Root[]> {
  try {
    const config = parseToml(await readText(path.join(codex, "config.toml")))
    const plugins = config.plugins as Record<string, { enabled?: boolean }> | undefined
    const roots: Root[] = []
    for (const [id, settings] of Object.entries(plugins || {})) {
      if (settings.enabled !== true) continue
      const [plugin, marketplace] = id.split("@")
      if (!plugin || !marketplace || !/^[\w.-]+$/.test(plugin) || !/^[\w.-]+$/.test(marketplace)) continue
      const versions = await directories(path.join(codex, "plugins/cache", marketplace, plugin))
      const latest = versions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1)
      if (latest) roots.push({ directory: path.join(latest, "skills"), scope: "plugin", origin: `${plugin} plugin`, plugin })
    }
    return roots
  } catch { return [] }
}

async function claudePlugins(claude: string, folders: string[]): Promise<Root[]> {
  try {
    const installed = JSON.parse(await readText(path.join(claude, "plugins/installed_plugins.json"))) as {
      plugins?: Record<string, { installPath?: string; scope?: string; projectPath?: string }[]>
    }
    let enabled: Record<string, boolean> = {}
    for (const file of [path.join(claude, "settings.json"), ...[...folders].reverse().flatMap((folder) => [path.join(folder, ".claude/settings.json"), path.join(folder, ".claude/settings.local.json")])]) {
      try { enabled = { ...enabled, ...JSON.parse(await readText(file)).enabledPlugins } } catch {}
    }
    return Object.entries(installed.plugins || {}).flatMap(([id, entries]) => enabled[id] === false ? [] : entries.flatMap((entry) => {
      if (!entry.installPath || ((entry.scope === "project" || entry.scope === "local") && !folders.includes(entry.projectPath || ""))) return []
      const plugin = id.split("@")[0]
      return [{ directory: path.join(entry.installPath, "skills"), scope: "plugin" as const, origin: `${plugin} plugin`, plugin }]
    }))
  } catch { return [] }
}

async function skillRoots(project: Project, agent: string) {
  // The override keeps tests completely separate from the user's installed skills.
  const override = process.env.CODE_MERGER_SKILLS_HOME
  const home = override || os.homedir()
  const codex = (!override && process.env.CODEX_HOME) || path.join(home, ".codex")
  const claude = (!override && process.env.CLAUDE_CONFIG_DIR) || path.join(home, ".claude")
  const config = (!override && process.env.XDG_CONFIG_HOME) || path.join(home, ".config")
  const folders = await projectFolders(project)
  const local = agent === "claude" ? [".claude/skills"] : agent === "opencode" ? [".opencode/skills", ".claude/skills"] : agent === "gemini" ? [".gemini/skills"] : []
  const native = agent === "codex" ? [path.join(codex, "skills")] : agent === "claude" ? [path.join(claude, "skills")] : agent === "opencode" ? [path.join(config, "opencode/skills"), path.join(claude, "skills")] : agent === "gemini" ? [path.join(home, ".gemini/skills")] : []
  const origin = { claude: "Claude Code", codex: "Codex", opencode: "OpenCode", gemini: "Gemini CLI" }[agent] || "Agent"
  const roots: Root[] = folders.flatMap((folder) => [
    { directory: path.join(folder, ".agents/skills"), scope: "project" as const, origin: "Shared" },
    ...local.map((dir) => ({ directory: path.join(folder, dir), scope: "project" as const, origin })),
  ])
  roots.push({ directory: path.join(home, ".agents/skills"), scope: "personal", origin: "Shared" }, ...native.map((directory) => ({ directory, scope: "personal" as const, origin })))
  if (agent === "codex") {
    roots.push({ directory: path.join(codex, "skills/.system"), scope: "system", origin }, ...await codexPlugins(codex))
    if (!override) roots.push({ directory: "/etc/codex/skills", scope: "system", origin })
  }
  if (agent === "claude") roots.push(...await claudePlugins(claude, folders))
  return { roots, codex }
}

export async function discoverSkills(project: Project, agent: string): Promise<ResolvedSkill[]> {
  const { roots, codex } = await skillRoots(project, agent)
  const disabled = new Set<string>()
  if (agent === "codex") {
    try {
      const config = parseToml(await readText(path.join(codex, "config.toml")))
      const skills = config.skills as { config?: { path?: string; enabled?: boolean }[] } | undefined
      for (const skill of skills?.config || []) if (skill.enabled === false && skill.path) disabled.add(await fs.realpath(skill.path).catch(() => path.resolve(skill.path!)))
    } catch {}
  }
  const skills = new Map<string, ResolvedSkill>()
  for (const root of roots) {
    const visited = new Set<string>()
    const pending = [{ directory: root.directory, depth: 0 }]
    while (pending.length && visited.size < 500 && skills.size < 500) {
      const { directory, depth } = pending.shift()!
      const actual = await fs.realpath(/* turbopackIgnore: true */ directory).catch(() => null)
      if (!actual || visited.has(actual)) continue
      visited.add(actual)
      try {
        const file = await fs.realpath(path.join(actual, "SKILL.md"))
        if (disabled.has(file) || skills.has(file)) continue
        const text = await readText(file)
        const header = /^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)
        if (header) {
          const metadata = parseYaml(header[1], { maxAliasCount: 0, logLevel: "silent" }) as Record<string, unknown> | null
          const name = typeof metadata?.name === "string" ? metadata.name.trim() : path.basename(directory)
          const description = typeof metadata?.description === "string" ? metadata.description.trim() : ""
          if (metadata?.["user-invocable"] !== false && name && name.length <= 128 && description) {
            const id = crypto.createHash("sha256").update(file).digest("hex")
            skills.set(file, { id, name: root.plugin ? `${root.plugin}:${name}` : name, description: description.slice(0, 2048), path: file, scope: root.scope, origin: root.origin, content: text.trim() })
          }
        }
      } catch { /* Skip missing, invalid, binary, or oversized definitions. */ }
      if (depth < 4) for (const child of await directories(actual)) {
        if (!/^(node_modules|scripts|assets|references|templates)$/.test(path.basename(child))) pending.push({ directory: child, depth: depth + 1 })
      }
    }
  }
  return [...skills.values()].sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path))
}

export function skillReference(skill: SkillReference): SkillReference { return { id: skill.id, name: skill.name, path: skill.path } }
export function skillSummary(skill: ResolvedSkill): AgentSkill { return { ...skillReference(skill), description: skill.description, scope: skill.scope, origin: skill.origin } }

export async function resolveSkills(project: Project, agent: string, ids: unknown): Promise<ResolvedSkill[]> {
  if (ids === undefined) return []
  if (!Array.isArray(ids) || ids.length > MAX_SKILLS || ids.some((id) => typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id))) throw new WorkspaceError(`Select up to ${MAX_SKILLS} installed skills`)
  if (!ids.length) return []
  const available = await discoverSkills(project, agent)
  return [...new Set<string>(ids)].map((id) => {
    const skill = available.find((skill) => skill.id === id)
    if (!skill) throw new WorkspaceError("A selected skill is no longer available for this project and agent. Refresh the skills picker and select it again.")
    return skill
  })
}

export function skillInstructions(skills: ResolvedSkill[] = []) {
  if (!skills.length) return ""
  let budget = 32 * 1024 // Some adapters take a prompt argument with an OS size limit.
  return [
    "The user explicitly selected the following skills for the latest message. Use the native skill mechanism when available, otherwise follow the supplied instructions. Resolve each skill's relative file references from its directory. Keep the agent's existing access and permission limits.",
    ...skills.map((skill) => {
      const bytes = Buffer.byteLength(skill.content)
      const content = bytes <= budget ? skill.content : "Read the full SKILL.md file at the path above before answering; its instructions are too long to include here."
      if (bytes <= budget) budget -= bytes
      return `\nSkill: ${JSON.stringify(skill.name)}\nSkill file: ${JSON.stringify(skill.path)}\nSkill directory: ${JSON.stringify(path.dirname(skill.path))}\n\n${content}\n`
    }),
    "\nEnd of selected skill instructions. The user's conversation and latest request follow.\n\n",
  ].join("\n")
}
