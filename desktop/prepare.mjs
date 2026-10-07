import { execFileSync } from "node:child_process"
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const buildDir = ".next-desktop"
const serverDir = path.join(root, "src-tauri/resources/server")
const binDir = path.join(root, "src-tauri/binaries")

if (process.platform !== "darwin") throw new Error("Build the macOS installer on macOS.")
if (!["arm64", "x64"].includes(process.arch)) throw new Error(`Unsupported architecture: ${process.arch}`)

// Build with empty temporary data; never package the developer's chats or uploads.
const tempData = await mkdtemp(path.join(os.tmpdir(), "code-merger-build-"))
try {
  const tsconfig = JSON.parse(await readFile(path.join(root, "tsconfig.json"), "utf8"))
  await writeFile(path.join(root, ".desktop-tsconfig.json"), JSON.stringify({
    extends: "./tsconfig.json",
    compilerOptions: { incremental: false },
    include: ["next-env.d.ts", "*.ts", "app/**/*.ts", "app/**/*.tsx", "components/**/*.ts", "components/**/*.tsx", "hooks/**/*.ts", "hooks/**/*.tsx", "lib/**/*.ts", `${buildDir}/types/**/*.ts`],
    exclude: tsconfig.exclude,
  }, null, 2))
  await rm(path.join(root, buildDir), { recursive: true, force: true })
  execFileSync(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, CODE_MERGER_DESKTOP: "1", CODE_MERGER_BUILD_DIR: buildDir, CODE_MERGER_TSCONFIG: ".desktop-tsconfig.json", CODE_MERGER_DATA: tempData },
  })
  await rm(serverDir, { recursive: true, force: true })
  await mkdir(serverDir, { recursive: true })
  // Copy only the server and runtime dependencies, even if a trace includes extra source files.
  for (const entry of ["server.js", "package.json", "node_modules", buildDir]) {
    await cp(path.join(root, buildDir, "standalone", entry), path.join(serverDir, entry), { recursive: true, dereference: true })
  }
  // Include all compiled server chunks; prerendered pages can load them at runtime too.
  await cp(path.join(root, buildDir, "server"), path.join(serverDir, buildDir, "server"), { recursive: true })
  // Runtime-loaded API modules are not all represented in Next's standalone traces.
  // Include Next itself so an installed app never falls back to the repo's node_modules.
  await cp(path.join(root, "node_modules/next"), path.join(serverDir, "node_modules/next"), {
    recursive: true,
    dereference: true,
    filter: (file) => !file.endsWith(".map") && !file.includes(`${path.sep}dist${path.sep}docs`),
  })
  await cp(path.join(root, buildDir, "static"), path.join(serverDir, buildDir, "static"), { recursive: true })
  await cp(path.join(root, "public"), path.join(serverDir, "public"), { recursive: true })
  const forbidden = ["data", "workspace", ".env", ".git", "Code Merger"]
  const entries = await readdir(serverDir)
  if (entries.some((entry) => forbidden.includes(entry))) throw new Error("Private files appeared in the desktop payload.")

  await mkdir(binDir, { recursive: true })
  const triple = process.arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin"
  const runtime = path.join(binDir, `node-${triple}`)
  // Extract only the current architecture from a universal Node installation.
  const architecture = process.arch === "arm64" ? "arm64" : "x86_64"
  const architectures = execFileSync("/usr/bin/lipo", ["-archs", process.execPath], { encoding: "utf8" }).trim().split(/\s+/)
  if (!architectures.includes(architecture)) throw new Error("Node does not contain the requested architecture.")
  if (architectures.length === 1) await cp(process.execPath, runtime)
  else execFileSync("/usr/bin/lipo", [process.execPath, "-thin", architecture, "-output", runtime], { stdio: "inherit" })
  await chmod(runtime, 0o755)
  const license = await fetch(`https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`)
  if (!license.ok) throw new Error(`Could not retrieve Node ${process.version}'s license: ${license.status}`)
  await writeFile(path.join(serverDir, "NODE-LICENSE"), await license.text())
  console.log(`Desktop server and Node ${process.version} prepared for ${triple}.`)
} finally {
  await rm(tempData, { recursive: true, force: true })
}
