import { cn } from "@/lib/utils"

// The colored dot that identifies an agent everywhere in the interface.
export function AgentDot({ color, className }: { color?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-2 shrink-0 rounded-full", !color && "border border-muted-foreground/60", className)}
      style={color ? { backgroundColor: color } : undefined}
    />
  )
}
