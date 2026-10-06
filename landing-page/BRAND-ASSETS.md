The landing page serves brand SVGs locally from `public/brands/`. These identify
supported agents, platform downloads, and the GitHub action. All trademarks
remain the property of their respective owners.

| Asset | Source |
| --- | --- |
| Claude | [Claude official website](https://claude.com/) — starburst path from its inline logo, with the icon's own viewBox and original terracotta fill |
| OpenAI (Codex) | [OpenAI design guidelines](https://openai.com/brand/) — white monoblossom from the [official logo bundle](https://cdn.openai.com/brand/OpenAI-Logos-2025.zip) |
| OpenCode | [OpenCode brand kit](https://opencode.ai/brand) — dark-background square SVG supplied by the site's download action |
| Cursor | [Cursor brand guidelines](https://cursor.com/brand) — standalone cube from its official dark-background avatar SVG, excluding the surrounding presentation canvas |
| Antigravity | [Google Antigravity press kit](https://antigravity.google/press) — [official full-colour icon](https://antigravity.google/assets/image/brand/antigravity-icon__full-color.svg) |
| Hermes | [Hermes Agent official website](https://hermes-agent.nousresearch.com/) — [wing mark](https://web-assets.nousresearch.com/nousnet-web/assets/hermes-landing/teams/hermes-wing.6ee276e9bff5a166.svg), at the same 45-degree angle as its navigation logo |
| Grok | [Grok official website](https://grok.com/) — the two icon paths identified as `mark` in its inline logo, with white fill |
| GitHub | [GitHub brand toolkit](https://brand.github.com/foundations/logo) — white Invertocat from the [official logo bundle](https://brand.github.com/GitHub_Logos.zip) |
| Apple | [Apple official website](https://www.apple.com/) — inline navigation logo with surrounding navigation whitespace removed and white fill |
| Linux | [Simple Icons 14.15.0 Linux SVG](https://github.com/simple-icons/simple-icons/blob/14.15.0/icons/linux.svg) — Tux brand artwork, white fill |
| Windows | [Simple Icons 11.15.0 Windows 11 SVG](https://github.com/simple-icons/simple-icons/blob/11.15.0/icons/windows11.svg) — Windows 11 brand artwork, white fill |

`scripts/normalize-brand-icons.mjs` measures the transparent margins of each
agent SVG and writes copies in `public/brands/agents/` with equal square frames.
Every mark occupies the same visible maximum dimension, with 4% breathing room.
The paths, colours, and proportions are preserved. This accounts for assets
such as OpenAI's Blossom, which has more internal padding than other marks.

`BrandIcon` preserves each asset's aspect ratio. Its CSS grayscale filter keeps
artwork monochrome by default. The icon-only agent row removes that filter on
hover or keyboard focus to reveal each asset's original colours; naturally
monochrome brands stay monochrome. No text appears on agent hover. Agent names and upcoming status remain
available to screen readers through `aria-label`.
Functional symbols such as Download, ArrowUpRight, and the Code Merger merge
mark continue to use Lucide; they do not represent third-party brands.
