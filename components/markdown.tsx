"use client"

import * as React from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { CodeBlock } from "@/components/code-block"

const components: Components = {
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  code: ({ className, children }) => (
    <code className={`rounded-md border bg-muted/60 px-1 py-px font-mono text-[0.85em] ${className || ""}`}>{children}</code>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-muted-foreground/50 underline-offset-4 hover:decoration-foreground">
      {children}
    </a>
  ),
  p: ({ children }) => <p className="my-3 leading-7">{children}</p>,
  h1: ({ children }) => <h1 className="mt-6 mb-2 text-xl font-semibold tracking-tight">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-6 mb-2 text-lg font-semibold tracking-tight">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-5 mb-2 text-base font-semibold">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-4 mb-2 text-sm font-semibold">{children}</h4>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children, start }) => <ol start={start} className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
  li: ({ children }) => <li className="leading-7 [&>p]:my-1">{children}</li>,
  blockquote: ({ children }) => <blockquote className="my-3 border-l-2 pl-4 text-muted-foreground">{children}</blockquote>,
  hr: () => <hr className="my-5" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  th: ({ children, style }) => <th style={style} className="border-b py-2 pr-4 text-left font-medium">{children}</th>,
  td: ({ children, style }) => <td style={style} className="border-b py-2 pr-4 align-top">{children}</td>,
}

// Agent replies as Markdown. Raw HTML in a reply is shown as text, never rendered.
export const Markdown = React.memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="text-[15px] wrap-anywhere [&>:first-child]:mt-0 [&>:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
})
