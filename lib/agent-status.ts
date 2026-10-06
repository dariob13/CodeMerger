import type { AgentInfo } from "@/lib/types"

// One short label for where an agent stands: installed or not, signed in or not.
export function agentStatus(agent: AgentInfo) {
  if (!agent.connected) return "Not installed"
  if (agent.auth === "ok") return "Signed in"
  if (agent.auth === "none") return "Signed out"
  return "Installed"
}
