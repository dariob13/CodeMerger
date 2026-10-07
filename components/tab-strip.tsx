"use client"

import * as React from "react"
import { PlusIcon, XIcon } from "lucide-react"
import { AgentIcon } from "@/components/agent-icon"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ChatsState } from "@/hooks/use-chats"
import { cn } from "@/lib/utils"

// The open chats, one tab each. A reply keeps going in its tab while another one is being looked at.
export function TabStrip({ state }: { state: ChatsState }) {
  const { activeTab, runningTabs, agents, chats, projects, selectTab, closeTab, newChat } = state
  const tabs = state.tabs.filter((t) => !t.personaId) // the chats with the user's own agents open from the sidebar
  const current = React.useRef<HTMLDivElement>(null)
  // With tabs from more than one project open, each says which project it is in.
  const mixed = new Set(tabs.map((t) => t.projectId)).size > 1

  React.useEffect(() => {
    current.current?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [activeTab.key])

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <div role="tablist" aria-label="Open chats" className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        {tabs.map((tab) => {
          const summary = chats.find((c) => c.id === tab.chatId)
          const agent = agents.find((a) => a.id === summary?.lastAgent)
          const title = summary?.title || "New chat"
          const projectName = projects.find((p) => p.id === tab.projectId)?.name
          const active = tab.key === activeTab.key
          return (
            <div
              key={tab.key}
              ref={active ? current : undefined}
              className={cn(
                "group/tab flex h-8 max-w-64 min-w-28 shrink-0 items-center rounded-[10px] text-[13px] tracking-[-0.6px] text-subtle hover:bg-muted/60",
                active && "bg-muted font-medium text-foreground hover:bg-muted"
              )}
              // Middle click closes, as in a browser.
              onAuxClick={(e) => e.button === 1 && closeTab(tab.key)}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                title={[projectName, title].filter(Boolean).join(" › ")}
                className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-[10px] pr-1.5 pl-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => selectTab(tab.key)}
              >
                {runningTabs.includes(tab.key) ? (
                  <Spinner className="size-[13px] shrink-0" aria-label="Replying" />
                ) : (
                  <AgentIcon id={agent?.id} color={agent?.color} className="size-[13px]" />
                )}
                <span className="truncate">
                  {mixed && projectName && <span className="font-normal text-subtle">{projectName} · </span>}
                  {title}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Close tab ${title}`}
                className={cn("mr-1.5 size-5 shrink-0 text-subtle opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100 [&_svg]:size-3", active && "opacity-100", !active && "-ml-6")}
                onClick={() => closeTab(tab.key)}
              >
                <XIcon />
              </Button>
            </div>
          )
        })}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="shrink-0 lg:hidden" aria-label="New tab" onClick={newChat}>
            <PlusIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>New tab (⌘T)</TooltipContent>
      </Tooltip>
    </div>
  )
}
