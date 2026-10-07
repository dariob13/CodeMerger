import { execFile } from "node:child_process"
import path from "node:path"
import os from "node:os"
import { fail, json, readBody } from "@/lib/server/http"
import { expandPath, isDir } from "@/lib/server/store"

const PROMPT = "Choose the project folder"

// The system's own folder chooser, per platform: the command, and where the dialog should open.
function chooser(start: string): [command: string, args: string[]] | null {
  if (process.platform === "darwin") {
    const script = [
      "on run argv",
      "tell me to activate", // or the dialog opens behind the browser
      `POSIX path of (choose folder with prompt "${PROMPT}" default location (POSIX file (item 1 of argv)))`,
      "end run",
    ]
    return ["osascript", [...script.flatMap((line) => ["-e", line]), start]]
  }
  if (process.platform === "win32") {
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$d = New-Object System.Windows.Forms.FolderBrowserDialog",
      `$d.Description = '${PROMPT}'`,
      "$d.SelectedPath = $args[0]",
      "if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath } else { exit 1 }",
    ]
    return ["powershell", ["-NoProfile", "-STA", "-Command", `& { ${script.join("; ")} }`, start]]
  }
  if (process.platform === "linux") return ["zenity", ["--file-selection", "--directory", `--title=${PROMPT}`, `--filename=${start}${path.sep}`]]
  return null
}

// Opens the system's folder chooser on this machine and answers with the folder picked, or null if it was dismissed.
// In it a folder that exists can be selected, or a new one made.
export async function POST(request: Request) {
  const body = await readBody(request)
  // Open at the folder already in the form, or the nearest one above it that exists.
  let start = typeof body.start === "string" && body.start.trim() ? expandPath(body.start) : os.homedir()
  while (!isDir(start) && path.dirname(start) !== start) start = path.dirname(start)
  if (!isDir(start)) start = os.homedir()

  const spec = chooser(start)
  if (!spec) return fail("Choosing a folder isn't available on this system. Type its path instead.", 501)
  const picked = await new Promise<string | null | Error>((resolve) => {
    execFile(spec[0], spec[1], { timeout: 10 * 60_000 }, (err, stdout) => {
      const chosen = String(stdout || "").trim()
      if (chosen) return resolve(chosen)
      // A dismissed dialog exits with an error and no folder; a missing chooser can't be run at all.
      resolve(err && (err as NodeJS.ErrnoException).code === "ENOENT" ? err : null)
    })
  })
  if (picked instanceof Error) return fail("Couldn't open the folder chooser on this system. Type the folder's path instead.", 501)
  return json({ path: picked && picked.length > 1 ? picked.replace(/[/\\]+$/, "") : picked })
}
