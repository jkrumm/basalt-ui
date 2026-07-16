---
name: basalt-app
description: Scaffold or refresh a basalt-ui app — guided wrapper around 'basalt init' (first-time scaffold) and 'basalt sync' (drift-managed refresh). Hard-states that the plugin and 'basalt init' are a mandatory PAIR — the plugin ships skills, init ships the project doctrine (rules + CLAUDE block + DESIGN.md) that a plugin cannot. Use when setting up basalt-ui in a new/existing app, wiring the provider/shell/vite preset, or when the doctrine feels missing.
when_to_use: User is adding basalt-ui to a new or existing app, asks how to set it up / scaffold it, wants to wire BasaltProvider / BasaltShell / the vite preset, refresh the shipped rules and DESIGN.md, or run a freshness check in CI. Also when /basalt:design reports no consumer DESIGN.md (the app isn't scaffolded yet).
---

`/basalt:app` scaffolds a basalt-ui consumer and keeps its shipped doctrine fresh. It wraps the two
CLI subcommands — `basalt init` (first run) and `basalt sync` (refresh) — and explains the wiring
they don't do for you (provider, shell, vite). All of it via `bunx basalt` (Bun runtime).

## Two channels: the plugin (skills) + `basalt init` (repo doctrine)

The agentic layer is two complementary channels with different lifecycles:

| Channel | Ships | Mechanism |
|-|-|-|
| **Plugin** (this) | The three skills: `/basalt:design`, `/basalt:charts`, `/basalt:app` | installed **once at user scope** — available in every project, auto-updates |
| **`basalt init`** | The repo doctrine: `.claude/rules/basalt-*.md`, the managed CLAUDE block, the thin `DESIGN.md`, oxfmt/lefthook/CI templates | `bunx basalt init` writes them into each repo |

A Claude Code plugin **cannot** ship project context (no `CLAUDE.md`, no `.claude/rules/`, no
`DESIGN.md`) — that is why doctrine is a separate, per-repo `init`. And a project `.claude/settings.json`
**cannot auto-install** a plugin (it only *enables* an already-installed one), so the plugin is a
one-time **user-scope** install, not something `init` writes per project.

- **Install the plugin once (user scope → every project, auto-updates):**
  ```
  claude plugin marketplace add jkrumm/basalt-ui
  claude plugin install basalt@basalt-ui     # enable auto-update when prompted
  ```
  Equivalently, add it to `~/.claude/settings.json` with `"autoUpdate": true` on the marketplace.
- **Run `bunx basalt init` once per consumer repo** for the doctrine, then `bunx basalt sync` after
  a basalt-ui upgrade.

Skills without `init` degrade to generic advice (no `DESIGN.md`/rules to obey); `init` without the
plugin still loads the rules as project context, but the design/charts *workflows* aren't a slash
command away. Do both: plugin once, `init` per repo.

## First-time scaffold: `bunx basalt init`

`init` writes the repo-side doctrine and toolchain into a consumer (monorepo globs supported):

- `.claude/rules/basalt-*.md` — the twelve shipped rules (`basalt-tokens`, `basalt-charts`,
  `basalt-mantine`, `basalt-router`, `basalt-query`, `basalt-state`, `basalt-forms`,
  `basalt-notifications`, `basalt-commands`, `basalt-data`, `basalt-agent`, `basalt-content`),
  whole-file managed and copied verbatim with a `source: basalt-ui` header (no version).
- A managed `<!-- basalt:begin --> ... <!-- basalt:end -->` block in `CLAUDE.md`: stack facts, the
  **DESIGN.md-is-law** pointer, and the **frontend-design restraint override** (in a dashboard, the
  bold move is calm — defer to `/basalt:design`, not generic "make it striking" instincts).
- A **thin** `DESIGN.md` seed (deltas only on top of the `basalt-*` rules): identity confirmation,
  the series dictionary, app deviations. The CLAUDE block `@`-imports it, so it auto-loads.
- Toolchain templates with no `extends` mechanism: `.oxfmtrc.json` (reconciled by every `sync`),
  and `lefthook.yml` / `check.yml` (seeded once, then yours — CI and hooks are inherently
  repo-shaped, so `sync` never overwrites your edits or reports them as drift). (The oxlint preset
  is consumed via `"extends": ["./node_modules/basalt-ui/configs/oxlint.json"]`, not copied.)
- `.basalt/manifest.json` — a sha256 per managed file, so `sync` can do a three-way diff later.

After `init`, do the runtime wiring (the CLI scaffolds files, not your app's composition):

```tsx
// Provider — wraps MantineProvider, injects the --vx-* palette, bridges the Vx tokens
import { BasaltProvider } from 'basalt-ui'
<BasaltProvider>{/* app */}</BasaltProvider>

// Shell — sidebar / mobile-nav / breadcrumbs / page-header; router-agnostic
import { BasaltShell, NavCountBadge, ThemeToggle } from 'basalt-ui'
// <ThemeToggle /> in globalActions — cycles light/dark/system on click, hover/focus reveals
// a direct-select popover. Animated (motion) sun/moon glyph, never a computer/monitor icon.

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
doctrine. The consumer series
file (`src/theme/series.ts`) is the single guard-exempt palette source — see `/basalt:charts`.

## Refresh: `bunx basalt sync`

`sync` re-applies shipped doctrine after a basalt-ui upgrade, three-way against
`.basalt/manifest.json`:

- **Unchanged since last write** → overwrite with the new version.
- **Locally edited** → show a diff and **skip** (preserves your edits) unless `--force`.
- **Missing** → recreate.
- `sync --check` makes no changes and exits non-zero on drift — wire it as a CI freshness gate so a
  consumer can't silently fall behind the shipped rules.

The thin `DESIGN.md` is yours to edit (deltas only), and so are `lefthook.yml` / `check.yml` —
all three are seeded once by `init` and never reconciled or drift-reported by `sync`. The
`basalt-*` rules, the managed CLAUDE block, and `.oxfmtrc.json` are framework-owned and meant to be
overwritten.

## Precedence the scaffold establishes

After scaffolding, the doctrine resolves in this order (highest wins):

> consumer `DESIGN.md` (deltas) > shipped `basalt-*` rules > skills

So an app deviation goes in `DESIGN.md`; the universal law and its enforcement live in the
`basalt-*` rules; and the skills (`/basalt:design`, `/basalt:charts`) are the method that obeys
both.

## Checklist

- Ran `bunx basalt init` (doctrine in the repo) AND the plugin is enabled (skills available) —
  **both halves of the pair**, not one.
- `BasaltProvider` wraps the app; `createBasaltTheme` used for theme deltas; `basalt-ui/styles.css`
  imported.
- `basaltViteConfig` adopted; `oxlint . && basalt check-theme` is the lint command.
- A thin `DESIGN.md` (deltas) + the twelve `basalt-*` rules + the managed CLAUDE block are present.
- `src/theme/series.ts` exists as the one guard-exempt series source (for any app metric colors).
- `basalt sync --check` wired in CI (recommended) to catch drift on future upgrades.

## Notes

- `init`, `sync`, and `check-theme` are all **real**. `init` scaffolds the doctrine and prints a
  one-time hint to install the `basalt` plugin; `sync` reconciles via a sha256 three-way diff
  (`--check` is a CI drift gate, `--force` overwrites local edits); `check-theme` is the palette
  guard. All via `bunx basalt …`.
- The framework ships **no** icon or notification dep — pass icons as `ReactNode` and wire toasts
  yourself (e.g. `ThemeLabControls`' `copyIcon` / `onCopy`).
- The framework DOES ship `motion` (motion.dev, formerly framer-motion) as a bundled dependency —
  animated chrome (`ThemeToggle` today) comes for free, no consumer dependency needed. Reach for
  the shared `MOTION_DURATION` / `MOTION_SPRING` tokens for any new animated interaction rather
  than inventing ad hoc durations/easings or a competing animation library.
