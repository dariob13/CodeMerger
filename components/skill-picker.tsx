"use client"

import * as React from "react"
import { BookOpenIcon, CheckIcon, RefreshCwIcon, SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroupButton } from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { AgentSkill } from "@/lib/types"

type Props = {
  skills: AgentSkill[]; selected: AgentSkill[]; loading: boolean; error: string; disabled: boolean
  open: boolean; onOpenChange(open: boolean): void; query: string; onQueryChange(query: string): void
  onSelect(skill: AgentSkill): void; onRefresh(): void; onClose(): void
}

export function SkillPicker({ skills, selected, loading, error, disabled, open, onOpenChange, query, onQueryChange, onSelect, onRefresh, onClose }: Props) {
  const [index, setIndex] = React.useState(0)
  const search = React.useRef<HTMLInputElement>(null)
  const list = React.useRef<HTMLDivElement>(null)
  const id = React.useId()
  const matches = skills.filter((skill) => `${skill.name} ${skill.description} ${skill.origin} ${skill.scope}`.toLowerCase().includes(query.toLowerCase().trim()))
  const position = Math.min(index, Math.max(0, matches.length - 1))
  const choose = (skill: AgentSkill) => { onSelect(skill); onOpenChange(false) }
  return <Popover open={open} onOpenChange={(next) => { setIndex(0); onOpenChange(next) }}>
    <PopoverTrigger asChild><InputGroupButton disabled={disabled} aria-label="Choose agent skills" className="gap-1.5 text-muted-foreground hover:text-foreground"><BookOpenIcon /><span className="hidden sm:inline">Skills</span></InputGroupButton></PopoverTrigger>
    <PopoverContent align="start" side="top" className="w-[min(360px,calc(100vw-2rem))] gap-0 overflow-hidden p-0" onOpenAutoFocus={(e) => { e.preventDefault(); search.current?.focus() }} onCloseAutoFocus={(e) => { e.preventDefault(); onClose() }}>
      <div className="flex items-center gap-2 border-b px-3 py-2.5"><SearchIcon className="size-3.5 text-subtle" /><input ref={search} role="combobox" aria-label="Search agent skills" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={matches.length ? `${id}-${matches[position].id}` : undefined} placeholder="Search skills…" value={query} onChange={(e) => { onQueryChange(e.target.value); setIndex(0) }} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-subtle" onKeyDown={(e) => {
        if ((e.key === "ArrowDown" || e.key === "ArrowUp") && matches.length) {
          e.preventDefault()
          const next = (position + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length
          setIndex(next); list.current?.querySelectorAll('[role="option"]')[next]?.scrollIntoView({ block: "nearest" })
        } else if (e.key === "Enter" && matches.length) { e.preventDefault(); choose(matches[position]) }
      }} /><Button variant="ghost" size="icon-xs" aria-label="Refresh skills" onClick={onRefresh}><RefreshCwIcon className="size-3.5" /></Button></div>
      <div ref={list} id={`${id}-list`} role="listbox" aria-label="Available agent skills" aria-multiselectable className="max-h-72 overflow-y-auto p-1">
        {matches.map((skill, i) => <button key={skill.id} id={`${id}-${skill.id}`} role="option" aria-selected={selected.some((s) => s.id === skill.id)} title={`${skill.origin} · ${skill.scope}\n${skill.path}`} className={cn("flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring", i === position && "bg-muted")} onMouseMove={() => setIndex(i)} onClick={() => choose(skill)}>
          <BookOpenIcon className="mt-0.5 size-3.5 shrink-0 text-subtle" /><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-[13px] font-medium">{skill.name}</span><span className="ml-auto shrink-0 text-[10px] text-subtle">{skill.scope}</span></span><span className="mt-0.5 block line-clamp-2 text-xs leading-4 text-muted-foreground">{skill.description}</span></span>{selected.some((s) => s.id === skill.id) && <CheckIcon className="mt-0.5 size-3.5 shrink-0" />}
        </button>)}
        {loading && <p role="status" className="px-3 py-5 text-xs text-subtle">Loading installed skills…</p>}
        {error && <p role="alert" className="px-3 py-4 text-xs text-destructive">{error} <button className="underline" onClick={onRefresh}>Retry</button></p>}
        {!loading && !error && !matches.length && <p className="px-3 py-5 text-xs text-subtle">{skills.length ? "No skills match your search." : "No skills installed. Add a SKILL.md under .agents/skills in your project or home folder."}</p>}
      </div>
      <div className="border-t px-3 py-2 text-[11px] text-subtle">Select up to 5 skills for your next message. Type / to browse.</div>
    </PopoverContent>
  </Popover>
}
