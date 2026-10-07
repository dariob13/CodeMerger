"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ChatContext } from "@/hooks/use-context"
import { cn } from "@/lib/utils"

const R = 6
const AROUND = 2 * Math.PI * R
const tokens = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

// A ring that fills as the chat's session uses up the model's context window.
export function ContextRing({ context, agentName, className }: { context: ChatContext; agentName: string; className?: string }) {
  const share = Math.min(context.used / context.window, 1)
  const percent = Math.round(share * 100)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Context window ${percent}% used`}
          className={cn("grid size-5 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
        >
          <svg viewBox="0 0 16 16" className="size-4 -rotate-90" aria-hidden>
            <circle cx="8" cy="8" r={R} fill="none" strokeWidth="2" className="stroke-foreground/15" />
            <circle
              cx="8"
              cy="8"
              r={R}
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${share * AROUND} ${AROUND}`}
              className={cn("transition-[stroke-dasharray] duration-300 motion-reduce:transition-none", share >= 0.9 ? "stroke-destructive" : "stroke-muted-foreground")}
            />
          </svg>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {agentName} context: {percent}% used · {tokens(context.used)} of {tokens(context.window)} tokens
      </TooltipContent>
    </Tooltip>
  )
}
