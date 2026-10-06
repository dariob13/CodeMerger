import type { BundledLanguage, TokensResult } from "shiki"

// The full catalogue uses dynamic grammar imports: only languages actually
// encountered in replies are downloaded. Shiki reuses its singleton engine.
let modulePromise: Promise<typeof import("shiki/bundle/full")> | undefined
const aliases: Record<string, string> = {
  "c++": "cpp", "c#": "csharp", "f#": "fsharp",
  "shell-session": "console", "bash-session": "console",
  "plain": "text", "plaintext": "text", "txt": "text",
  "docker": "dockerfile", "objectivec": "objective-c",
}

export async function highlightCode(code: string, language: string): Promise<TokensResult> {
  const shiki = await (modulePromise ??= import("shiki/bundle/full").catch((error) => {
    modulePromise = undefined
    throw error
  }))
  const requested = language.toLowerCase()
  const name = aliases[requested] || requested
  const lang = Object.hasOwn(shiki.bundledLanguages, name) ? name as BundledLanguage : "text"
  return shiki.codeToTokens(code, {
    lang,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  })
}
