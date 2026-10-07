"use client"

import * as React from "react"
import { FolderOpenIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { api } from "@/lib/api"

type FormProps = {
  root: string // where project folders are created by default
  onCreate: (name: string, cwd: string) => Promise<string | null>
  onCancel?: () => void
}

const folderName = (name: string) => name.trim().replace(/[/\\:*?"<>|]/g, "-")

// Name a project and choose its folder. The folder follows the name until it is edited by hand.
export function ProjectForm({ root, onCreate, onCancel }: FormProps) {
  const [name, setName] = React.useState("")
  const [custom, setCustom] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [choosing, setChoosing] = React.useState(false)
  const cwd = custom ?? (name.trim() ? `${root}/${folderName(name)}` : "")

  // Opens the system's folder chooser, where an existing folder can be picked or a new one made.
  const choose = async () => {
    setChoosing(true)
    try {
      const { path } = await api<{ path: string | null }>("pick-folder", { method: "POST", body: { start: cwd || root } })
      if (path) {
        setCustom(path)
        setError(null)
        // A project with no name yet takes the folder's.
        if (!name.trim()) setName(path.split(/[/\\]/).filter(Boolean).pop()?.slice(0, 60) ?? "")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setChoosing(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const problem = await onCreate(name.trim(), cwd)
    setSaving(false)
    setError(problem)
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="project-name">Project name</Label>
        <Input id="project-name" value={name} maxLength={60} autoFocus autoComplete="off" placeholder="My app" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="project-folder">Folder</Label>
        <InputGroup>
          <InputGroupInput
            id="project-folder"
            value={cwd}
            spellCheck={false}
            autoComplete="off"
            placeholder={`${root}/My app`}
            className="font-mono"
            aria-describedby="project-folder-help"
            aria-invalid={Boolean(error)}
            onChange={(e) => setCustom(e.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" aria-label="Choose a folder" title="Choose a folder" disabled={choosing} onClick={choose}>
              {choosing ? <Spinner /> : <FolderOpenIcon />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p id="project-folder-help" className="text-sm text-muted-foreground">
          Created if it doesn&apos;t exist. To work on code you already have, enter that folder&apos;s path or choose it with the folder button.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={saving || !name.trim() || !cwd.trim()}>
          Create project
        </Button>
      </div>
    </form>
  )
}

type DialogProps = FormProps & { open: boolean; onClose: () => void }

export function ProjectDialog({ open, onClose, onCreate, root }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>A project is a folder on your computer. Every agent you chat with in it works in that folder.</DialogDescription>
        </DialogHeader>
        {open && (
          <ProjectForm
            root={root}
            onCancel={onClose}
            onCreate={async (name, cwd) => {
              const problem = await onCreate(name, cwd)
              if (!problem) onClose()
              return problem
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
