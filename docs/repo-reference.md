# Repo reference

Stack, structure, consolidation doctrine and principles. Read it when a change touches one of these; the root file does not need them on every task.

## Consolidation doctrine (2026-09)

- **Adopt-or-delete.** A public export needs a consumer outside `apps/playground` by the next
  minor after it ships, or it's on-notice in `MIGRATING.md`.
- **Net-negative waves.** A consolidation PR deletes more lines than it adds; a new export needs a
  named consumer in the brief.
- **One doctrine, one home.** Home = the most-enforced surface stating it (shipped rule > package
  MAINTAINING.md > guard JSDoc). Everything else is a one-line link. `check-agent-doc-drift.ts` covers
  `docs/**`, the package MAINTAINING.md and this file too.
- **Budgets are numbers**, checked by `scripts/check-budgets.ts` in `pre`: public symbols, published
  subpaths, shipped rule lines, spec prose, playground routes, `cli/index.ts` size.
- **Dogfood.** The repo loads its own shipped rules/skills; `apps/playground` lints on the shipped v3 app preset
  (`configs/oxlint-app.json`) and `/.oxlintrc.json` lints the package source on plain oxlint rules plus the import bans
  `scripts/gen-oxlint.ts` projects from `SURFACES`. The 2.x `basalt` lint plugin and its presets are retired.

- **Published subpaths, 1.29.0 (C1):** `./query`, `./connectivity` and `./data` are dropped —
  `./query`'s exports move to `.`/`./state`, `./connectivity` folds into `./provider`, `./data`
  folds into `./data` (table + virtual-list) staying but the barrel narrows. `./controls-dates`
  was deleted with the 2.x view layer (`removed-2x` rows). Full symbol-level
  mapping: `packages/basalt-ui/MIGRATING.md` § 2.x to 3.0.

## Tech Stack

- **Runtime**: Bun
- **Monorepo**: Bun workspaces (`packages/*`, `apps/*`)
- **UI**: Base UI (`@base-ui/react`, optional peer) on Tailwind 4
- **React**: 19 (peer)
- **Charts**: `@tanstack/charts` ~1.5.0 + `d3-scale` ^4.0.2 (optional peers of `./charts`)
- **Lint/format**: oxlint + oxfmt
- **Type-check**: tsc (strict)
- **Git**: conventional commits enforced via commitlint; lefthook pre-commit hooks
- **Release**: semantic-release via `make release` + npm provenance

## Structure

```
basalt-ui/
├── packages/basalt-ui/    # the ONLY published package (npm: basalt-ui)
├── apps/playground/        # @basalt-ui/playground — workspace:* consumer, everyday iteration surface
├── apps/expression/        # @basalt-ui/expression — the expression trial scenarios, a second consumer install
├── apps/marketing/         # basalt-ui.com — CONTENT-FROZEN until rebuilt on v3 post-migration
└── AGENTS.md               # you are here — the only agent file (no CLAUDE.md anywhere: it would suppress this one)
```

- `packages/basalt-ui` — the published framework. Maintainer invariants: `packages/basalt-ui/MAINTAINING.md` (repo only, not shipped).
- `apps/playground` — the everyday iteration surface; grows as the package gains surface. Instant
  HMR, exact types, zero linking via `workspace:*`.
- `apps/expression` — the expression cycles' trial scenarios (`docs/v3/EXPRESSION.md`) with their own shell and a searchable index; an `init --profile app` install like the playground, sharing no module with it.
- `apps/marketing` — basalt-ui.com. Content-frozen until rebuilt on v3 post-migration; will
  vendor its own legacy CSS and stop depending on the package. Don't iterate on it for now.

## Key Principles

- **Concise over verbose** — less code is better.
- **Examples over description** — show, don't tell.
- **TypeScript strict** — no shortcuts.
- **Iterate in the playground** — see changes immediately.
- **Document decisions** — update this file as conventions evolve.
