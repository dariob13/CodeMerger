<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/boals/svg/boals-logo-milk.svg">
  <img src="brand/boals/svg/boals-logo-butter.svg" alt="boals" width="360">
</picture>

### Your little co-builder.

**One workspace for your coding agents, conversations, and projects.**

Bring Claude Code, Codex, OpenCode, Cursor, Antigravity, Grok, Hermes, and Pi into one chat.
Switch agents as you work, keep the conversation moving, and build in your own project folders.

[Get started](#get-started) · [Features](#what-you-can-do) · [How it works](#how-it-works) · [Brand assets](#brand-assets)

</div>

---

**boals** is the new identity for **CodeMerger**: a local workspace for the coding agent CLIs you already use. It brings their conversations and tools into one interface built with Next.js, React, TypeScript, and [shadcn/ui](https://ui.shadcn.com).

The repository and the app currently retain the CodeMerger name while the boals identity takes shape.

## What you can do

| | |
| --- | --- |
| **Build with your favorite agents** | Use Claude Code, Codex, OpenCode, Cursor, Antigravity, Grok, Hermes, and Pi through their installed CLIs and existing logins. |
| **Switch without starting over** | Keep one conversation while each agent receives the context it missed. |
| **Give every project a home** | Organize chats and automations around folders on your computer. |
| **Choose how an agent works** | Pick its model, effort level, and supported access mode: read-only, file editing, or full access. |
| **Bring files into the conversation** | Attach, paste, or drop files and images into a message. |
| **Keep work moving** | Save notes, schedule automations, and collect run results in the inbox. |
| **Create your own agents** | Define standing duties and memories that carry into future turns. |

## Get started

Install **Node.js 20.9 or newer** and at least one supported agent CLI. Sign in through that CLI before using it in boals.

```sh
git clone https://github.com/dariob13/CodeMerger.git
cd CodeMerger
npm install
npm start
```

Open **[localhost:4317](http://localhost:4317)**. `npm start` builds the app and serves it locally.

For development:

```sh
npm run dev
```

The development server uses the same address with hot reload.

## How it works

### Your CLIs, one conversation

Agents are detected on your `PATH` and use the accounts already signed in through their CLIs. The agent menu shows installation and sign-in status. Use the recheck button in the agent menu after installing or signing in.

Each agent keeps its own CLI session. When you switch, the next agent receives the conversation turns it missed. The composer lets you choose the agent, model, effort level, and supported permissions for the next turn.

### Projects that stay on your computer

A project points to a folder where agents read, write, and run commands. You can use an existing folder or create one under `~/Code Merger Projects`. Removing a project from the app leaves its folder and files on disk.

Chats, notes, automations, inbox items, agent memories, and usage records are saved locally under `data/`. Uploads live under `data/uploads/`. Set `CODE_MERGER_DATA` to choose another data directory.

The server listens on `127.0.0.1`; `proxy.ts` rejects requests originating from other sites. Agent CLIs contact their providers as they normally do.

### A quieter way to keep things moving

Notes save as you type. Automations run on demand, at a daily time, or on an interval; each run creates a chat and sends its result to the inbox. Scheduled work runs while the app is running, and missed runs are skipped.

Custom agents keep standing duties and memories across turns. Each one is listed in the sidebar and has its own chat in every project, with its duties and memory beside it.

## Inside the repo

| Path | Purpose |
| --- | --- |
| `app/`, `components/` | Next.js interface and shadcn/ui components |
| `hooks/use-chats.ts` | Conversation state and live replies |
| `app/api/` | Local API routes for agents, projects, chats, and workspace tools |
| `lib/server/agents.ts` | CLI detection, invocation, and event adapters |
| `lib/server/runner.ts` | Turn execution, context handoff, and streamed replies |
| `lib/server/store.ts` | Local data storage and active runs |
| `lib/server/automations.ts`, `instrumentation.ts` | Automation scheduling and execution |
| `lib/server/personas.ts` | Custom agent duties and memories |
| `app/globals.css` | Light and dark theme tokens |
| `landing-page/` | The separate marketing website |
| `brand/boals/` | Brand direction, SVG logos, and companion expressions |

## Add another agent

A CLI that accepts a prompt and prints an answer can be configured in `data/agents.json`:

```json
[
  {
    "id": "aider",
    "name": "Aider",
    "command": "aider",
    "args": ["--message", "{prompt}", "--no-stream"]
  }
]
```

If no argument contains `{prompt}`, the prompt is sent through stdin. For streaming events, tool activity, and resumable sessions, add a full adapter in `lib/server/agents.ts`.

## Brand assets

The boals companion is a simple round face with two expressive eyes. The palette pairs ink and warm milk with a butter-yellow accent.

[Brand direction](brand/boals/README.md) · [SVG asset guide](brand/boals/svg/README.md) · [Download the SVG pack](brand/boals/boals-svg-assets.zip)

<p align="center">
  <img src="brand/boals/svg/boals-face-hi.svg" alt="boals saying hi" width="64">
  &nbsp;&nbsp;
  <img src="brand/boals/svg/boals-face-thinking.svg" alt="boals thinking" width="64">
  &nbsp;&nbsp;
  <img src="brand/boals/svg/boals-face-done.svg" alt="boals celebrating a finished task" width="64">
</p>
