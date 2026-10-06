"use client"

import * as React from "react"
import { api } from "@/lib/api"
import type { Persona } from "@/lib/types"

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

export type PersonaDraft = Pick<Persona, "name" | "duties" | "agent">

// The agents the user set up. Reloads whenever `trigger` changes: a reply finishing may have added memories.
export function usePersonas(trigger: unknown) {
  const [personas, setPersonas] = React.useState<Persona[]>([])

  const reload = React.useCallback(async () => {
    try {
      setPersonas((await api<{ personas: Persona[] }>("personas")).personas)
    } catch {
      // Keep what we have; the next reload will catch up.
    }
  }, [])
  React.useEffect(() => {
    const first = setTimeout(reload, 0)
    return () => clearTimeout(first)
  }, [reload, trigger])

  // Each returns an error message to show, or null on success.
  const create = React.useCallback(async (draft: PersonaDraft) => {
    try {
      const { persona } = await api<{ persona: Persona }>("personas", { method: "POST", body: draft })
      setPersonas((prev) => [...prev, persona])
      return null
    } catch (err) {
      return message(err)
    }
  }, [])

  const update = React.useCallback(async (id: string, change: Partial<PersonaDraft> & { remember?: string; forget?: string }) => {
    try {
      const { persona } = await api<{ persona: Persona }>(`personas/${id}`, { method: "PATCH", body: change })
      setPersonas((prev) => prev.map((p) => (p.id === id ? persona : p)))
      return null
    } catch (err) {
      return message(err)
    }
  }, [])

  const remove = React.useCallback(async (id: string) => {
    try {
      await api(`personas/${id}`, { method: "DELETE" })
      setPersonas((prev) => prev.filter((p) => p.id !== id))
      return null
    } catch (err) {
      return message(err)
    }
  }, [])

  return { personas, reload, create, update, remove }
}

export type PersonasState = ReturnType<typeof usePersonas>
