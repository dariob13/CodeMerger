# Workspace

The workspace implements the [Sessions](https://www.figma.com/design/ZfdmNsLBz7PWNiVJxvumZH?node-id=40-121), [Explorer](https://www.figma.com/design/ZfdmNsLBz7PWNiVJxvumZH?node-id=40-474), and [Changes](https://www.figma.com/design/ZfdmNsLBz7PWNiVJxvumZH?node-id=40-827) panels from the Code Merger Figma file. The desktop panel is 272 px wide; its exported SVG assets live in `public/workspace`. On smaller screens, the header opens the same workspace in a drawer.

All data is scoped to the selected project's saved `cwd`:

- Sessions show real run status, the most recent model and tool activity, elapsed time, and persisted unread state. Opening or stopping a session uses the existing chat backend. The workspace polls every 2.5 seconds and refreshes on window focus, including runs started by automations.
- Explorer reads directories lazily and searches file paths recursively. It omits `.git`, `node_modules`, `.next`, and symlinks. File previews use syntax highlighting; Edit and Save write UTF-8 text up to 2 MB. New file creates without overwriting. Saves compare a SHA-256 version against disk and return 409 if an agent or another editor changed the file. Close and reopen a conflicting file to reload it. Unsaved documents remain in memory per project, with a confirmation before closing or unloading.
- Changes reads Git status, separate index and working-tree diffs, line counts, branch tracking, and the latest 30 commits. Each row opens its diff; history opens the commit diff. Stage/unstage supports individual files or a section. Commit includes only staged changes. Nested projects reject commits that would include staged files outside their folder. Push uses the branch's configured upstream and never forces.
- Draft calls a connected agent's existing read-only adapter with the staged diff. It prefers Claude when connected, otherwise the current agent, and uses the selected model. CLI installation, credentials, and a configured upstream are supplied by the existing local environment.

File and Git APIs validate the stored project, reject traversal and symlink escapes, and invoke Git without a shell. File/index mutations are serialized within a project. Project files are runtime inputs, so filesystem tracing intentionally excludes them from the Next.js build output.

## Validation

`npm run test:workspace` starts an isolated Next.js server and creates disposable projects, agent fixtures, and a local Git remote. It verifies actual file reads/search, create/save conflicts, invalid paths, binary handling, diffs, staging/unstaging, partially staged commits, agent drafting, unborn and nested repositories, push, unread persistence, and stopping a background run. It never uses the normal application data or a paid agent.

`WORKSPACE_TEST_PORT=4321` selects the test port. `KEEP_WORKSPACE_PREVIEW=1` retains the isolated fixture/server for manual UI inspection; the test output prints its location and URL.
