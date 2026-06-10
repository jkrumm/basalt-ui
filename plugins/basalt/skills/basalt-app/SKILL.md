---
name: basalt-app
description: Scaffold or refresh a basalt-ui app — guided wrapper around 'basalt init' (first-time scaffold) and 'basalt sync' (drift-managed refresh). Hard-states that the plugin and 'basalt init' are a mandatory PAIR — the plugin ships skills, init ships the project doctrine (rules + CLAUDE block + DESIGN.md) that a plugin cannot. Use when setting up basalt-ui in a new/existing app, wiring the provider/shell/vite preset, or when the doctrine feels missing.
when-to-use: User is adding basalt-ui to a new or existing app, asks how to set it up / scaffold it, wants to wire BasaltProvider / BasaltShell / the vite preset, refresh the shipped rules and DESIGN.md, or run a freshness check in CI. Also when /basalt:design reports no consumer DESIGN.md (the app isn't scaffolded yet).
---

`/basalt:app` scaffolds a basalt-ui consumer and keeps its shipped doctrine fresh. It wraps the two
CLI subcommands — `basalt init` (first run) and `basalt sync` (refresh) — and explains the wiring
they don't do for you (provider, shell, vite). All of it via `bunx basalt` (Bun runtime).

## The plugin and `basalt init` are a MANDATORY PAIR (read this first)

This plugin ships **skills only**. A Claude Code plugin **cannot** ship project context — not a
`CLAUDE.md`, not `.claude/rules/`, not a `DESIGN.md`. That is by design: skills travel with the
*user*; doctrine must live in the *repo*. So the agentic layer is **two channels that are
worthless apart**:

| Channel | Ships | Mechanism |
|-|-|-|
| **Plugin** (this) | The three skills: `/basalt:design`, `/basalt:charts`, `/basalt:app` | repo-as-marketplace + `enabledPlugins` in `.claude/settings.json` |
| **`basalt init`** | The doctrine: `.claude/rules/basalt-*.md`, the managed CLAUDE block, the thin `DESIGN.md`, `DESIGN-CORE.md`, toolchain templates | `bunx basalt init` writes them into the repo |

- **Plugin without `basalt init` = skills with no doctrine to defer to.** `/basalt:design`'s very
  first step is "load the consumer `DESIGN.md`, then `DESIGN-CORE.md`" — neither exists until
  `init` writes them. The skill degrades to generic advice with nothing project-specific to obey.
- **`basalt init` without the plugin = doctrine no agent reaches via a slash command.** The rules
  still load as project context, but the design/charts/app *workflows* live in the skills.

Therefore: **always do both.** When scaffolding, run `bunx basalt init` AND ensure the plugin is
enabled (the `init` settings stanza wires `extraKnownMarketplaces` + `enabledPlugins` so this is one
step). If a user has only one, point out the missing half — this is the single most common setup
mistake and the skills silently underperform without the pair.

## First-time scaffold: `bunx basalt init`

`init` writes the repo-side doctrine and toolchain into a consumer (monorepo globs supported):

- `.claude/rules/basalt-*.md` — the six shipped rules (`basalt-tokens`, `basalt-charts`,
  `basalt-mantine`, `basalt-router`, `basalt-query`, `basalt-state`), whole-file managed with a
  `source: basalt-ui@<version>` header and parameterized `paths:`.
- A managed `<!-- basalt:begin --> ... <!-- basalt:end -->` block in `CLAUDE.md`: stack facts, the
  **DESIGN.md-is-law** pointer, and the **frontend-design restraint override** (in a dashboard, the
  bold move is calm — defer to `/basalt:design`, not generic "make it striking" instincts).
- A **thin** `DESIGN.md` instantiation ("extends basalt-ui core; deltas only"): identity
  confirmation, the series dictionary, app deviations. Plus `DESIGN-CORE.md` (the universal law).
- The `.claude/settings.json` stanza: `extraKnownMarketplaces` + `enabledPlugins` for the `basalt`
  plugin (this is the half that makes the plugin auto-available — the pairing, automated).
- Toolchain templates with no `extends` mechanism: `oxfmt.json`, `lefthook.yml`, `check.yml`. (The
  oxlint preset is consumed via `"extends": ["./node_modules/basalt-ui/configs/oxlint.json"]`, not
  copied.)
- `.basalt/manifest.json` — a sha256 per managed file, so `sync` can do a three-way diff later.

After `init`, do the runtime wiring (the CLI scaffolds files, not your app's composition):

```tsx
// Provider — wraps MantineProvider, injects the --vx-* palette, bridges the Vx tokens
import { BasaltProvider } from 'basalt-ui'
<BasaltProvider>{/* app */}</BasaltProvider>

// Shell — sidebar / mobile-nav / breadcrumbs / page-header; router-agnostic
import { BasaltShell, NavCountBadge } from 'basalt-ui'

// Theme — start from the base, override deltas only
import { createBasaltTheme } from 'basalt-ui'
const theme = createBasaltTheme({ /* app deltas */ })
```

```ts
// vite.config.ts — the shipped preset (dedupe react + @mantine/*, strictPort, /api proxy, BASALT_LOCAL alias)
import { basaltViteConfig } from 'basalt-ui/vite'
export default basaltViteConfig({ port: 5173, apiTarget: 'http://localhost:3000' })
```

```js
// Tailwind era is over — there is no Tailwind. Styles come from:
import 'basalt-ui/styles.css'   // @layer basalt base styles, iOS input safety net, font stack
```

Lint wires as `oxlint . && basalt check-theme` — the theme guard is the teeth behind the token
doctrine (`check-theme` is the one CLI subcommand that is fully real today). The consumer series
file (`lib/series.ts`) is the single guard-exempt palette source — see `/basalt:charts`.

## Refresh: `bunx basalt sync`

`sync` re-applies shipped doctrine after a basalt-ui upgrade, three-way against
`.basalt/manifest.json`:

- **Unchanged since last write** → overwrite with the new version.
- **Locally edited** → show a diff and **skip** (preserves your edits) unless `--force`.
- **Missing** → recreate.
- `sync --check` makes no changes and exits non-zero on drift — wire it as a CI freshness gate so a
  consumer can't silently fall behind the shipped rules.

The thin `DESIGN.md` is yours to edit (deltas only) and `sync` respects local edits there; the
`basalt-*` rules and the managed CLAUDE block are framework-owned and meant to be overwritten.

## Precedence the scaffold establishes

After scaffolding, the doctrine resolves in this order (highest wins):

> consumer `DESIGN.md` (deltas) > `DESIGN-CORE.md` > shipped `basalt-*` rules > skills

So an app deviation goes in `DESIGN.md`; a universal rule lives in `DESIGN-CORE.md`; enforcement
detail in the rules; and the skills (`/basalt:design`, `/basalt:charts`) are the method that obeys
all of it.

## Checklist

- Ran `bunx basalt init` (doctrine in the repo) AND the plugin is enabled (skills available) —
  **both halves of the pair**, not one.
- `BasaltProvider` wraps the app; `createBasaltTheme` used for theme deltas; `basalt-ui/styles.css`
  imported.
- `basaltViteConfig` adopted; `oxlint . && basalt check-theme` is the lint command.
- A thin `DESIGN.md` (deltas) + `DESIGN-CORE.md` + the six `basalt-*` rules + the managed CLAUDE
  block are present.
- `lib/series.ts` exists as the one guard-exempt series source (for any app metric colors).
- `basalt sync --check` wired in CI (recommended) to catch drift on future upgrades.

## Notes

- `init` / `sync` are S5 deliverables; today they print a not-yet-implemented stub. `check-theme`
  is real. When wiring CI now, you can use `bunx basalt check-theme` immediately; treat `init`/
  `sync` as the scaffold contract being built out.
- The framework ships **no** icon or notification dep — pass icons as `ReactNode` and wire toasts
  yourself (e.g. `ThemeLabControls`' `copyIcon` / `onCopy`).
