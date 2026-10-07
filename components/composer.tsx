"use client"

import * as React from "react"
import { ArrowUpIcon, BookOpenIcon, FileIcon, GitBranchIcon, ImageIcon, PaperclipIcon, PlusIcon, SquareIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { AgentPicker } from "@/components/agent-picker"
import { SkillPicker } from "@/components/skill-picker"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSettings } from "@/hooks/use-settings"
import { cn } from "@/lib/utils"
import type { ChatsState } from "@/hooks/use-chats"
import { useSkills } from "@/hooks/use-skills"
import { isImage, type Access, type AgentSkill, type Persona } from "@/lib/types"

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
// `persona` is set in the chat with one of the user's own agents: it answers there, on the CLI it runs on.
export function Composer({ state, persona, active, branch }: { state: ChatsState; persona?: Persona; active: boolean; branch?: string }) {
  const { pick, running, send, stop } = state
  const agent = persona ? (state.connected.find((a) => a.id === persona.agent) ?? null) : state.agent
  const [text, setText] = React.useState("")
  const [files, setFiles] = React.useState<Draft[]>([])
  const [sending, setSending] = React.useState(false)
  const catalog = useSkills(state.project?.id, agent?.id, active)
  const [selectedByContext, setSelectedByContext] = React.useState<Record<string, AgentSkill[]>>({})
  const selectedSkills = selectedByContext[catalog.key] || []
  const [skillsOpen, setSkillsOpen] = React.useState(false)
  const [skillQuery, setSkillQuery] = React.useState("")
  const input = React.useRef<HTMLTextAreaElement>(null)
  const filePicker = React.useRef<HTMLInputElement>(null)
  const photoPicker = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (active) input.current?.focus()
  }, [active])

  const valid = (options: Option[] | undefined, value: string | undefined) => (options?.some(([v]) => v === value) ? value! : "")
  const { sendWith } = useSettings()
  const model = valid(agent?.models, agent ? pick.models[agent.id] : undefined)
  const effort = valid(agent?.efforts, agent ? pick.efforts[agent.id] : undefined)
  const access: Access = agent?.access.includes(pick.access) ? pick.access : "read"
  const canSend = Boolean(agent) && !sending && (Boolean(text.trim()) || files.length > 0 || selectedSkills.length > 0)
  const removeSkill = (id: string) => setSelectedByContext((prev) => ({ ...prev, [catalog.key]: (prev[catalog.key] || []).filter((skill) => skill.id !== id) }))
  const selectSkill = (skill: AgentSkill) => {
    setText((prev) => /^\/[\w:-]*$/.test(prev.trim()) ? "" : prev)
    if (selectedSkills.some((s) => s.id === skill.id)) { removeSkill(skill.id); return }
    if (selectedSkills.length >= 5) { toast.error("Select up to 5 skills per message"); return }
    setSelectedByContext((prev) => ({ ...prev, [catalog.key]: [...(prev[catalog.key] || []), skill] }))
  }

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
    if (!canSend || running || !agent) return
    const draft = { text, files, skills: selectedSkills, skillKey: catalog.key }
    setText("")
    setFiles([])
    setSelectedByContext((prev) => ({ ...prev, [draft.skillKey]: [] }))
    setSending(true)
    const sent = await send(draft.text.trim(), { agent: agent.id, model, effort, access, files: draft.files.map((d) => d.file), skills: draft.skills.map((s) => s.id) })
    setSending(false)
    if (sent) release(draft.files)
    else {
      setText(draft.text)
      setFiles(draft.files)
      setSelectedByContext((prev) => ({ ...prev, [draft.skillKey]: [...draft.skills, ...(prev[draft.skillKey] || []).filter((s) => !draft.skills.some((old) => old.id === s.id))] }))
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
        className="rounded-[14px] bg-card p-1 transition-colors has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:bg-card"
        onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return
          e.preventDefault()
          addFiles(e.dataTransfer.files)
        }}
      >
        {(files.length > 0 || selectedSkills.length > 0) && (
          <InputGroupAddon align="block-start" className="flex-wrap text-foreground">
            {selectedSkills.map((skill) => <Badge key={skill.id} variant="secondary" title={`${skill.origin} · ${skill.path}`} className="h-8 gap-1.5 pr-1 pl-2 text-foreground"><BookOpenIcon /><span className="max-w-48 truncate">{skill.name}</span><InputGroupButton size="icon-xs" className="rounded-full" aria-label={`Remove skill ${skill.name}`} onClick={() => removeSkill(skill.id)}><XIcon /></InputGroupButton></Badge>)}
            {files.map((draft, i) => (
              <FileChip key={`${draft.file.name}-${draft.file.lastModified}-${i}`} draft={draft} onRemove={() => removeFile(i)} />
            ))}
          </InputGroupAddon>
        )}

        {branch && (
          <InputGroupAddon align="block-start" className="gap-1.5 px-3.5 pt-2.5 pb-0 font-code text-xs font-normal text-subtle">
            <GitBranchIcon className="size-3!" aria-hidden />
            {branch}
          </InputGroupAddon>
        )}

        <InputGroupTextarea
          ref={input}
          value={text}
          rows={1}
          readOnly={!agent}
          aria-label="Message"
          placeholder={agent ? `Message ${persona?.name ?? agent.name}…` : persona ? `The agent ${persona.name} runs on is not connected` : "Connect an agent to start chatting"}
          className={cn("max-h-60 min-h-12 px-3.5 text-[15px] leading-[22px] md:text-[15px]", branch ? "pt-2" : "pt-3.5")}
          onChange={(e) => {
            setText(e.target.value)
            const slash = /^\/([\w:-]*)$/.exec(e.target.value)
            if (slash && agent) { setSkillQuery(slash[1]); setSkillsOpen(true); void catalog.refresh() }
          }}
          onPaste={(e) => {
            if (!e.clipboardData.files.length) return
            e.preventDefault()
            addFiles(e.clipboardData.files)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && (sendWith === "enter" || e.metaKey || e.ctrlKey)) {
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
                  <InputGroupButton variant="outline" size="icon-sm" className="h-[30px] w-[34px] rounded-[10px] bg-secondary dark:bg-secondary" aria-label="Add files or photos">
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

          <AgentPicker state={state} agent={agent} locked={Boolean(persona)} model={model} effort={effort} access={access} />
          <SkillPicker skills={catalog.skills} selected={selectedSkills} loading={catalog.loading} error={catalog.error} disabled={!agent} open={active && skillsOpen} onOpenChange={(open) => { setSkillsOpen(open); if (open) { setSkillQuery(""); void catalog.refresh() } }} query={skillQuery} onQueryChange={setSkillQuery} onSelect={selectSkill} onRefresh={catalog.refresh} onClose={() => { if (active) input.current?.focus() }} />

          <Tooltip>
            <TooltipTrigger asChild>
              {running ? (
                <InputGroupButton variant="default" size="icon-sm" className="ml-auto h-[30px] rounded-[10px]" aria-label="Stop" onClick={stop}>
                  <SquareIcon className="fill-current" />
                </InputGroupButton>
              ) : (
                <InputGroupButton
                  variant="default"
                  size="icon-sm"
                  aria-label="Send"
                  // aria-disabled, because a disabled control would dim the whole input group
                  aria-disabled={!canSend}
                  className="ml-auto h-[30px] rounded-[10px] aria-disabled:cursor-default aria-disabled:opacity-40"
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
