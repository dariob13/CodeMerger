"use client"

import * as React from "react"
import { ArrowUpIcon, ChevronDownIcon, FileIcon, ImageIcon, PaperclipIcon, PlusIcon, ShieldAlertIcon, SquareIcon, XIcon } from "lucide-react"
import { AgentIcon } from "@/components/agent-icon"
import { AgentMark } from "@/components/agent-mark"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ChatsState } from "@/hooks/use-chats"
import { agentStatus } from "@/lib/agent-status"
import { isImage, type Access, type Persona } from "@/lib/types"

const ACCESS: Record<Access, { label: string; hint: string }> = {
  read: { label: "Read-only", hint: "Reads the folder and answers" },
  edit: { label: "Can edit files", hint: "Creates and edits files in the folder" },
  full: { label: "Full access", hint: "Edits and runs commands without asking" },
}
const DEFAULT = "default" // menu items can't have an empty value
const MAX_FILES = 20

type Option = [value: string, label: string]

// A submenu with one choice out of a list, showing the current choice on its row.
function ChoiceMenu({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (value: string) => void }) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        {label}
        <span className="ml-auto pl-6 text-muted-foreground">{options.find(([v]) => v === value)?.[1]}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
        <DropdownMenuRadioGroup value={value || DEFAULT} onValueChange={(next) => onChange(next === DEFAULT ? "" : next)}>
          {options.map(([v, text]) => (
            <DropdownMenuRadioItem key={v} value={v || DEFAULT}>
              {text}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

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

export function Composer({ state, personas }: { state: ChatsState; personas: Persona[] }) {
  const { agents, agent, pick, running, setPick, send, stop } = state
  const [text, setText] = React.useState("")
  const [files, setFiles] = React.useState<Draft[]>([])
  const [sending, setSending] = React.useState(false)
  const input = React.useRef<HTMLTextAreaElement>(null)
  const filePicker = React.useRef<HTMLInputElement>(null)
  const photoPicker = React.useRef<HTMLInputElement>(null)

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

  // "Claude · Opus · High": only the choices that differ from the agent's defaults.
  const summary = agent
    ? [persona?.name ?? agent.short, model && agent.models.find(([v]) => v === model)?.[1], effort && agent.efforts.find(([v]) => v === effort)?.[1]]
        .filter(Boolean)
        .join(" · ")
    : "No agent"

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-2 pb-4">
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
          autoFocus
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <InputGroupButton variant="ghost" size="sm" aria-label={`Agent, model and effort: ${summary}`}>
                {persona ? <AgentMark name={persona.name} className="size-3.5" /> : agent && <AgentIcon id={agent.id} color={agent.color} />}
                {summary}
                {access === "full" && <ShieldAlertIcon className="text-destructive" aria-label="Full access" />}
                <ChevronDownIcon className="text-muted-foreground" />
              </InputGroupButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-72">
              {personas.length > 0 && (
                <>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Your agents</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={persona?.id ?? ""}
                      onValueChange={(id) => {
                        const next = personas.find((p) => p.id === id)
                        if (next) setPick({ persona: next.id, agent: next.agent })
                      }}
                    >
                      {personas.map((p) => {
                        const engine = agents.find((a) => a.id === p.agent)
                        return (
                          <DropdownMenuRadioItem key={p.id} value={p.id} disabled={!engine?.connected} onSelect={(e) => e.preventDefault()}>
                            <AgentMark name={p.name} className="size-3.5" />
                            {p.name}
                            <span className="ml-auto pl-4 text-xs text-muted-foreground">on {engine?.short || p.agent}</span>
                          </DropdownMenuRadioItem>
                        )
                      })}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuGroup>
                <DropdownMenuLabel>{personas.length ? "Coding agents" : "Agent"}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={persona ? "" : agent?.id} onValueChange={(id) => setPick({ agent: id, persona: "" })}>
                  {agents.map((a) => (
                    // Stays open, so the model and effort can be set right after picking the agent.
                    <DropdownMenuRadioItem key={a.id} value={a.id} disabled={!a.connected} onSelect={(e) => e.preventDefault()}>
                      <AgentIcon id={a.id} color={a.connected ? a.color : undefined} />
                      {a.name}
                      <span className={`ml-auto pl-4 text-xs ${a.auth === "none" ? "text-destructive" : "text-muted-foreground"}`}>
                        {[agentStatus(a), a.authDetail].filter(Boolean).join(" · ")}
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>

              {agent && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {agent.models.length > 1 && (
                      <ChoiceMenu
                        label="Model"
                        value={model}
                        options={agent.models}
                        onChange={(value) => setPick({ models: { ...pick.models, [agent.id]: value } })}
                      />
                    )}
                    {agent.efforts.length > 1 && (
                      <ChoiceMenu
                        label="Effort"
                        value={effort}
                        options={agent.efforts}
                        onChange={(value) => setPick({ efforts: { ...pick.efforts, [agent.id]: value } })}
                      />
                    )}
                    <ChoiceMenu
                      label="Permissions"
                      value={access}
                      options={agent.access.map((level) => [level, ACCESS[level].label])}
                      onChange={(value) => setPick({ access: value as Access })}
                    />
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <p className="px-1.5 py-1 text-xs text-muted-foreground">
                    {agent.name}: {ACCESS[access].hint.toLowerCase()}.
                  </p>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

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
