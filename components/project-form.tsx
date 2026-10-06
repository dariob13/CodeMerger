"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
  const cwd = custom ?? (name.trim() ? `${root}/${folderName(name)}` : "")

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
        <Input
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
        <p id="project-folder-help" className="text-sm text-muted-foreground">
          Created if it doesn&apos;t exist. To work on code you already have, enter that folder&apos;s path.
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
