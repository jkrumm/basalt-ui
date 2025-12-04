We are going to build Basalt UI in my github repo `basalt-ui` my github and npm username is `jkrumm` as a Bun workspace monorepo with one package (`web`, `theme`, `core`), then let the `theme` package own all Tailwind, color (zinc), font, normalize, and dark/light concerns, while `core` and `web` just consume that design system. Bun workspaces handle linking and local development; GitHub Actions can later publish `@basalt-ui/theme` and `@basalt-ui/core` to the `@basalt-ui` scope on npm.[1][2][3]

## Monorepo and workspace layout

1. **Repo identity and naming**
    - Repo: `github.com/jkrumm/basalt-ui`, README and description clearly say “Basalt UI – Warm, professional design system and React components.”
    - npm scope: `@basalt-ui` for all public packages (`@basalt-ui/theme`, `@basalt-ui/core`), matching the brand story you outlined.
    - Domains/handles: `basalt-ui.com` for docs + landing, npm org `@basalt-ui`, GitHub repo `jkrumm/basalt-ui` (no code dependency, just branding alignment).

2. **Workspace structure with Bun**
    - Root `package.json`:
        - `"private": true` and `"workspaces": ["packages/*"]` to declare a Bun monorepo.[2][1]
        - No root `dependencies` if possible; each package (`web`, `theme`, `core`) declares its own.
    - Directory layout:
        - `packages/theme` → `@basalt-ui/theme` (Tailwind preset + CSS tokens + fonts + normalize + dark/light support).
        - `packages/core` → `@basalt-ui/core` (React components, later wired to Tailwind classes from `theme`).
        - `packages/web` → Astro app for `basalt-ui.com` (landing + docs + playground).
    - Add workspace dependencies:
        - `web` depends on `"@basalt-ui/core": "workspace:*"` and `"@basalt-ui/theme": "workspace:*"`.
        - `core` depends on `"@basalt-ui/theme": "workspace:*"` so components can assume tokens/util classes from the shared theme.[2]

3. **Global scripts and dev loops**
    - Root scripts (just as orchestration):
        - `dev:web` → runs Astro dev server in `web`.
        - `dev:core` → runs Storybook or a simple Vite/Next dev for core later (or skip for v0).
        - `dev` → at minimum, runs `dev:web` so you have a live playground that uses real `theme` + `core`.
    - Standard workflow:
        - Always run `bun install` from the repo root; Bun installs and deduplicates all workspace deps.[1]
        - Use `bun --filter web dev` / `bun --filter @basalt-ui/theme test` etc. for workspace-scoped commands once things get bigger.[4][5]

## Theme package (@basalt-ui/theme)

4. **Package design goals**
    - Primary responsibility: define **tokens and base styling**, not UI components:
        - Tailwind preset (zinc-based palette, radii, spacing scale).
        - Global CSS file with:
            - CSS variables for colors, radius, fonts.
            - Dark/light theme definitions using `.dark` class convention.
            - Base `body`, headings, typography, code styles, normalize-ish reset.
            - `font-family` variables wired to Lato / Nunito Sans / JetBrains Mono.
    - Keep implementation minimal at first:
        - Solid structure and build pipeline.
        - Only essential tokens and basic global styles; add detailed theming token-by-token later.

5. **Color system: zinc instead of stone**
    - Base Tailwind color family: **zinc** (not stone); configure:
        - Use zinc scale (50–950) for neutrals; warm up certain tokens (e.g., foreground, border) slightly via HSL tweaks if desired.
        - Map design tokens like `--background`, `--foreground`, `--primary`, `--muted`, `--border` to zinc values.[6][3]
    - Light theme:
        - Background ~ `zinc-50` / `zinc-100`.
        - Foreground ~ `zinc-900`.
        - Borders ~ `zinc-200` / `zinc-300`.
    - Dark theme:
        - Background ~ `zinc-950` (but optionally lifted to feel less “black”).
        - Surfaces ~ `zinc-900` / `zinc-800`.
        - Text ~ `zinc-50` / `zinc-100`.
    - Task: define a small mapping table in your docs (even if you don’t fully implement now) of **design tokens → zinc steps** so you have a spec to code against later.

6. **Typography and fonts responsibility**
    - Fonts chosen:
        - Lato → headings.
        - Nunito Sans → body.
        - JetBrains Mono → code, technical UI.
    - Plan for font loading:
        - Decide whether to:
            - a) Self-host `.woff2` assets inside `@basalt-ui/theme`, or
            - b) Reference a stable CDN (e.g., Google Fonts) and let the consuming app add `<link rel="preload">` tags.
        - Best practice: preload **only critical regular weights** (e.g., Lato 600, Nunito Sans 400, JetBrains Mono 400) for above-the-fold areas to minimize layout shifts and avoid over-preloading.[7][8]
    - CSS responsibilities of `theme`:
        - Define `--font-sans`, `--font-heading`, `--font-body`, `--font-mono` variables.
        - Set `body { font-family: var(--font-body); }` and headings to `var(--font-heading)`.
        - Provide recommended `<link rel="preload">` snippets in README for consumers, rather than forcing them inside distributed CSS (better control per-app).[7]

