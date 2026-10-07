"use client"

import * as React from "react"
import type { TokensResult } from "shiki"
import { XIcon } from "lucide-react"
import { PanelResizeHandle } from "@/components/panel-resize-handle"
import { usePanelWidth } from "@/hooks/use-panel-width"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/confirm-dialog"
import type { EditorDocument, WorkspaceState } from "@/hooks/use-workspace"
import { WorkspaceIcon, workspaceFileIcon } from "@/components/workspace-icon"
import { highlightCode } from "@/lib/syntax"
import { cn } from "@/lib/utils"

function language(path: string) {
  const extension = path.split(".").pop() || "text"
  return ({ ts: "typescript", js: "javascript", mjs: "javascript", cjs: "javascript", md: "markdown", yml: "yaml", py: "python", rs: "rust", sh: "bash" } as Record<string, string>)[extension] || extension
}

export function WorkspaceEditor({ workspace }: { workspace: WorkspaceState }) {
  const { width, resize } = usePanelWidth("editor", 240, 1200)
  const document = workspace.documents.find((d) => d.key === workspace.activeDocument)
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [pendingClose, setPendingClose] = React.useState<EditorDocument | null>(null)
  const [highlighted, setHighlighted] = React.useState<{ source: string; path: string; result: TokensResult } | null>(null)
  const textarea = React.useRef<HTMLTextAreaElement>(null)
  const dirty = document?.content !== document?.saved

  React.useEffect(() => {
    if (!document || document.kind !== "file") return
    let cancelled = false
    highlightCode(document.content, language(document.path)).then((result) => {
      if (!cancelled) setHighlighted({ source: document.content, path: document.path, result })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [document])

  const save = async () => {
    if (!document || saving || !dirty) return
    setSaving(true)
    try { await workspace.saveDocument(document) } finally { setSaving(false) }
  }
  if (!document) return null
  const tokens = highlighted?.source === document.content && highlighted.path === document.path ? highlighted.result.tokens : null
  const lines = document.content.split("\n")
  return <section aria-label="Workspace editor" style={{ "--editor-width": width === null ? "32vw" : `${width}px` } as React.CSSProperties} className="fixed inset-0 z-40 flex h-svh w-full min-w-0 flex-col border-l bg-background lg:relative lg:inset-auto lg:z-auto lg:h-full lg:min-w-60 lg:w-(--editor-width)">
    <PanelResizeHandle label="editor" width={width ?? 480} min={240} max={1200} edge="left" onResize={resize} className="hidden lg:block" />
    <div role="tablist" aria-label="Open files" className="flex h-12 shrink-0 overflow-x-auto border-b">
      <Button variant="ghost" className="h-full shrink-0 rounded-none px-3 lg:hidden" aria-label="Back to chat" onClick={() => workspace.setActiveDocument(null)}><XIcon className="size-4" /></Button>
      {workspace.documents.map((doc) => <div key={doc.key} className={cn("group/file relative flex shrink-0 items-center border-r", doc.key === document.key && "bg-card")}>
        <button role="tab" aria-selected={doc.key === document.key} title={doc.path} onClick={() => { workspace.setActiveDocument(doc.key); setEditing(false) }} className={cn("flex h-[47px] max-w-52 items-center gap-2 pr-9 pl-3.5 font-code text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset", doc.key === document.key ? "text-foreground" : "text-subtle")}><WorkspaceIcon name={workspaceFileIcon(doc.path)} className="size-[13px]" /><span className="truncate">{doc.title}{doc.content !== doc.saved ? " •" : ""}</span></button>
        <Button variant="ghost" size="icon-xs" className={cn("absolute right-2.5 size-5 text-subtle", doc.key !== document.key && "opacity-0 group-hover/file:opacity-100 focus-visible:opacity-100")} aria-label={`Close ${doc.title}`} onClick={() => doc.content !== doc.saved ? setPendingClose(doc) : workspace.closeDocument(doc.key)}><XIcon className="size-3" /></Button>
      </div>)}
    </div>
    {editing && document.kind === "file" ? <textarea ref={textarea} aria-label={`Edit ${document.path}`} spellCheck={false} value={document.content} onChange={(e) => workspace.editDocument(document.key, e.target.value)} onKeyDown={(e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void save() }
      if (e.key === "Tab") { e.preventDefault(); const node = e.currentTarget, start = node.selectionStart, end = node.selectionEnd; workspace.editDocument(document.key, document.content.slice(0, start) + "  " + document.content.slice(end)); requestAnimationFrame(() => { node.selectionStart = node.selectionEnd = start + 2 }) }
    }} className="min-h-0 flex-1 resize-none overflow-auto bg-transparent px-4 py-3.5 font-code text-xs leading-[21px] outline-none" /> : <div tabIndex={0} aria-label={document.kind === "file" ? `Contents of ${document.path}` : `Diff for ${document.path}`} className="min-h-0 flex-1 overflow-auto py-3.5 font-code text-xs leading-[21px] text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring">
      {lines.map((line, index) => <div key={index} className={cn("flex min-w-0 pr-4", document.kind !== "file" && (line.startsWith("+") && !line.startsWith("+++") ? "bg-green-500/10 text-green-600 dark:text-green-300" : line.startsWith("-") && !line.startsWith("---") ? "bg-red-500/10 text-red-600 dark:text-red-300" : line.startsWith("@@") ? "bg-blue-500/10 text-blue-600 dark:text-blue-300" : ""))}>
        <span aria-hidden className="w-[47px] shrink-0 pr-4 text-right text-subtle/70 select-none">{index + 1}</span>
        <pre className="min-h-[21px] min-w-0 flex-1 whitespace-pre-wrap wrap-anywhere font-inherit">{tokens ? tokens[index]?.map((token, i) => <span key={i} className="code-token" style={token.htmlStyle as React.CSSProperties}>{token.content}</span>) : line}</pre>
      </div>)}
    </div>}
    <div className="flex h-7 shrink-0 items-center gap-1 border-t pr-1.5 pl-4 font-code text-[11px] text-subtle"><span className="min-w-0 flex-1 truncate">{document.path}</span>
      {/* Editing lives in the path bar, so the file sits directly under its tab as in the design. */}
      {document.kind === "file" && <>
        <Button variant="ghost" size="xs" className="h-5 font-sans text-[11px]" onClick={() => { setEditing((prev) => !prev); requestAnimationFrame(() => textarea.current?.focus()) }}>{editing ? "Preview" : "Edit"}</Button>
        {(editing || dirty) && <Button variant="secondary" size="xs" className="h-5 font-sans text-[11px]" disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : "Save"}</Button>}
      </>}
    </div>
    <ConfirmDialog open={Boolean(pendingClose)} title="Discard unsaved edits?" description={`Your changes to ${pendingClose?.path} have not been saved to disk.`} action="Discard edits" onConfirm={() => { if (pendingClose) workspace.closeDocument(pendingClose.key) }} onClose={() => setPendingClose(null)} />
  </section>
}
