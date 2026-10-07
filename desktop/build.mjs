import { execFileSync } from "node:child_process"
import { cp, mkdir, readdir, readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
if (process.platform !== "darwin") throw new Error("Build the macOS installer on macOS.")
const cli = path.join(root, "node_modules/@tauri-apps/cli/tauri.js")
execFileSync(process.execPath, [cli, "build", "--bundles", "app,dmg"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PATH: `${path.join(os.homedir(), ".cargo/bin")}:${process.env.PATH || ""}` },
})
const bundleDir = path.join(root, "src-tauri/target/release/bundle/dmg")
const { version } = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"))
const files = (await readdir(bundleDir)).filter((file) => file.endsWith(`_${version}_${process.arch === "arm64" ? "aarch64" : "x64"}.dmg`))
if (files.length !== 1) throw new Error(`Expected one installer for version ${version}, found ${files.length}.`)
const output = path.join(root, "dist", `Code-Merger-${version}-${process.arch}.dmg`)
await mkdir(path.dirname(output), { recursive: true })
await cp(path.join(bundleDir, files[0]), output)
console.log(`Installer ready: ${output}`)