7. **Normalize / reset and dark-mode contract**
    - Theme provides:
        - A normalize/reset layer: margins, `box-sizing`, consistent default line-heights and `font-smoothing`.
        - Base typography: heading sizes scale, paragraphs, code blocks, list spacing.
        - Dark mode contract:
            - Uses `.dark` on `<html>` or `<body>` to switch token values.
            - Does **not** implement theme toggling logic; consuming app handles toggling (e.g., via localStorage + a React component).
    - Task list:
        - Specify the **exact selectors** the theme will own (`*`, `body`, `html`, `h1–h6`, `p`, `a`, `code`, `pre`, etc.).
        - Specify **what it will not touch** (e.g., forms, layout, grid gaps) to keep the theme focused.

8. **Tailwind preset structure**
    - Decide on Tailwind major version to target first (likely v3 for now, can later adapt to v4’s new CSS-first model):
        - Provide a preset export consumed as: `presets: [require('@basalt-ui/theme/tailwind')]` or ESM equivalent.[3]
    - Preset responsibilities:
        - Wire Tailwind `theme.extend` to CSS variables (`background`, `foreground`, `primary`, etc.).
        - Add font families mapping to your variables.
        - Add a **very small** spacing and radius extension to match Basalt identity (rounded but not pill-shaped).
    - Plan in writing:
        - List which Tailwind sections you plan to extend: `colors`, `borderRadius`, `fontFamily`, maybe `boxShadow` later.
        - Decide naming patterns: e.g., `brand` or just use the generic tokens (`background`, `muted`, etc.) for shadcn compatibility later.

## Core package (@basalt-ui/core)

9. **Role of `@basalt-ui/core`**
    - Primary responsibility: React components using Tailwind classes from `theme`:
        - Buttons, cards, inputs, layout primitives, etc.
        - All styled **only using the tokens/utilities** provided by `@basalt-ui/theme`.
    - For now, keep it minimal:
        - Just set up structure, build pipeline, and an example or two (or even 0 components if you only want the skeleton).
        - Ensure it compiles cleanly as an ESM React library that expects Tailwind + theme to be present in the consuming app.

10. **Dependencies and structure**
- `core` depends on:
    - React, React DOM, TypeScript.
    - `@basalt-ui/theme` as `workspace:*` and as a `peerDependency` in `core`’s `package.json` (so external consumers must install the theme explicitly).
- File layout:
    - `src/components/` for all React components.
    - `src/index.ts` re-exporting the public API.
- Design principle:
    - No global CSS authored here; all visual styling expressed through Tailwind class names that rely on `@basalt-ui/theme` preset + CSS tokens.

11. **Future-proofing for shadcn-style usage**
- While you might later adopt shadcn’s conventions, capture these decisions now in docs:
    - Variants handled via class-variance-authority (CVA) or similar, if you choose that path later.
    - Components expose only semantic props; no direct color values.
- Task list:
    - Write down a short “component philosophy” document in the repo: how Basalt UI components should use tokens, which utilities are allowed, etc., so future implementation adheres to the design system.

## Web docs app (basalt-ui.com)

12. **Role of `web`**
- Acts as:
    - Marketing landing page for Basalt UI (brand story, features).
    - Documentation site (getting started, theming, component API later).
    - Live playground that uses `@basalt-ui/theme` and `@basalt-ui/core` exactly as external consumers should.
- Tech stack:
    - Astro for static site generation + islands for React demos.
    - Uses workspace dependencies: `@basalt-ui/theme` and `@basalt-ui/core` via `"workspace:*"` to dogfood your own packages.[9][10][11]

13. **Astro + Tailwind + theme integration plan**
- In `web`:
    - Install Astro Tailwind integration and React integration.
    - Tailwind config:
        - Uses `@basalt-ui/theme` preset (no local color definitions).
        - `content` paths cover Astro + React islands.
    - Global CSS:
        - Imports Basalt theme CSS (so fonts, normalize, and dark/light tokens apply site-wide).
- Tasks:
    - Define exactly where you will import global CSS (root layout, main Astro page, or a dedicated layout component).
    - Decide whether the docs site will add any **extra Tailwind utilities** beyond what the theme provides; preferably keep it minimal and doc-focused.

14. **Font preload and FOUT mitigation in `web`**
- Because you care about font flicker, the **web app** should:
    - Add `<link rel="preload">` tags for main font files in the Astro head (Lato headings, Nunito Sans body, JetBrains Mono code).[8][7]
    - Ensure font CSS uses `font-display: swap` or similar, to avoid invisible text during load.
