import { json } from "@/lib/server/http"
import { detected, recordUsage, state } from "@/lib/server/store"
import type { AgentUsage } from "@/lib/types"

const HOUR = 3_600_000

// Usage for every active agent: installed, and not known to be signed out.
export async function GET() {
  const active = (await detected()).filter((d) => d.bin && d.auth !== "none")
  const now = Date.now()

  const usage: AgentUsage[] = []
  for (const { agent } of active) {
    // Limits a CLI keeps on disk can be shown before the first message is sent from here.
    if (!state.usage[agent.id] && agent.readUsage) await recordUsage(agent.id, await agent.readUsage().catch(() => null)).catch(() => {})
    const known = state.usage[agent.id]
    const recent = { fiveHours: 0, week: 0 }
    for (const chat of state.chats.values()) {
      for (const m of chat.messages) {
        if (m.role !== "assistant" || m.agent !== agent.id) continue
        if (now - m.ts < 5 * HOUR) recent.fiveHours++
        if (now - m.ts < 168 * HOUR) recent.week++
      }
    }
    usage.push({
      agent: agent.id,
      // A window whose reset time has passed has started over.
      windows: (known?.windows ?? []).map((w) => (w.resetsAt <= now ? { ...w, used: 0, resetsAt: 0 } : w)),
      plan: known?.plan ?? "",
      updatedAt: known?.updatedAt ?? null,
      recent,
    })
  }
  return json({ usage })
}
