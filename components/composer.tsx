"use client"

import * as React from "react"
import { ArrowUpIcon, FileIcon, ImageIcon, PaperclipIcon, PlusIcon, SquareIcon, XIcon } from "lucide-react"
import { AgentPicker } from "@/components/agent-picker"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ChatsState } from "@/hooks/use-chats"
import { isImage, type Access, type Persona } from "@/lib/types"

const MAX_FILES = 20

type Option = [value: string, label: string]

// A file waiting to be sent, with an object URL to preview it if it is an image.
type Draft = { file: File; preview: string | null }

const release = (drafts: Draft[]) => drafts.forEach((d) => d.preview && URL.revokeObjectURL(d.preview))

function FileChip({ draft: { file, preview }, onRemove }: { draft: Draft; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="h-8 gap-1.5 pr-1 pl-1.5 text-foreground">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local object URL
        <img src={preview} alt="" className="size-5 rounded-sm object-cover" />
      ) : (
        <FileIcon />
      )}
      <span className="max-w-40 truncate">{file.name}</span>
      <InputGroupButton size="icon-xs" className="rounded-full" aria-label={`Remove ${file.name}`} onClick={onRemove}>
        <XIcon />
      </InputGroupButton>
    </Badge>
  )
}

// `active` is false for the composers of the tabs in the background, which keep their drafts.
export function Composer({ state, personas, active }: { state: ChatsState; personas: Persona[]; active: boolean }) {
  const { agent, pick, running, send, stop } = state
  const [text, setText] = React.useState("")
  const [files, setFiles] = React.useState<Draft[]>([])
  const [sending, setSending] = React.useState(false)
  const input = React.useRef<HTMLTextAreaElement>(null)
  const filePicker = React.useRef<HTMLInputElement>(null)
  const photoPicker = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (active) input.current?.focus()
  }, [active])

  // One of the user's own agents, while the CLI it runs on is the one selected.
  const persona = personas.find((p) => p.id === pick.persona && p.agent === agent?.id)
  const valid = (options: Option[] | undefined, value: string | undefined) => (options?.some(([v]) => v === value) ? value! : "")
  const model = valid(agent?.models, agent && pick.models[agent.id])
  const effort = valid(agent?.efforts, agent && pick.efforts[agent.id])
  const access: Access = agent?.access.includes(pick.access) ? pick.access : "read"
  const canSend = Boolean(agent) && !sending && (Boolean(text.trim()) || files.length > 0)

  const addFiles = (list: Iterable<File>) => {
    const room = MAX_FILES - files.length
    const added = [...list].slice(0, Math.max(room, 0)).map((file) => ({ file, preview: isImage(file) ? URL.createObjectURL(file) : null }))
    setFiles((prev) => [...prev, ...added])
  }
  const removeFile = (index: number) => {
    release([files[index]])
    setFiles((prev) => prev.filter((_, n) => n !== index))
  }

  const submit = async () => {
    if (!canSend || running) return
    const draft = { text, files }
    setText("")
    setFiles([])
    setSending(true)
    const sent = await send(draft.text.trim(), { model, effort, access, persona: persona?.id ?? "", files: draft.files.map((d) => d.file) })
    setSending(false)
    if (sent) release(draft.files)
    else {
      setText(draft.text)
      setFiles(draft.files)
    }
  }

  return (
    <div hidden={!active} className="mx-auto w-full max-w-3xl px-4 pt-2 pb-4">
      <input ref={filePicker} type="file" multiple hidden onChange={(e) => (addFiles(e.target.files || []), (e.target.value = ""))} />
      <input
        ref={photoPicker}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        hidden
        onChange={(e) => (addFiles(e.target.files || []), (e.target.value = ""))}
      />

      <InputGroup
        // A raised surface whose edge brightens while typing.
        className="rounded-2xl bg-card p-1 transition-colors has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:bg-card"
        onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return
          e.preventDefault()
          addFiles(e.dataTransfer.files)
        }}
      >
        {files.length > 0 && (
          <InputGroupAddon align="block-start" className="flex-wrap text-foreground">
            {files.map((draft, i) => (
              <FileChip key={`${draft.file.name}-${draft.file.lastModified}-${i}`} draft={draft} onRemove={() => removeFile(i)} />
            ))}
          </InputGroupAddon>
        )}

        <InputGroupTextarea
          ref={input}
          value={text}
          rows={1}
          readOnly={!agent}
          aria-label="Message"
          placeholder={agent ? `Message ${persona?.name ?? agent.name}…` : "Connect an agent to start chatting"}
          className="max-h-60 min-h-12 px-4 pt-3.5 text-[15px] md:text-[15px]"
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            if (!e.clipboardData.files.length) return
            e.preventDefault()
            addFiles(e.clipboardData.files)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
        />

        <InputGroupAddon align="block-end" className="text-foreground">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <InputGroupButton variant="outline" size="icon-sm" className="bg-transparent" aria-label="Add files or photos">
                    <PlusIcon />
                  </InputGroupButton>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Add files or photos</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" side="top" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => filePicker.current?.click()}>
                  <PaperclipIcon />
                  Add files
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => photoPicker.current?.click()}>
                  <ImageIcon />
                  Add photos
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <AgentPicker state={state} personas={personas} persona={persona} model={model} effort={effort} access={access} />

          <Tooltip>
            <TooltipTrigger asChild>
              {running ? (
                <InputGroupButton variant="default" size="icon-sm" className="ml-auto" aria-label="Stop" onClick={stop}>
                  <SquareIcon className="fill-current" />
                </InputGroupButton>
              ) : (
                <InputGroupButton
                  variant="default"
                  size="icon-sm"
                  aria-label="Send"
                  // aria-disabled, because a disabled control would dim the whole input group
                  aria-disabled={!canSend}
                  className="ml-auto aria-disabled:cursor-default aria-disabled:opacity-40"
                  onClick={submit}
                >
                  <ArrowUpIcon />
                </InputGroupButton>
              )}
            </TooltipTrigger>
            <TooltipContent>{running ? "Stop" : "Send"}</TooltipContent>
          </Tooltip>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
