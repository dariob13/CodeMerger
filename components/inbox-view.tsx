"use client"

import { CheckCheckIcon, InboxIcon, Trash2Icon } from "lucide-react"
import { AgentDot } from "@/components/agent-dot"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { InboxState } from "@/hooks/use-inbox"
import { relativeTime } from "@/lib/format"
import type { AgentInfo, InboxItem } from "@/lib/types"

type Props = { inbox: InboxState; agents: AgentInfo[]; onOpen: (item: InboxItem) => void }

// Where the results of automation runs arrive.
export function InboxView({ inbox, agents, onOpen }: Props) {
  const { items, unread, markAllRead, remove } = inbox

  if (!items.length) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>Your inbox is empty</EmptyTitle>
          <EmptyDescription>When one of your automations runs, its result arrives here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pt-2 pb-8">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{unread ? `${unread} unread` : "All read"}</p>
          <Button variant="ghost" size="sm" disabled={!unread} onClick={markAllRead}>
            <CheckCheckIcon data-icon="inline-start" />
            Mark all as read
          </Button>
        </div>
        <ItemGroup className="gap-2">
          {items.map((item) => (
            <Item key={item.id} variant="outline" className={`glass items-start rounded-2xl ${item.read ? "opacity-75" : ""}`}>
              <ItemMedia className="pt-1.5">
                <AgentDot color={agents.find((a) => a.id === item.agent)?.color} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle className={item.read ? "font-normal" : "font-semibold"}>
                  {item.title}
                  {item.status !== "done" && <Badge variant={item.status === "error" ? "destructive" : "outline"}>{item.status === "error" ? "Failed" : "Stopped"}</Badge>}
                  <span className="text-xs font-normal text-muted-foreground">{relativeTime(item.ts)}</span>
                </ItemTitle>
                <ItemDescription className="line-clamp-3 whitespace-pre-line">{item.preview || "No output."}</ItemDescription>
              </ItemContent>
              <ItemActions>
                {item.chatId && (
                  <Button variant="outline" size="sm" onClick={() => onOpen(item)}>
                    Open
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${item.title} from inbox`} onClick={() => remove(item.id)}>
                  <Trash2Icon />
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </div>
    </ScrollArea>
  )
}
