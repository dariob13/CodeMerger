"use client"

import * as React from "react"
import type { Access } from "@/lib/types"

// Preferences kept in this browser. Model and effort are per agent, like the picks a new chat starts from.
export type Settings = {
  sendWith: "enter" | "mod-enter"
  notify: boolean // tell the user a reply finished while the window was in the background
  textSize: "small" | "default" | "large"
  reduceMotion: boolean
  foldCommands: boolean // command groups in a reply start closed
  access: Access
  models: Record<string, string>
  efforts: Record<string, string>
}

export const DEFAULT_SETTINGS: Settings = {
  sendWith: "enter",
  notify: false,
  textSize: "default",
  reduceMotion: false,
  foldCommands: true,
  access: "read",
  models: {},
  efforts: {},
}

const STORAGE = "settings"
const listeners = new Set<() => void>()
let cached: Settings | null = null

function read() {
  if (cached) return cached
  try {
    cached = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE) || "{}") }
  } catch {
    cached = DEFAULT_SETTINGS
  }
  return cached as Settings
}

export function updateSettings(change: Partial<Settings>) {
  cached = { ...read(), ...change }
  localStorage.setItem(STORAGE, JSON.stringify(cached))
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener))

export function useSettings() {
  return React.useSyncExternalStore(subscribe, read, () => DEFAULT_SETTINGS)
}
