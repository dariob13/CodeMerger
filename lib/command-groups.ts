import type { Part, TextPart, ToolPart } from "@/lib/types"

type ReplyBlock =
  | { type: "text"; part: TextPart; index: number }
  | { type: "commands"; tools: ToolPart[]; key: string }

// Keep prose in its original position; only adjacent tool calls share a disclosure.
export function groupReplyParts(parts: Part[]): ReplyBlock[] {
  const blocks: ReplyBlock[] = []
  parts.forEach((part, index) => {
    if (part.type === "text") blocks.push({ type: "text", part, index })
    else {
      const last = blocks.at(-1)
      if (last?.type === "commands") last.tools.push(part)
      else blocks.push({ type: "commands", tools: [part], key: part.id })
    }
  })
  return blocks
}

export function commandGroupSummary(tools: ToolPart[]) {
  const runningIndex = tools.findLastIndex((tool) => tool.status === "running")
  const failed = tools.filter((tool) => tool.status === "error").length
  const starts = tools.flatMap((tool) => tool.startedAt == null ? [] : [tool.startedAt])
  const finishes = tools.flatMap((tool) => tool.finishedAt == null ? [] : [tool.finishedAt])
  return {
    status: runningIndex >= 0 ? "running" as const : failed ? "error" as const : "done" as const,
    runningIndex,
    runningTool: tools[runningIndex],
    failed,
    names: [...new Set(tools.map((tool) => tool.name))].join(", "),
    // Older replies have no command timings; don't substitute the whole reply's duration.
    duration: runningIndex < 0 && starts.length && finishes.length ? Math.max(0, Math.max(...finishes) - Math.min(...starts)) : undefined,
  }
}
