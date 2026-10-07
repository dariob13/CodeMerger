"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, SquareIcon, TerminalIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Project } from "@/lib/types"
import { cn } from "@/lib/utils"

type Line = { kind: "command" | "output" | "note"; text: string }
type Shell = { id: number; name: string; lines: Line[]; running: boolean; history: string[] }

const MAX_LINES = 2000
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g
const newShell = (id: number): Shell => ({ id, name: "shell", lines: [], running: false, history: [] })

// A strip under the chat and the editor with one tab per shell. Each line typed runs in the project's folder.
// It prints what a command prints; it is not a full terminal, so programs that need a keyboard won't work in it.
export function TerminalPanel({ project, branch, open, onOpenChange }: { project: Project; branch?: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [shells, setShells] = React.useState<Shell[]>(() => [newShell(1)])
  const [activeId, setActiveId] = React.useState(1)
  const [draft, setDraft] = React.useState("")
  const [recall, setRecall] = React.useState(-1)
  const nextId = React.useRef(2)
  const running = React.useRef(new Map<number, AbortController>())
  const output = React.useRef<HTMLDivElement>(null)
  const input = React.useRef<HTMLInputElement>(null)
  const shell = shells.find((s) => s.id === activeId) ?? shells[0]
  const folder = project.cwd.replace(/^\/(Users|home)\/[^/]+/, "~")

  const change = (id: number, update: (shell: Shell) => Shell) => setShells((prev) => prev.map((s) => (s.id === id ? update(s) : s)))
  const append = (id: number, kind: Line["kind"], text: string) =>
    change(id, (s) => {
      const lines = [...s.lines]
      for (const [i, part] of text.replace(ANSI, "").replace(/\r\n?/g, "\n").split("\n").entries()) {
        const last = lines.at(-1)
        // Output arrives in chunks, so a chunk continues the line the last one left open.
        if (i === 0 && kind === "output" && last?.kind === "output") lines[lines.length - 1] = { kind, text: last.text + part }
        else lines.push({ kind, text: part })
      }
      return { ...s, lines: lines.slice(-MAX_LINES) }
    })

  React.useEffect(() => {
    output.current?.scrollTo({ top: output.current.scrollHeight })
  }, [shell?.lines, open])
  // Leaving the project ends what its shells are running.
  React.useEffect(() => {
    const controllers = running.current
    return () => controllers.forEach((controller) => controller.abort())
  }, [])

  const run = async (id: number, command: string) => {
    const controller = new AbortController()
    running.current.set(id, controller)
    change(id, (s) => ({ ...s, name: command.split(/\s+/)[0].split("/").pop() || "shell", running: true, history: [command, ...s.history.filter((c) => c !== command)].slice(0, 50), lines: [...s.lines, { kind: "command", text: command }] }))
    try {
      const res = await fetch(`/api/projects/${project.id}/terminal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command }), signal: controller.signal })
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`)
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffered = ""
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffered += value
        const events = buffered.split("\n")
        buffered = events.pop() ?? ""
        for (const raw of events) {
          const event = JSON.parse(raw) as { type: "out"; text: string } | { type: "exit"; code: number; error?: string }
          if (event.type === "out") append(id, "output", event.text)
          else if (event.error || event.code) append(id, "note", event.error || `exit ${event.code}`)
        }
      }
    } catch (error) {
      append(id, "note", controller.signal.aborted ? "stopped" : error instanceof Error ? error.message : String(error))
    } finally {
      running.current.delete(id)
      change(id, (s) => ({ ...s, running: false }))
    }
  }

  const close = (id: number) => {
    running.current.get(id)?.abort()
    const left = shells.filter((s) => s.id !== id)
    if (!left.length) {
      // The last shell closing folds the strip; a fresh one is waiting when it opens again.
      const fresh = newShell(nextId.current++)
      setShells([fresh])
      setActiveId(fresh.id)
      return onOpenChange(false)
    }
    setShells(left)
    if (id === activeId) setActiveId(left[0].id)
  }
  const add = () => {
    const fresh = newShell(nextId.current++)
    setShells((prev) => [...prev, fresh])
    setActiveId(fresh.id)
    onOpenChange(true)
    requestAnimationFrame(() => input.current?.focus())
  }
  const prompt = (
    <span className="whitespace-pre text-muted-foreground">{`${folder}${branch ? `  [${branch}]` : ""} $ `}</span>
  )

  return (
    <section aria-label="Terminal" className="terminal-panel flex shrink-0 flex-col border-t">
      <div className={cn("flex h-9 shrink-0 items-center", open && "border-b")}>
        <div role="tablist" aria-label="Shells" className="flex h-full min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]">
          {shells.map((s) => (
            <div key={s.id} className={cn("group/shell relative flex h-full shrink-0 items-center border-r", open && s.id === shell.id && "bg-card")}>
              <button
                type="button"
                role="tab"
                aria-selected={open && s.id === shell.id}
                className={cn("flex h-full items-center gap-2 pr-9 pl-3.5 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset", open && s.id === shell.id ? "text-foreground" : "text-subtle")}
                onClick={() => {
                  // The open shell's own tab folds the strip, as the chevron does.
                  if (open && s.id === shell.id) return onOpenChange(false)
                  setActiveId(s.id)
                  onOpenChange(true)
                  requestAnimationFrame(() => input.current?.focus())
                }}
              >
                <TerminalIcon className={cn("size-[13px]", s.running && "motion-safe:animate-pulse")} aria-hidden />
                {s.name}
              </button>
              <Button variant="ghost" size="icon-xs" className="absolute right-2 size-5 text-subtle" aria-label={`Close ${s.name}`} onClick={() => close(s.id)}>
                <XIcon className="size-3" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 text-muted-foreground">
          <Button variant="ghost" size="icon-xs" aria-label="New shell" title="New shell" onClick={add}>
            <PlusIcon className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label={open ? "Hide terminal" : "Show terminal"} title={open ? "Hide terminal" : "Show terminal"} aria-expanded={open} onClick={() => onOpenChange(!open)}>
            {open ? <ChevronDownIcon className="size-3.5" /> : <ChevronUpIcon className="size-3.5" />}
          </Button>
        </div>
      </div>
      {open && (
        // Clicking anywhere in the output puts the cursor back on the prompt, unless text is being selected.
        <div ref={output} role="tabpanel" className="h-44 overflow-y-auto px-4 py-3 font-mono text-xs leading-5" onClick={() => !window.getSelection()?.toString() && input.current?.focus()}>
          {shell.lines.map((line, i) => (
            <div key={i} className={cn("min-h-5 wrap-anywhere whitespace-pre-wrap", line.kind === "command" ? "text-foreground" : line.kind === "note" ? "text-destructive" : "text-subtle")}>
              {line.kind === "command" && prompt}
              {line.text}
            </div>
          ))}
          {shell.running ? (
            <Button variant="ghost" size="xs" className="mt-1 -ml-1.5 gap-1.5 font-sans text-muted-foreground" onClick={() => running.current.get(shell.id)?.abort()}>
              <SquareIcon className="size-2.5 fill-current" />
              Stop
            </Button>
          ) : (
            <form
              className="flex"
              onSubmit={(e) => {
                e.preventDefault()
                const command = draft.trim()
                if (!command) return
                setDraft("")
                setRecall(-1)
                if (command === "clear") return change(shell.id, (s) => ({ ...s, lines: [] }))
                void run(shell.id, command)
              }}
            >
              {prompt}
              <input
                ref={input}
                autoFocus
                aria-label={`Command to run in ${project.name}`}
                value={draft}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent whitespace-pre text-foreground outline-none"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
                  e.preventDefault()
                  const next = Math.max(-1, Math.min(shell.history.length - 1, recall + (e.key === "ArrowUp" ? 1 : -1)))
                  setRecall(next)
                  setDraft(next < 0 ? "" : shell.history[next])
                }}
              />
            </form>
          )}
        </div>
      )}
    </section>
  )
}