- Implementation plan:
    - Decide: Where will font files live?
        - If self-hosted in `@basalt-ui/theme`, `web` preloads them using URLs from that package.
        - If using Google Fonts, `web` preloads CDNs fonts with matching URLs to your `@import` CSS.[7]
    - Document in README:
        - A “Font Loading” section that explains recommended `<link rel="preload">` tags and how to keep them in sync with the theme’s CSS.

15. **Playground / examples**
- Plan a simple initial playground:
    - A page showing typography scale, color tiles (zinc-based), and a few example components (once `core` exists).
    - A theme toggle (light/dark) that manipulates the `.dark` class and persists to `localStorage`, demonstrating the theme contract.
- Split docs into sections:
    - Getting Started (install, Tailwind config, CSS import).
    - Theming (tokens overview, zinc palette).
    - Typography (Lato + Nunito Sans + JetBrains Mono usage and examples).
    - React Core (later).

## Release, publishing, and next steps

16. **Versioning and publishing strategy**
- Packages to publish:
    - `@basalt-ui/theme` – always publishable standalone.
    - `@basalt-ui/core` – depends on `@basalt-ui/theme`; version compat guidelines needed later.
- Use Bun for publishing:
    - `bun publish` from inside each package, or orchestrated via root scripts and GitHub Actions; Bun natively supports npm publishing workflows.[12][13]
- Tasks:
    - Set `"publishConfig"` in `theme` and `core` to the `@basalt-ui` scope and ensure `access: "public"`.
    - Create an internal checklist: “Before release” (lint, build, test, docs updated, version bump).

17. **GitHub Actions outline (without full YAML)**
- Workflows to plan:
    - CI: install + build all workspaces on PRs to `main`.
    - Publish: on release tag or manual dispatch:
        - Build `@basalt-ui/theme` and publish if version is ahead of npm.
        - Same for `@basalt-ui/core`, with dependency on theme publish if needed.
- Security:
    - Store `NPM_TOKEN` as a GitHub Actions secret.
    - Use the `oven-sh/setup-bun` action to set up Bun before running scripts.[14][12]

18. **Documentation and “source of truth”**
- Maintain a `/docs` or `/design` folder in the repo that contains:
    - Color token mapping table (zinc steps).
    - Typography scale and font usage rules.
    - Spacing/radius philosophy.
    - Component design principles.
- This keeps implementation and concept in sync, and gives you something to refer back to when you implement the actual theme and components later.

If you want, the next step can be: define a concrete “v0 milestone” checklist (what exactly must exist for you to ship `@basalt-ui/theme@0.1.0` and have a minimal `basalt-ui.com` up), and then iterate feature by feature from there.

[1](https://bun.com/docs/pm/workspaces)
[2](https://bun.com/docs/guides/install/workspaces)
[3](https://v3.tailwindcss.com/docs/presets)
[4](https://www.fgbyte.com/blog/02-bun-turborepo-hell/)
[5](https://www.newline.co/@szaranger/exploring-the-benefits-of-using-a-bun-monorepo--6588e031)
[6](https://tailwindcss.com/docs/theme)
[7](https://wp-rocket.me/blog/font-preloading-best-practices/)
[8](https://tools.syrup.dev/tools/typography-pairing)
[9](https://ui.shadcn.com/docs/installation/astro)
[10](https://www.reddit.com/r/astrojs/comments/1ivtu4t/shadcn_and_astro_where_should_i_add_tailwind/)
[11](https://astro.build/themes/details/astro-tailwindcss-shadcnui-template/)
[12](https://bun.com/docs/pm/cli/publish)
[13](https://github.com/oven-sh/bun/discussions/5365)
[14](https://github.com/jcbhmr/hello-world-bun-action)
[15](https://dev.to/vikkio88/monorepo-with-bun-474n)
[16](https://github.com/oven-sh/bun/issues/7547)
[17](https://www.youtube.com/watch?v=P6orgeCy380)
[18](https://www.youtube.com/watch?v=AaZhspn7-MM)
[19](https://stackoverflow.com/questions/59776906/how-do-i-change-vs-code-settings-to-use-jetbrains-mono-font)
[20](https://www.reddit.com/r/bun/comments/1j91a76/managing_a_monorepo_with_bun/)
[21](https://github.com/tailwindlabs/tailwindcss/discussions/18543)
[22](https://turborepo.com/docs/crafting-your-repository/structuring-a-repository)
[23](https://scottspence.com/posts/shared-tailwind-css-themes-in-svelte-monorepos)
[24](https://www.jetbrains.com/lp/mono/)
[25](https://nextjs.org/docs/app/getting-started/fonts)
[26](https://stackoverflow.com/questions/79499818/how-to-use-custom-color-themes-in-tailwindcss-v4)