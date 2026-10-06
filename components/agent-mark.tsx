import { cn } from "@/lib/utils"

// Nine cells, mirrored left to right, lit by a hash of the name: the same name always draws the same mark.
function pattern(name: string) {
  let hash = 2166136261
  for (const ch of name.trim().toLowerCase()) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619)
  const bit = (n: number) => ((hash >>> n) & 1) === 1
  const cells = [0, 1, 2].flatMap((row) => [bit(row), bit(row + 3), bit(row)])
  // Too few lit cells reads as noise, so those names share the diagonal cross.
  return cells.filter(Boolean).length >= 3 ? cells : [true, false, true, false, true, false, true, false, true]
}

// The mark that identifies an agent the user set up. It ripples while the agent is working.
export function AgentMark({ name, active, className }: { name: string; active?: boolean; className?: string }) {
  return (
    <span aria-hidden data-active={active || undefined} className={cn("agent-mark size-4", className)}>
      {pattern(name).map((lit, i) => (
        <i key={i} data-lit={lit || undefined} style={{ "--d": (i % 3) + Math.floor(i / 3) } as React.CSSProperties} />
      ))}
    </span>
  )
}

// The mark on a raised tile, for lists and headers.
export function AgentMarkTile({ name, active, className }: { name: string; active?: boolean; className?: string }) {
  return (
    <span className={cn("grid size-11 shrink-0 place-items-center rounded-[13px] border bg-secondary", className)}>
      <AgentMark name={name} active={active} className="size-1/2" />
    </span>
  )
}
