"use client"

import * as React from "react"
import { CopyIcon, RefreshCwIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { ACCESS } from "@/components/agent-picker"
import { AgentIcon } from "@/components/agent-icon"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { ChatsState } from "@/hooks/use-chats"
import { updateSettings, useSettings } from "@/hooks/use-settings"
import { agentStatus } from "@/lib/agent-status"
import type { Access } from "@/lib/types"
import { cn } from "@/lib/utils"
import pkg from "@/package.json"

const SECTIONS = ["General", "Appearance", "Agents", "Chat", "Shortcuts", "Data", "About"] as const
const anchor = (section: string) => `settings-${section.toLowerCase()}`

function Section({ title, description, action, children }: { title: (typeof SECTIONS)[number]; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={anchor(title)} aria-labelledby={`${anchor(title)}-title`} className="grid scroll-mt-8 gap-3">
      <div className="flex items-end gap-3">
        <div className="grid flex-1 gap-1">
          <h2 id={`${anchor(title)}-title`} className="text-base font-medium tracking-tight">{title}</h2>
          {description && <p className="text-xs text-subtle">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

const Card = ({ children }: { children: React.ReactNode }) => <div className="overflow-hidden rounded-xl border bg-card">{children}</div>

function Row({ label, hint, mono, children }: { label: React.ReactNode; hint?: React.ReactNode; mono?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-13 items-center gap-6 px-4 py-3 not-first:border-t">
      <div className="grid min-w-0 flex-1 gap-0.5">
        <div className="flex items-center gap-2 text-sm">{label}</div>
        {hint && <p className={cn("text-xs wrap-anywhere text-subtle", mono && "font-mono")}>{hint}</p>}
      </div>
      {children}
    </div>
  )
}

// A few options side by side, one of them chosen.
function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (value: T) => void }) {
  return (
    <ToggleGroup type="single" variant="outline" size="sm" spacing={0} aria-label={label} value={value} onValueChange={(next) => next && onChange(next as T)}>
      {options.map(([option, name]) => (
        <ToggleGroupItem key={option} value={option} className="px-3 font-normal text-muted-foreground data-[state=on]:bg-foreground/10 data-[state=on]:font-medium data-[state=on]:text-foreground">
          {name}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

const UNSET = "default" // the select can't hold the empty value an agent's own default goes by

function Pick({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return (
    <Select value={value || UNSET} onValueChange={(next) => onChange(next === UNSET ? "" : next)}>
      <SelectTrigger size="sm" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map(([option, name]) => (
          <SelectItem key={option} value={option || UNSET}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Command({ label, command }: { label: string; command: string }) {
  return (
    <Row label={label} hint={command} mono>
      <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(command).then(() => toast.success("Copied"))}>
        <CopyIcon data-icon="inline-start" />
        Copy
      </Button>
    </Row>
  )
}

const Keys = ({ keys }: { keys: string[] }) => (
  <span className="flex gap-1">
    {keys.map((key) => (
      <kbd key={key} className="rounded-md border bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{key}</kbd>
    ))}
  </span>
)

export function SettingsView({ state }: { state: ChatsState }) {
  const settings = useSettings()
  const { theme, setTheme } = useTheme()
  const [active, setActive] = React.useState<string>(SECTIONS[0])
  const [checking, setChecking] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const canNotify = typeof Notification !== "undefined"
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"

  // The section list follows the section at the top of the page.
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.find((entry) => entry.isIntersecting)
        if (top) setActive(top.target.id)
      },
      { rootMargin: "0px 0px -70% 0px" }
    )
    SECTIONS.forEach((section) => observer.observe(document.getElementById(anchor(section))!))
    return () => observer.disconnect()
  }, [])

  const setNotify = async (on: boolean) => {
    if (on && Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") {
      return void toast.error("Notifications are blocked for Code Merger. Allow them in your browser or system settings first.")
    }
    updateSettings({ notify: on })
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto flex w-full max-w-4xl items-start gap-14 px-4 py-8 md:px-10">
        <nav aria-label="Settings sections" className="sticky top-8 hidden w-44 shrink-0 gap-0.5 md:grid">
          {SECTIONS.map((section) => (
            <Button
              key={section}
              variant="ghost"
              size="sm"
              aria-current={active === anchor(section) || undefined}
              className="justify-start font-normal text-muted-foreground aria-[current]:bg-accent aria-[current]:font-medium aria-[current]:text-foreground"
              onClick={() => document.getElementById(anchor(section))?.scrollIntoView({ behavior: settings.reduceMotion ? "auto" : "smooth" })}
            >
              {section}
            </Button>
          ))}
        </nav>

        <div className="grid min-w-0 flex-1 gap-10">
          <Section title="General">
            <Card>
              <Row label="Projects folder" hint={state.projectsRoot} mono />
              <Row
                label="Notify me when a reply finishes"
                hint={canNotify ? "Only while Code Merger is not the window in front." : "Notifications are not available in this window."}
              >
                <Switch aria-label="Notify me when a reply finishes" disabled={!canNotify} checked={canNotify && settings.notify} onCheckedChange={setNotify} />
              </Row>
              <Row label="Send message with" hint={settings.sendWith === "enter" ? "Shift Enter starts a new line." : "Enter starts a new line."}>
                <Choice label="Send message with" value={settings.sendWith} options={[["enter", "Enter"], ["mod-enter", `${mod} Enter`]]} onChange={(sendWith) => updateSettings({ sendWith })} />
              </Row>
            </Card>
          </Section>

          <Section title="Appearance">
            <Card>
              <Row label="Theme" hint="System follows your computer’s light or dark setting.">
                <Choice label="Theme" value={theme ?? "dark"} options={[["system", "System"], ["light", "Light"], ["dark", "Dark"]]} onChange={setTheme} />
              </Row>
              <Row label="Chat text size">
                <Choice label="Chat text size" value={settings.textSize} options={[["small", "Small"], ["default", "Default"], ["large", "Large"]]} onChange={(textSize) => updateSettings({ textSize })} />
              </Row>
              <Row label="Reduce motion" hint="Stops spinners, fades and other animations.">
                <Switch aria-label="Reduce motion" checked={settings.reduceMotion} onCheckedChange={(reduceMotion) => updateSettings({ reduceMotion })} />
              </Row>
            </Card>
          </Section>

          <Section
            title="Agents"
            description="Code Merger runs the agent CLIs installed on this computer. Each one signs in through its own CLI."
            action={
              <Button
                variant="outline"
                size="sm"
                disabled={checking}
                onClick={async () => {
                  setChecking(true)
                  await state.recheck()
                  setChecking(false)
                }}
              >
                {checking ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
                Check again
              </Button>
            }
          >
            <Card>
              <Row label="Access in new chats" hint={ACCESS[settings.access].hint}>
                <Pick label="Access in new chats" value={settings.access} options={Object.entries(ACCESS).map(([level, { label }]) => [level, label])} onChange={(access) => updateSettings({ access: access as Access })} />
              </Row>
            </Card>
            {state.agents.map((agent) => (
              <Card key={agent.id}>
                <Row
                  label={
                    <>
                      <AgentIcon id={agent.id} color={agent.color} className="size-3.5" />
                      <span className="font-medium">{agent.name}</span>
                      {agent.version && <span className="text-xs text-subtle">{agent.version}</span>}
                    </>
                  }
                  hint={agent.authDetail}
                >
                  <span className={cn("text-xs", agent.auth === "none" && agent.connected ? "text-destructive" : agent.connected ? "text-muted-foreground" : "text-subtle")}>{agentStatus(agent)}</span>
                </Row>
                {!agent.connected && agent.install && <Command label="Install it with" command={agent.install} />}
                {agent.connected && agent.auth === "none" && agent.login && <Command label="Sign in with" command={agent.login} />}
                {agent.connected && agent.models.length > 1 && (
                  <Row label="Model in new chats">
                    <Pick label={`${agent.name} model in new chats`} value={settings.models[agent.id] ?? agent.models[0][0]} options={agent.models} onChange={(model) => updateSettings({ models: { ...settings.models, [agent.id]: model } })} />
                  </Row>
                )}
                {agent.connected && agent.efforts.length > 1 && (
                  <Row label="Effort in new chats">
                    <Pick label={`${agent.name} effort in new chats`} value={settings.efforts[agent.id] ?? agent.efforts[0][0]} options={agent.efforts} onChange={(effort) => updateSettings({ efforts: { ...settings.efforts, [agent.id]: effort } })} />
                  </Row>
                )}
              </Card>
            ))}
          </Section>

          <Section title="Chat">
            <Card>
              <Row label="Keep command lists closed" hint="The commands an agent runs fold into one row you can open. Turn this off to show them opened.">
                <Switch aria-label="Keep command lists closed" checked={settings.foldCommands} onCheckedChange={(foldCommands) => updateSettings({ foldCommands })} />
              </Row>
            </Card>
          </Section>

          <Section title="Shortcuts">
            <Card>
              <Row label="New tab"><Keys keys={[mod, "T"]} /></Row>
              <Row label="Show or hide the sidebar"><Keys keys={[mod, "B"]} /></Row>
              <Row label="Open settings"><Keys keys={[mod, ","]} /></Row>
              <Row label="Send message"><Keys keys={settings.sendWith === "enter" ? ["Enter"] : [mod, "Enter"]} /></Row>
              <Row label="New line in a message"><Keys keys={settings.sendWith === "enter" ? ["Shift", "Enter"] : ["Enter"]} /></Row>
            </Card>
          </Section>

          <Section title="Data" description="Chats, notes and automations are stored on this computer.">
            <Card>
              <Row
                label={<span className="text-destructive">Delete all chats</span>}
                hint={`Removes ${state.chats.length === 1 ? "the 1 chat" : `all ${state.chats.length} chats`} from Code Merger. Files the agents created stay where they are.`}
              >
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={!state.chats.length} onClick={() => setDeleting(true)}>
                  Delete…
                </Button>
              </Row>
            </Card>
          </Section>

          <Section title="About">
            <Card>
              <Row label={<>Code Merger <span className="text-xs text-subtle">{pkg.version}</span></>} hint="One chat for all your coding agents." />
            </Card>
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={deleting}
        title="Delete all chats?"
        description={`${state.chats.length === 1 ? "The 1 chat" : `All ${state.chats.length} chats`} in every project will be removed from Code Merger. This can’t be undone. Files the agents created stay where they are.`}
        action="Delete all chats"
        onConfirm={async () => {
          for (const chat of state.chats) await state.deleteChat(chat.id)
        }}
        onClose={() => setDeleting(false)}
      />
    </ScrollArea>
  )
}
