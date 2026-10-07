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
  const { tabs, activeTab, runningTabs, agents, chats, projects, selectTab, closeTab, newChat } = state
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
                "group/tab flex h-8 max-w-52 min-w-28 shrink-0 items-center rounded-[10px] text-sm text-muted-foreground hover:bg-accent/60",
                active && "bg-accent font-medium text-foreground hover:bg-accent"
              )}
              // Middle click closes, as in a browser.
              onAuxClick={(e) => e.button === 1 && closeTab(tab.key)}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                title={[projectName, title].filter(Boolean).join(" › ")}
                className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-[10px] pr-1 pl-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => selectTab(tab.key)}
              >
                {runningTabs.includes(tab.key) ? (
                  <Spinner className="size-3 shrink-0" aria-label="Replying" />
                ) : (
                  <AgentIcon id={agent?.id} color={agent?.color} className="size-3" />
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
                className={cn("mr-1 shrink-0 opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100", active && "opacity-100")}
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
          <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="New tab" onClick={newChat}>
            <PlusIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>New tab (⌘T)</TooltipContent>
      </Tooltip>
    </div>
  )
}
