# Code Merger landing page

A responsive one-page product site built with Next.js 16, React 19, and the App Router. This folder is isolated from the application's files.

## Local development

Both the website and the downloadable Code Merger app need Node.js 20.9 or newer.

```sh
cd landing-page
npm ci
npm run dev
```

Open http://127.0.0.1:5198. The preview port is separate from the application.

```sh
npm run build
npm start
```

## Deploy on Vercel

Import your repository in Vercel and set **Root Directory** to `landing-page`. The framework is **Next.js**, the build command is `npm run build`, and the install command is `npm ci`. Leave the output directory at its framework default. No environment variables or custom server are required. Production: https://landing-page-ebon-theta-82.vercel.app. Deploy this folder with `npx vercel deploy --prod`.

## Product details

Edit `lib/product.js` with the public GitHub URL and release/download URLs when available. All GitHub links use that single value. Until supplied, they show an explicit coming-soon message.

The visible confirmed agents are Claude Code, Codex, and OpenCode. Gemini CLI has been removed from this website as requested, while its app adapter remains untouched. Cursor, Antigravity, Hermes, and Grok also appear in the icon row; their screen-reader labels identify them as Coming soon until their app integrations are verified. The app is currently a local Node.js web app. macOS and Linux use the source bundle. Windows is marked unverified because the app's current CLI detection assumes executable commands without Windows extensions. Update these facts when the app changes.

`public/downloads/code-merger-source.zip` contains a source-only development snapshot of the current Next.js app, its components, routes, package lockfile, and required configuration. It excludes chats, user data, working folders, credentials, installed packages, build artifacts, and this website. Extract, enter `code-merger`, run `npm install`, then `npm run dev`. Refresh the snapshot after app changes with `python3 scripts/bundle-source.py`.

## Design and components

A single viewport with no page scrolling, inspired by https://www.usemono.dev: a larger centered headline, pill-shaped download and GitHub buttons, seven tightly spaced agent icons immediately below, and direct platform download links at the bottom. All agent artwork is framed to the same visible size, accounting for transparent padding inside the SVGs. Agents appear as icons only, monochrome at rest; hover and keyboard focus reveal their original brand colours without showing text. Accessible names remain on the icon controls. Naturally monochrome brand artwork stays monochrome. The decorative background uses slow CSS-only ambient light gradients and a faint grid. Reduced-motion preferences disable the animation.

UI primitives use official shadcn/ui components added through its CLI: Button, Card, Badge, Tooltip, and Sonner. Tailwind CSS 4 and neutral dark theme tokens style them. To add more components, run `npm exec --yes --package shadcn@latest -- shadcn add COMPONENT` from this folder; the registry configuration is in `components.json`. Component utility imports should resolve to `@/lib/utils`.

The page is a Server Component. The main download button detects the user's platform and chooses a verified native installer if configured, otherwise it downloads the source ZIP. Platform links download their configured files directly. Unsupported platforms are explicitly marked unverified. The GitHub button uses Sonner to show an availability notice until the repository URL is supplied. A star-count badge beside it shows an em dash placeholder now. When `product.githubUrl` is configured with a public GitHub repository, the badge reads `stargazers_count` from GitHub's public repository API on load, every five minutes while visible, and when the tab becomes visible. Failed requests retain the last successful count; no token is exposed to the browser. Radix handles composed button links and tooltips. Animations respect reduced-motion preferences. Content and source downloads remain available without JavaScript. Metadata and the favicon use Next.js conventions. Google Fonts is optional and falls back to system fonts.

To regenerate the equal-size agent SVG frames after changing brand artwork, run `node scripts/normalize-brand-icons.mjs` from this directory. Original artwork stays in `public/brands/`; the agent row uses the framed copies in `public/brands/agents/`.
