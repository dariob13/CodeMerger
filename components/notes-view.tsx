"use client"

import * as React from "react"
import { ArrowLeftIcon, NotebookPenIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { relativeTime } from "@/lib/format"
import type { Note } from "@/lib/types"
import { cn } from "@/lib/utils"

const SAVE_DELAY = 600
const fail = (err: unknown) => toast.error(err instanceof Error ? err.message : String(err))

export function NotesView() {
  const [notes, setNotes] = React.useState<Note[] | null>(null)
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState<Note | null>(null)
  const [saved, setSaved] = React.useState(true)
  const pending = React.useRef<{ id: string; timer: ReturnType<typeof setTimeout>; change: Partial<Note> } | null>(null)
  const note = notes?.find((n) => n.id === openId) || null

  React.useEffect(() => {
    api<{ notes: Note[] }>("notes")
      .then(({ notes }) => setNotes(notes))
      .catch((err) => (fail(err), setNotes([])))
  }, [])

  // Sends the edits waiting to be saved. Called after a pause in typing, and before leaving a note.
  const flush = React.useCallback(async () => {
    const waiting = pending.current
    if (!waiting) return
    pending.current = null
    clearTimeout(waiting.timer)
    try {
      await api(`notes/${waiting.id}`, { method: "PATCH", body: waiting.change })
      if (!pending.current) setSaved(true)
    } catch (err) {
      fail(err)
    }
  }, [])
  React.useEffect(() => () => void flush(), [flush])

  const edit = (change: Partial<Pick<Note, "title" | "body">>) => {
    if (!note) return
    setNotes((prev) => prev!.map((n) => (n.id === note.id ? { ...n, ...change, updatedAt: Date.now() } : n)))
    setSaved(false)
    if (pending.current) clearTimeout(pending.current.timer)
    pending.current = { id: note.id, change: { ...pending.current?.change, ...change }, timer: setTimeout(flush, SAVE_DELAY) }
  }

  const open = async (id: string | null) => {
    await flush()
    setOpenId(id)
  }

  const create = async () => {
    try {
      await flush()
      const { note } = await api<{ note: Note }>("notes", { method: "POST" })
      setNotes((prev) => [note, ...(prev || [])])
      setOpenId(note.id)
    } catch (err) {
      fail(err)
    }
  }

  const remove = async (target: Note) => {
    try {
      if (pending.current?.id === target.id) {
        clearTimeout(pending.current.timer)
        pending.current = null
      }
      await api(`notes/${target.id}`, { method: "DELETE" })
      setNotes((prev) => prev!.filter((n) => n.id !== target.id))
      if (openId === target.id) setOpenId(null)
    } catch (err) {
      fail(err)
    }
  }

  if (notes && !notes.length) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <NotebookPenIcon />
          </EmptyMedia>
          <EmptyTitle>No notes yet</EmptyTitle>
          <EmptyDescription>Keep prompts, plans and things to remember next to your chats.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={create}>
            <PlusIcon data-icon="inline-start" />
            New note
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const sorted = [...(notes || [])].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
      <div className={cn("glass min-h-0 w-full flex-col rounded-2xl md:flex md:w-72", note ? "hidden" : "flex")}>
        <div className="p-2">
          <Button variant="outline" className="w-full" onClick={create}>
            <PlusIcon data-icon="inline-start" />
            New note
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <ItemGroup className="gap-1 px-2 pb-2">
            {sorted.map((n) => (
              <Item key={n.id} size="xs" variant={n.id === openId ? "muted" : "default"} asChild>
                <button type="button" className="text-left" onClick={() => open(n.id)}>
                  <ItemContent>
                    <ItemTitle className="line-clamp-1">{n.title.trim() || "Untitled note"}</ItemTitle>
                    <ItemDescription className="line-clamp-1">
                      {relativeTime(n.updatedAt)}
                      {n.body.trim() && ` · ${n.body.trim().split("\n")[0]}`}
                    </ItemDescription>
                  </ItemContent>
                </button>
              </Item>
            ))}
          </ItemGroup>
        </ScrollArea>
      </div>

      {note ? (
        <div className="glass flex min-h-0 min-w-0 flex-1 flex-col gap-2 rounded-2xl p-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Back to notes" onClick={() => open(null)}>
              <ArrowLeftIcon />
            </Button>
            <Input
              value={note.title}
              placeholder="Untitled note"
              aria-label="Note title"
              className="h-10 border-transparent bg-transparent text-lg font-semibold shadow-none md:text-lg dark:bg-transparent"
              onChange={(e) => edit({ title: e.target.value })}
            />
            <span className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
              {saved ? "Saved" : "Saving…"}
            </span>
            <Button variant="ghost" size="icon-sm" aria-label="Delete note" onClick={() => setDeleting(note)}>
              <Trash2Icon />
            </Button>
          </div>
          <Textarea
            key={note.id}
            value={note.body}
            autoFocus={!note.body}
            placeholder="Start writing…"
            aria-label="Note"
            className="min-h-0 flex-1 resize-none border-transparent bg-transparent text-[15px] leading-7 shadow-none [field-sizing:fixed] focus-visible:border-transparent focus-visible:ring-0 md:text-[15px] dark:bg-transparent"
            onChange={(e) => edit({ body: e.target.value })}
          />
        </div>
      ) : (
        <div className="glass hidden flex-1 items-center justify-center rounded-2xl text-sm text-muted-foreground md:flex">Select a note, or create a new one.</div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this note?"
        description={`“${deleting?.title.trim() || "Untitled note"}” will be deleted. This can't be undone.`}
        action="Delete note"
        onConfirm={() => deleting && remove(deleting)}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
