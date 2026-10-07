"use client"

import * as React from "react"
import { CircleAlertIcon, FileIcon } from "lucide-react"
import { AgentIcon } from "@/components/agent-icon"
import { AgentMark } from "@/components/agent-mark"
import { AgentTimer } from "@/components/agent-timer"
import { Markdown } from "@/components/markdown"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { isImage, type AgentInfo, type Attachment, type Message, type ToolPart } from "@/lib/types"

function ToolRow({ tool }: { tool: ToolPart }) {
  return (
    <div className="my-1.5 flex min-w-0 items-center gap-2">
      <Badge variant={tool.status === "error" ? "destructive" : "outline"} className="bg-card font-mono">
        {tool.status === "running" && <Spinner data-icon="inline-start" />}
        {tool.name}
      </Badge>
      <span className="truncate font-mono text-xs text-muted-foreground" title={tool.detail}>
        {tool.detail}
      </span>
    </div>
  )
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

type Props = { chatId: string; message: Message; agent?: AgentInfo }

export const ChatMessage = React.memo(function ChatMessage({ chatId, message, agent }: Props) {
  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-2">
        {message.attachments?.length ? <Attachments chatId={chatId} files={message.attachments} /> : null}
        {message.text && (
          <div className="max-w-[82%] rounded-2xl bg-secondary px-4 py-2.5 text-[15px] leading-7 wrap-anywhere whitespace-pre-wrap">
            {message.text}
          </div>
        )}
      </div>
    )
  }

  return (
    <article className="min-w-0">
      <header className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-medium">
        {message.persona ? (
          <>
            <AgentMark name={message.persona.name} active={message.status === "running"} />
            {message.persona.name}
            <span className="font-normal text-subtle">on {agent?.name || message.agent}</span>
          </>
        ) : (
          <>
            <AgentIcon id={agent?.id} color={agent?.color} />
            {agent?.name || message.agent}
          </>
        )}
        {message.model && (
          <span className="font-normal text-muted-foreground">{agent?.models.find(([v]) => v === message.model)?.[1] ?? message.model}</span>
        )}
        <AgentTimer message={message} />
      </header>
      {message.parts.map((part, i) =>
        part.type === "text" ? (
          <Markdown key={i} text={message.persona ? withoutMemoryLines(part.text) : part.text} />
        ) : (
          <ToolRow key={part.id} tool={part} />
        )
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
    </article>
  )
})
