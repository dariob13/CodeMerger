"""Create a source-only snapshot of the app without chats, secrets or builds."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

site = Path(__file__).resolve().parents[1]
app = site.parent
destination = site / "public/downloads/code-merger-source.zip"
files = [app / name for name in (
    "package.json", "package-lock.json", "next.config.ts", "next.config.mjs",
    "postcss.config.mjs", "tsconfig.json", "next-env.d.ts", "components.json",
    "proxy.ts", "eslint.config.mjs", ".gitignore",
)]
extensions = {".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".svg", ".ico", ".png", ".jpg", ".webp"}
for directory in ("app", "components", "hooks", "lib", "public"):
    files.extend(path for path in (app / directory).rglob("*") if path.suffix in extensions)
files = sorted({path for path in files if path.is_file() and not path.is_symlink()})
destination.parent.mkdir(parents=True, exist_ok=True)
readme = """# Code Merger — source development snapshot

One chat for Claude Code, Codex, OpenCode, and Gemini CLI.
The app runs locally in your browser using your installed, signed-in agent CLIs.

## Start

Requires Node.js 20.9 or newer.
Extract this ZIP and open a terminal in the code-merger folder:

    npm install
    npm run dev

Open http://127.0.0.1:4317. Install and sign in to at least one agent CLI,
then use Recheck in the app to detect it.

For a production build:

    npm run build
    npm start

This is a development snapshot, not a native installer. macOS and Linux use
the same source package. Windows CLI detection has not yet been verified.
The bundle contains no conversations, user workspace files, credentials,
node_modules, build output, or landing-page source.
"""
with ZipFile(destination, "w", ZIP_DEFLATED) as archive:
    for path in files:
        archive.write(path, Path("code-merger") / path.relative_to(app))
    archive.writestr("code-merger/README.md", readme)
    assert archive.testzip() is None
print(f"Created {destination.name}: {len(files) + 1} source files, {destination.stat().st_size:,} bytes")
