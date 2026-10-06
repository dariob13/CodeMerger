"use client"

import * as React from "react"
import type { TokensResult } from "shiki"
import { CheckIcon, CopyIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { highlightCode } from "@/lib/syntax"

export function CodeBlock({ children }: { children?: React.ReactNode }) {
  const child = React.Children.toArray(children)[0]
  const code = React.isValidElement<{ children?: React.ReactNode; className?: string }>(child) ? child : null
  const source = String(code?.props.children ?? "")
  const language = /language-([^\s]+)/.exec(code?.props.className || "")?.[1] || "text"
  const [highlighted, setHighlighted] = React.useState<{ source: string; language: string; result: TokensResult } | null>(null)
  const [copiedSource, setCopiedSource] = React.useState<string | null>(null)
  const resetCopy = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = React.useRef(true)
  const copied = copiedSource === source
  const tokens = highlighted?.source === source && highlighted.language === language ? highlighted.result.tokens : null

  React.useEffect(() => {
    let cancelled = false
    // Coalesce rapid stream chunks; keep showing the latest plain code while
    // the grammar loads, and never replace it with an older async result.
    const timer = window.setTimeout(() => {
      highlightCode(source, language).then((result) => {
        if (!cancelled) setHighlighted({ source, language, result })
      }).catch(() => { /* Plain code remains usable if a grammar cannot load. */ })
    }, 60)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [source, language])

  React.useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (resetCopy.current) clearTimeout(resetCopy.current)
    }
  }, [])

  const copy = async () => {
    try {
      // Copy the original complete block, including indentation and newlines,
      // rather than the highlighted DOM or its language/button labels.
      await navigator.clipboard.writeText(source)
      if (!mounted.current) return
      setCopiedSource(source)
      if (resetCopy.current) clearTimeout(resetCopy.current)
      resetCopy.current = setTimeout(() => setCopiedSource(null), 1800)
    } catch {
      toast.error("Could not copy this code. Select the block and copy it manually.")
    }
  }

  return (
    <div className="glass my-3 min-w-0 overflow-hidden rounded-xl">
      <div className="flex items-center justify-between gap-3 border-b py-1 pr-1 pl-3 font-mono text-xs text-muted-foreground">
        <span className="truncate">{language}</span>
        <Button type="button" variant="ghost" size="xs" onClick={copy} aria-label={copied ? "Code block copied" : "Copy entire code block"}>
          {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
          <span aria-live="polite">{copied ? "Copied" : "Copy code"}</span>
        </Button>
      </div>
      <pre tabIndex={0} aria-label={`${language} code`} className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <code>{tokens ? tokens.map((line, index) => <React.Fragment key={index}>
          {index > 0 && "\n"}
          {line.map((token, tokenIndex) => <span key={tokenIndex} className="code-token" style={token.htmlStyle as React.CSSProperties}>{token.content}</span>)}
        </React.Fragment>) : source}</code>
      </pre>
    </div>
  )
}
