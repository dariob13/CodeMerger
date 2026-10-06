# Code Merger

One chat window for all your coding agents. It drives the agent CLIs already installed
on your machine (Claude Code, Codex, OpenCode, Gemini CLI) and lets you switch between
them mid-conversation.

Built with Next.js (App Router) and [shadcn/ui](https://ui.shadcn.com).

## Run

```sh
npm install        # first time only
npm start          # builds, then serves
```

Then open http://localhost:4317. While developing, `npm run dev` serves the same
address with hot reload and skips the build.

## How it works

- **Agents** are detected from the CLIs on your `PATH`, using whatever login each CLI already
  has. The sidebar and the agent menu show whether each one is installed and signed in. After
  installing or signing in, press the recheck button next to Agents.
- **The agent menu** in the message box picks the agent, its model, its effort level, and what
  it may do: read-only, edit files, or full access (edits and commands without asking).
- **Switching agents** keeps one conversation. Each agent keeps its own CLI session, and when
  you switch, the new agent is given the turns it missed.
- **The + button** adds files and photos to a message (you can also paste or drop them). They
  are saved under `data/uploads/` and the agent is pointed at them; Codex also receives images
  as image input.
- **Projects** replace loose chats. A project is a folder on your computer, and every agent
  you chat with in it reads, writes and runs in that folder. With no project yet, the app asks
  you to create one: give it a name, and its folder is created under `~/Code Merger Projects`
  (or enter the path of a folder you already have). Chats and automations live inside a
  project. Deleting a project removes it from the app and leaves the folder on disk.
- **Usage** (bottom of the sidebar) shows each active agent's 5-hour and weekly limits with
  their reset times, as the agent's own CLI reports them. Claude Code reports its limits with
  each reply, so its bars appear after the first message; Codex records them on disk, so they
  show straight away. Agents that report nothing show a count of replies from this app instead.
- **Inbox, Notes, Automations** sit at the top of the sidebar, and all start empty.
  - *Notes* are plain notes you write, saved as you type.
  - *Automations* are instructions you write for an agent, run on a schedule (daily at a set
    time, every few minutes, or only when you press run). Each run is a new chat. They only run
    while Code Merger is running, and runs missed while it was off are skipped.
  - *Inbox* is where the result of each automation run arrives.
- Everything is stored as JSON in `data/` (`projects.json`, `chats/`, `notes.json`, `automations.json`, `inbox.json`, `usage.json`).

The server only listens on `127.0.0.1`, and `proxy.ts` rejects requests from other sites.

## Layout

| Path | What lives there |
| --- | --- |
| `app/page.tsx`, `components/` | The interface, built from the shadcn components in `components/ui/` |
| `hooks/use-chats.ts` | Client state: agents, chat list, the open chat and its live reply |
| `app/api/` | Route handlers: agents, chats, messages, the events stream, stop |
| `lib/server/agents.ts` | One adapter per agent CLI: how to invoke it and parse its output |
| `lib/server/runner.ts` | Runs a turn, hands context over between agents, streams the reply |
| `lib/server/store.ts` | Chats on disk and the turns currently running |
| `app/globals.css` | The glass theme: translucent colour tokens, the background wash, and the `glass` utility |
| `lib/server/automations.ts`, `instrumentation.ts` | Automation validation, runs, and the scheduler started with the server |

Add more shadcn components with `npx shadcn@latest add <name>`.

## Adding another agent

Any CLI that takes a prompt and prints an answer can be added in `data/agents.json`:

```json
[
  { "id": "aider", "name": "Aider", "command": "aider", "args": ["--message", "{prompt}", "--no-stream"] }
]
```

If no argument contains `{prompt}`, the prompt is sent on stdin. For streaming, tool
activity and resumable sessions, add a full adapter in `lib/server/agents.ts`.
