"use client"

import * as React from "react"
import { api } from "@/lib/api"
import type { AgentSkill } from "@/lib/types"

export function useSkills(projectId: string | undefined, agentId: string | undefined, active: boolean) {
  const key = `${projectId}:${agentId}`
  const [catalog, setCatalog] = React.useState<{ key: string; skills: AgentSkill[] } | null>(null)
  const [failure, setFailure] = React.useState<{ key: string; message: string } | null>(null)
  const sequence = React.useRef(0)
  const currentKey = React.useRef(key)
  const invalidate = React.useCallback(() => { sequence.current++ }, [])
  React.useLayoutEffect(() => { currentKey.current = key }, [key])
  const refresh = React.useCallback(async () => {
    if (!projectId || !agentId || !active) return
    const request = ++sequence.current
    try {
      const result = await api<{ skills: AgentSkill[] }>(`projects/${projectId}/skills?${new URLSearchParams({ agent: agentId })}`)
      if (currentKey.current !== key || request !== sequence.current) return
      setCatalog({ key, skills: result.skills }); setFailure(null)
    } catch (error) {
      if (currentKey.current === key && request === sequence.current) setFailure({ key, message: error instanceof Error ? error.message : String(error) })
    }
  }, [projectId, agentId, active, key])
  React.useEffect(() => {
    invalidate()
    const timer = setTimeout(refresh, 0)
    window.addEventListener("focus", refresh)
    return () => { invalidate(); clearTimeout(timer); window.removeEventListener("focus", refresh) }
  }, [refresh, invalidate])
  const error = failure?.key === key ? failure.message : ""
  const skills = catalog?.key === key ? catalog.skills : []
  return { key, skills, error, loading: Boolean(projectId && agentId && catalog?.key !== key && !error), refresh }
}
