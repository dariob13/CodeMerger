"use client"

import * as React from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { ChatsState } from "@/hooks/use-chats"
import type { GitChange, GitCommit, WorkspaceFile, WorkspaceGit, WorkspaceSnapshot } from "@/lib/types"

export type WorkspaceTab = "sessions" | "explorer" | "changes"
export type EditorDocument = { key: string; title: string; path: string; content: string; version?: string; saved: string; kind: "file" | "diff" | "commit" }
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

export function useWorkspace(state: ChatsState) {
  const projectId = state.project?.id, base = `projects/${projectId}`
  const [tab, setTab] = React.useState<WorkspaceTab>("sessions")
  const [snapshot, setSnapshot] = React.useState<{ id: string; data: WorkspaceSnapshot } | null>(null)
  const [failure, setFailure] = React.useState<{ id?: string; message: string }>({ message: "" })
  const [busyProject, setBusyProject] = React.useState<string | null>(null)
  const [allDocuments, setAllDocuments] = React.useState<Record<string, EditorDocument[]>>({})
  const [activeDocuments, setActiveDocuments] = React.useState<Record<string, string | null>>({})
  const key = projectId || ""
  const documents = React.useMemo(() => allDocuments[key] ?? [], [allDocuments, key])
  const activeDocument = activeDocuments[key] ?? null
  const error = failure.id === projectId ? failure.message : ""
  const busy = busyProject === projectId
  const setDocuments = (change: (prev: EditorDocument[]) => EditorDocument[]) => setAllDocuments((prev) => ({ ...prev, [key]: change(prev[key] ?? []) }))
  const setActiveDocument = (change: string | null | ((prev: string | null) => string | null)) => setActiveDocuments((prev) => ({ ...prev, [key]: typeof change === "function" ? change(prev[key] ?? null) : change }))
  const [fileRevision, setFileRevision] = React.useState(0)
  const request = React.useRef(0)
  const mutations = React.useRef(new Set<string>())
  const currentProject = React.useRef(projectId), documentsRef = React.useRef(documents)
  React.useLayoutEffect(() => { currentProject.current = projectId; documentsRef.current = documents }, [projectId, documents])
  const data = snapshot && snapshot.id === projectId ? snapshot.data : null
  React.useEffect(() => {
    if (!Object.values(allDocuments).some((docs) => docs.some((d) => d.content !== d.saved))) return
    const beforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [allDocuments])

  const refresh = React.useCallback(async () => {
    if (!projectId) return
    const sequence = ++request.current
    try {
      const result = await api<WorkspaceSnapshot>(`projects/${projectId}/workspace`)
      if (currentProject.current !== projectId || sequence !== request.current) return
      setSnapshot({ id: projectId, data: result }); setFailure({ id: projectId, message: "" })
    } catch (error) { if (currentProject.current === projectId && sequence === request.current) setFailure({ id: projectId, message: errorMessage(error) }) }
  }, [projectId])

  React.useEffect(() => {
    request.current++
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => { await refresh(); if (!stopped) timer = setTimeout(poll, 2500) }
    timer = setTimeout(poll, 0)
    const focus = () => { void refresh(); setFileRevision((r) => r + 1) }
    window.addEventListener("focus", focus)
    return () => { stopped = true; clearTimeout(timer); window.removeEventListener("focus", focus) }
  }, [refresh])
  React.useEffect(() => { const timer = setTimeout(refresh, 0); return () => clearTimeout(timer) }, [state.chats, refresh])

  const install = (document: EditorDocument) => {
    if (currentProject.current !== projectId) return
    setDocuments((prev) => [...prev.filter((d) => d.key !== document.key), document]); setActiveDocument(document.key)
  }
  const openFile = async (path: string) => {
    const key = `file:${path}`
    if (documentsRef.current.some((d) => d.key === key)) { setActiveDocument(key); return }
    try {
      const { file } = await api<{ file: WorkspaceFile }>(`${base}/files?${new URLSearchParams({ file: path })}`)
      install({ key, title: path.split("/").pop()!, path, content: file.content, saved: file.content, version: file.version, kind: "file" })
    } catch (error) { toast.error(errorMessage(error)) }
  }
  const openDiff = async (change: GitChange) => {
    try {
      const { diff } = await api<{ diff: string }>(`${base}/changes?${new URLSearchParams({ path: change.path, staged: String(change.staged) })}`)
      install({ key: `diff:${change.staged}:${change.path}`, title: `${change.path.split("/").pop()}${change.staged ? " (staged)" : " (changes)"}`, path: change.path, content: diff, saved: diff, kind: "diff" })
    } catch (error) { toast.error(errorMessage(error)) }
  }
  const openCommit = async (commit: GitCommit) => {
    try {
      const { diff } = await api<{ diff: string }>(`${base}/changes?commit=${commit.hash}`)
      install({ key: `commit:${commit.hash}`, title: commit.hash.slice(0, 7), path: commit.subject, content: diff, saved: diff, kind: "commit" })
    } catch (error) { toast.error(errorMessage(error)) }
  }
  const act = async (action: string, paths: string[] = [], message = "") => {
    if (!projectId || mutations.current.has(projectId)) return false
    mutations.current.add(projectId); setBusyProject(projectId)
    try {
      const { git } = await api<{ git: WorkspaceGit }>(`${base}/changes`, { method: "POST", body: { action, paths, message } })
      if (currentProject.current !== projectId) return false
      request.current++
      setSnapshot((prev) => prev?.id === projectId ? { ...prev, data: { ...prev.data, git } } : prev)
      setFileRevision((r) => r + 1)
      if (action === "commit" || action === "push") toast.success(action === "commit" ? "Changes committed" : "Commits pushed")
      return true
    } catch (error) { toast.error(errorMessage(error)); return false }
    finally { mutations.current.delete(projectId); setBusyProject((prev) => prev === projectId ? null : prev) }
  }
  const createFile = async (path: string) => {
    try {
      const { file } = await api<{ file: WorkspaceFile }>(`${base}/files`, { method: "POST", body: { path, content: "" } })
      if (currentProject.current !== projectId) return false
      install({ key: `file:${path}`, title: path.split("/").pop()!, path, content: file.content, saved: file.content, version: file.version, kind: "file" })
      setFileRevision((r) => r + 1); void refresh(); return true
    } catch (error) { toast.error(errorMessage(error)); return false }
  }
  const editDocument = (key: string, content: string) => setDocuments((prev) => prev.map((d) => d.key === key ? { ...d, content } : d))
  const closeDocument = (key: string) => {
    setDocuments((prev) => prev.filter((d) => d.key !== key))
    setActiveDocument((prev) => prev === key ? documentsRef.current.filter((d) => d.key !== key).at(-1)?.key ?? null : prev)
  }
  const saveDocument = async (document: EditorDocument) => {
    try {
      const { file } = await api<{ file: WorkspaceFile }>(`${base}/files`, { method: "PATCH", body: { path: document.path, content: document.content, version: document.version } })
      setDocuments((prev) => prev.map((d) => d.key === document.key ? { ...d, version: file.version, saved: document.content } : d))
      if (currentProject.current === projectId) void refresh()
      toast.success("File saved")
    } catch (error) { toast.error(errorMessage(error)) }
  }
  const stopSession = async (id: string) => {
    try { await api(`chats/${id}/stop`, { method: "POST" }); void refresh(); void state.reloadChats() } catch (error) { toast.error(errorMessage(error)) }
  }
  const openSession = async (id: string) => {
    state.openChat(id, projectId)
    try {
      const { chat } = await api<{ chat: WorkspaceSnapshot["sessions"][number] }>(`chats/${id}`, { method: "PATCH", body: { read: true } })
      state.upsertSummary(chat); void refresh()
    } catch (error) { toast.error(errorMessage(error)) }
  }
  return { tab, setTab, data, error, busy, loading: !data && !error, refresh, base, projectId, fileRevision,
    documents, activeDocument, setActiveDocument, openFile, openDiff, openCommit, act, createFile, editDocument, closeDocument, saveDocument, stopSession, openSession }
}
export type WorkspaceState = ReturnType<typeof useWorkspace>
