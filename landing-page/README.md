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

The visible confirmed agents are Claude Code, Codex, and OpenCode. Gemini CLI has been removed from this website as requested, while its app adapter remains untouched. Cursor, Antigravity, Hermes, and Grok also appear in the agent list, labeled Coming soon until their app integrations are verified. The app is currently a local Node.js web app. macOS and Linux use the source bundle. Windows is marked unverified because the app's current CLI detection assumes executable commands without Windows extensions. Update these facts when the app changes.

`public/downloads/code-merger-source.zip` contains a source-only development snapshot of the current Next.js app, its components, routes, package lockfile, and required configuration. It excludes chats, user data, working folders, credentials, installed packages, build artifacts, and this website. Extract, enter `code-merger`, run `npm install`, then `npm run dev`. Refresh the snapshot after app changes with `python3 scripts/bundle-source.py`.

## Design and components

The landing page implements the desktop and mobile designs in the Code Merger Figma redesign (file `ZfdmNsLBz7PWNiVJxvumZH`, hero `1:939`). Desktop uses left-aligned run-in copy, a right-hand agent list, floating navigation, and a platform footer. Mobile stacks the hero, actions, agents, and footer and allows scrolling. Original Figma icons are downloaded to `public/figma` and retain their intrinsic sizes.

The desktop and mobile Figma frames now use two faint monochrome radial glows instead of the pixel horse. `AmbientBackdrop` uses the original local SVG exports in `public/figma/ambient-*.svg`, with the Figma geometry and exported 24-second looping opacity tracks. Both animations share one timeline and stop when reduced motion is preferred. The former horse geometry and hundreds of animation tracks have been removed from the website.

UI primitives use official shadcn/ui components added through its CLI: Button, Card, Badge, Tooltip, and Sonner. Tailwind CSS 4 and neutral dark theme tokens style them. To add more components, run `npm exec --yes --package shadcn@latest -- shadcn add COMPONENT` from this folder; the registry configuration is in `components.json`. Component utility imports should resolve to `@/lib/utils`.

The page is a Server Component. The main download button detects the user's platform and chooses a verified native installer if configured, otherwise it downloads the source ZIP. Platform links download their configured files directly. Unsupported platforms are explicitly marked unverified. The GitHub button uses Sonner to show an availability notice until the repository URL is supplied. An integrated star count inside it shows an em dash placeholder now. When `product.githubUrl` is configured with a public GitHub repository, the badge reads `stargazers_count` from GitHub's public repository API on load, every five minutes while visible, and when the tab becomes visible. Failed requests retain the last successful count; no token is exposed to the browser. Radix handles composed button links and tooltips. Animations respect reduced-motion preferences. Content and source downloads remain available without JavaScript. Metadata and the favicon use Next.js conventions. Google Fonts is optional and falls back to system fonts.

To regenerate the equal-size agent SVG frames after changing brand artwork, run `node scripts/normalize-brand-icons.mjs` from this directory. Original artwork stays in `public/brands/`; the current landing page uses the original Figma exports in `public/figma/`.
