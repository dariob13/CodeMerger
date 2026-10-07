# Skills in chat

Click **Skills** beside the agent picker, or type `/` into an empty message, to browse installed agent skills. Search by name or description, then click a result or use the arrow keys and Enter. Select up to five skills; remove a selection with its chip's × button. You can send a skill with a message, attachments, or by itself.

Selections apply to the next message and are kept separately for each project and agent in an open chat tab. Sent messages display the selected skills. Retry uses the original selection again. Switching agents carries the earlier skill names and file references in the conversation history.

## Discovery

Every agent can use shared skills under `.agents/skills` in the project and home folder. Within a Git repository, discovery also checks the project's parent directories up to the repository root. Each skill needs a UTF-8 `SKILL.md` with YAML frontmatter containing a description and an optional name (defaults to its folder name). Definitions marked `user-invocable: false` are hidden.

The picker also checks these locations for matching registered agent IDs:

| Agent | Additional locations |
| --- | --- |
| Codex | `$CODEX_HOME/skills` (defaults to `~/.codex/skills`), its `.system` folder, `/etc/codex/skills`, and enabled plugins in the Codex plugin cache |
| Claude Code | Project `.claude/skills`, `$CLAUDE_CONFIG_DIR/skills` (defaults to `~/.claude/skills`), and installed plugins that are not disabled in settings |
| OpenCode | Project `.opencode/skills` and `.claude/skills`, `$XDG_CONFIG_HOME/opencode/skills` (defaults to `~/.config/opencode/skills`), and `~/.claude/skills` |
| Gemini CLI | Project `.gemini/skills` and `~/.gemini/skills` |

Nested skill collections and symlinked skill folders are supported. Codex `skills.config` entries with `enabled = false` are excluded. Invalid, binary, and oversized definitions are skipped. Refresh the picker after installing or editing skills; reopening it also refreshes the catalog.

Native skill documentation: [Codex](https://developers.openai.com/codex/skills/), [Claude Code](https://code.claude.com/docs/en/skills), [OpenCode](https://opencode.ai/docs/skills/), [Gemini CLI](https://geminicli.com/docs/cli/skills/).

## Backend behavior

`GET /api/projects/:id/skills?agent=:agent` returns metadata and opaque skill IDs. Message requests send these IDs, which the backend resolves against the current project's and agent's available skills. Arbitrary paths and unavailable selections are rejected before starting a run.

The runner supplies selected instructions to the CLI for that message, including each skill's directory for resolving relative references. It asks the agent to use its native skill mechanism where available. Large instructions beyond a combined 32 KB prompt budget are supplied as validated file references for the agent to read. Agent access and permission settings still apply. Chat storage keeps skill names, IDs, and paths rather than copies of their instructions.

`npm run test:workspace` checks discovery, scoping, validation, instruction delivery, retry, persistence, and conversation handoff using an isolated local fixture agent. Tests use separate Next build directories and temporary skill folders. `CODE_MERGER_SKILLS_HOME` overrides the home directory for fixture discovery.
