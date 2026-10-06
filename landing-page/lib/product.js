// Built-in agents are verified against ../../lib/server/agents.ts. Requested
// additions remain coming soon until their app integrations are verified.
export const product = {
  name: "Code Merger",
  githubUrl: null,
  releaseUrl: null,
  sourceDownload: '/downloads/code-merger-source.zip',
  nodeVersion: '20.9+',
  agents: [
    { name: "Claude Code", icon: "claude", detail: "Uses your existing Claude CLI login.", confirmed: true },
    { name: "Codex", icon: "openai", detail: "Uses your existing Codex CLI login.", confirmed: true },
    { name: "OpenCode", icon: "opencode", detail: "Uses your existing OpenCode CLI login.", confirmed: true },
    { name: "Cursor", icon: "cursor", detail: "Cursor integration is coming soon.", confirmed: false },
    { name: "Antigravity", icon: "antigravity", detail: "Antigravity integration is coming soon.", confirmed: false },
    { name: "Hermes", icon: "hermes", detail: "Hermes integration is coming soon.", confirmed: false },
    { name: "Grok", icon: "grok", detail: "Grok integration is coming soon.", confirmed: false }
  ],
  platforms: [
    { id: "macos", name: "macOS", detail: "Source .zip · Apple Silicon and Intel · Node.js 20.9+", url: '/downloads/code-merger-source.zip', confirmed: true },
    { id: "linux", name: "Linux", detail: "Source .zip · Node.js 20.9+", url: '/downloads/code-merger-source.zip', confirmed: true },
    { id: "windows", name: "Windows", detail: "Not yet verified", url: null, confirmed: false }
  ]
};
