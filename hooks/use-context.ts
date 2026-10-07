"use client"

import * as React from "react"
import { api } from "@/lib/api"

// Tokens in a chat's context window, for the agent that last replied in it.
export type ChatContext = { used: number; window: number; agent: string }

// The open chat's context use. Reloads when the chat changes and whenever `trigger` does (a reply finishing).
export function useContext(chatId: string | null, trigger: unknown) {
  const [loaded, setLoaded] = React.useState<{ chatId: string; context: ChatContext | null } | null>(null)

  React.useEffect(() => {
    if (!chatId) return
    let left = false
    api<{ context: ChatContext | null }>(`chats/${chatId}/context`)
      .then(({ context }) => !left && setLoaded({ chatId, context }))
      .catch(() => {}) // Keep what we have; the next reply will catch up.
    return () => {
      left = true
    }
  }, [chatId, trigger])

  return loaded?.chatId === chatId ? loaded.context : null
}
