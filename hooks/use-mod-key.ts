"use client"

import * as React from "react"

const subscribe = () => () => {}

// The key shortcuts are written with: ⌘ on Apple devices, Ctrl elsewhere and until the page knows which it is on.
export function useModKey() {
  return React.useSyncExternalStore(subscribe, () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"), () => "Ctrl")
}
