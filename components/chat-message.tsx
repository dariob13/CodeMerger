"use client"

import * as React from "react"
import { CircleAlertIcon, FileIcon, BookOpenIcon } from "lucide-react"
import { AgentIcon } from "@/components/agent-icon"
import { AgentMark } from "@/components/agent-mark"
import { AgentTimer } from "@/components/agent-timer"
import { BoalsFace } from "@/components/boals"
import { Markdown } from "@/components/markdown"
import { CommandGroup } from "@/components/command-group"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ReplyActions, type HandoffTarget, type Handoffs } from "@/components/reply-actions"
import { isImage, type AgentInfo, type Attachment, type Message } from "@/lib/types"
import { groupReplyParts } from "@/lib/command-groups"

const DONE_FOR = 1500

// The smiling face stands in for the agent's mark for a moment after its reply ends.
function JustFinished({ finishedAt, children }: { finishedAt?: number | null; children: React.ReactNode }) {
  const [smiling, setSmiling] = React.useState(() => finishedAt != null && Date.now() - finishedAt < DONE_FOR)
  React.useEffect(() => {
    if (!smiling) return
    const timer = setTimeout(() => setSmiling(false), DONE_FOR)
    return () => clearTimeout(timer)
  }, [smiling])
  return smiling ? <BoalsFace face="done" className="size-[18px]" /> : children
}

function Attachments({ chatId, files }: { chatId: string; files: Attachment[] }) {
  const url = (file: Attachment) => `/api/chats/${chatId}/uploads/${file.id}`
  return (
    <div className="flex max-w-[82%] flex-wrap justify-end gap-2">
      {files.map((file) =>
        isImage(file) ? (
          <a key={file.id} href={url(file)} target="_blank" rel="noopener noreferrer" title={file.name}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a local upload, served as-is */}
            <img src={url(file)} alt={file.name} className="max-h-48 max-w-64 rounded-xl border object-cover" />
          </a>
        ) : (
          <Badge key={file.id} variant="outline" asChild>
            <a href={url(file)} download={file.name} title={`Download ${file.name}`}>
              <FileIcon data-icon="inline-start" />
              <span className="max-w-56 truncate">{file.name}</span>
            </a>
          </Badge>
        )
      )}
    </div>
  )
}

// An agent saves to its memory with REMEMBER lines. The server lifts them out when the reply ends; until then they are hidden here.
const withoutMemoryLines = (text: string) => text.replace(/^[ \t]*REMEMBER:.*$/gim, "").trimEnd()

type Props = {
  chatId: string
  message: Message
  agent?: AgentInfo
  // For a finished reply: where it can be handed off to, and how to run it again if it is the chat's last.
  handoffs?: Handoffs
  onHandOff?: (reply: { text: string; from: string }, target: HandoffTarget) => void
  onRetry?: () => void
}

export const ChatMessage = React.memo(function ChatMessage({ chatId, message, agent, handoffs, onHandOff, onRetry }: Props) {
  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-2">
        {message.skills?.length ? <div className="flex max-w-[82%] flex-wrap justify-end gap-1.5">{message.skills.map((skill) => <Badge key={skill.id} variant="outline" title={skill.path} className="bg-card"><BookOpenIcon data-icon="inline-start" /><span className="max-w-56 truncate">{skill.name}</span></Badge>)}</div> : null}
        {message.attachments?.length ? <Attachments chatId={chatId} files={message.attachments} /> : null}
        {message.text && (
          <div className="max-w-[82%] rounded-2xl bg-secondary px-4 py-2.5 text-[15px] leading-7 wrap-anywhere whitespace-pre-wrap">
            {message.text}
          </div>
        )}
      </div>
    )
  }

  const modelName = agent?.models.find(([value]) => value === message.model)?.[1] ?? message.model
  const workingName = message.persona?.name || modelName.replace(/-/g, " ") || agent?.name || message.agent

  return (
    <article className="min-w-0">
      {/* A reply in progress has no heading; its line of status sits under what has arrived so far. */}
      {message.status !== "running" && (
        <header className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-medium">
          <JustFinished finishedAt={message.finishedAt}>
            {message.persona ? <AgentMark name={message.persona.name} /> : <AgentIcon id={agent?.id} color={agent?.color} />}
          </JustFinished>
          {message.persona ? (
            <>
              {message.persona.name}
              <span className="font-normal text-subtle">on {agent?.name || message.agent}</span>
            </>
          ) : agent?.name || message.agent}
          {modelName && <span className="font-normal text-muted-foreground">{modelName}</span>}
          <AgentTimer message={message} name={workingName} />
        </header>
      )}
      {groupReplyParts(message.parts).map((block) =>
        block.type === "text" ? (
          <Markdown key={`text-${block.index}`} text={message.persona ? withoutMemoryLines(block.part.text) : block.part.text} />
        ) : (
          <CommandGroup key={`commands-${block.key}`} tools={block.tools} />
        )
      )}
      {message.status === "running" && (
        <p className="mt-2 flex items-center gap-2 text-xs">
          <BoalsFace face="working" className="size-[18px]" />
          <AgentTimer message={message} name={message.persona?.name || agent?.name || message.agent} />
        </p>
      )}
      {message.remembered?.map((fact) => (
        <p key={fact} className="mt-2 flex w-fit max-w-full items-center gap-2 rounded-full border bg-secondary py-1 pr-3 pl-2.5 text-xs text-muted-foreground">
          <AgentMark name={message.persona?.name || ""} className="size-2.5 text-subtle" />
          <span className="truncate">Remembered: {fact}</span>
        </p>
      ))}
      {message.error && (
        <Alert variant="destructive" className="mt-2">
          <CircleAlertIcon />
          <AlertTitle>{agent?.name || message.agent} couldn&apos;t answer</AlertTitle>
          <AlertDescription className="wrap-anywhere whitespace-pre-wrap">{message.error}</AlertDescription>
        </Alert>
      )}
      {message.status === "stopped" && message.finishedAt == null && <p className="mt-1.5 text-xs text-muted-foreground">Stopped</p>}
      {message.status !== "running" && handoffs && onHandOff && (
        <ReplyActions
          text={message.parts
            .flatMap((p) => (p.type === "text" ? [message.persona ? withoutMemoryLines(p.text) : p.text] : []))
            .join("\n\n")
            .trim()}
          from={message.persona?.name ?? agent?.short ?? message.agent}
          handoffs={handoffs}
          onHandOff={onHandOff}
          onRetry={onRetry}
        />
      )}
    </article>
  )
})
