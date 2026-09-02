# Basalt UI — Status

> **Single source of truth for current state.** As of **2026-09-02**. Per-release narratives moved
> to `docs/archive/STATUS-HISTORY.md`; the rest of `docs/archive/` is superseded scope ledgers.
> This file is what's true now.

**Published version: read it, don't trust a doc.** `npm view basalt-ui version` for what is on npm
(1.27.0 as of this writing), `packages/basalt-ui/CHANGELOG.md` for the release notes,
`packages/basalt-ui/MIGRATING.md` for the breaking half. What `master`/the working branch carries
beyond it is `git log $(git describe --tags --abbrev=0)..HEAD`.

## TL;DR

Everything below this line is built. Nothing in this document is a plan — but the last rows may not
be released yet; the version column says when a capability landed, not what npm serves.

| Capability                                                                                                                                                                                                                    | Shipped                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1.0 Mantine pivot, 1.x line live                                                                                                                                                                                              | 1.0.0                                                                         |
| Theme config closed — all four `createBasaltTheme` dimensions (`derive`, `fonts`, `radius`, `density`)                                                                                                                        | 1.2.0                                                                         |
| Framework-free tokens — `basalt-ui tokens:css`, `basalt-ui/tokens.css`, `only: 'core'`                                                                                                                                        | 1.3.0 (kebab-case 1.5.0)                                                      |
| Chart-layer rebuild — `CartesianChart` as the one mandatory primitive                                                                                                                                                         | 1.15.0                                                                        |
| Native mobile nav + `defineNav`                                                                                                                                                                                               | 1.19.0                                                                        |
| Controls concept — the three homes, the `ctl` tier, typed stores, sidebar blocks, 13→6 rules                                                                                                                                  | 1.26.0                                                                        |
| Region seams + the `/cbbi` chrome round — divider seams, phone row 2, `AxisConfig.scale: 'log'`                                                                                                                               | 1.27.0                                                                        |
| Maturation round — `common/**` (`BasaltProps`, `useValidateProps`, `errors.ts`), deprecation lifecycle (`deprecated-export`), phone chart tier, query-aware containers, `PageAside` shell region, `docs/MATURATION-LEDGER.md` | Unreleased (1.28.0)                                                           |
| Consolidation — one lint engine, adopt-or-delete, one doc home per doctrine, budgets gate                                                                                                                                     | In progress (targets 1.29.0), see `docs/MATURATION-LEDGER.md` § Consolidation |

Adopted downstream: seven consumer repos as of the round-9 sweep. `rollhook` runs the
framework-free route with no Mantine and no React (`docs/FRAMEWORK-FREE.md`); `basalt-ui-obsidian`
is a downstream _library_, not an app. Round-10/11 consumer sweeps ran against 1.24.0/1.25.0
(`.claude/feedback/round-10/`, `round-11/`) but are not summarized here — read the reports directly.

The June-era roadmap/handover docs in `docs/archive/` still phrase built work as "remaining"; that
language is historical, see the banner on each. Full round-by-round narrative (rounds 4–11,
controls waves, the 2026-09 maturation round, and three sections that had drifted into duplicating
`CHARTS-SPEC`/`basalt-mantine.md`/`FRAMEWORK-FREE`): `docs/archive/STATUS-HISTORY.md`.

## Validation

Gates: `bun run pre` (fmt:check + lint + typecheck + check-theme + `bun test`) → `make verify`
(build first, then `pre` + the layout suite + `scripts/pack-test.sh`). The pack-test is the only
one that exercises `dist` — the playground aliases `basalt-ui` to `src`, so neither the running app
nor `bun run typecheck` alone proves the published artifact resolves. Run `make verify` before a
release; don't quote a stale count here, run it.

## Deferred by design — still not built, on purpose

Intentional cut-line calls, not gaps:

- **tsdown migration** — NO-GO for 1.0 (swapping the tsc declaration emitter on a type-spine
  package; owner may override).
- **Phase-5 kill-list** — bottom-sheet, runtime hooks, canvas-line-kind, `create-basalt-app`,
  dtcg-interchange, `@mantine/dropzone`, full `<Chat>`/voice. Advisory-only. (The PWA vite helper
  shipped as `basaltAppPlugin`; `appshell-aside-slot` shipped as `PageAside` — see
  `docs/ASIDE-SPEC.md`.)
- **`no-explicit-any` → error escalation**, **`./state` static-lint globs** (would over-reach into
  consumer state files), **controlled `DataTable` sorting** prop.
- **`@example` JSDoc markdown-compile harness** (the playground demos already are canonical
  compiling examples).
- **`react-perf` lint** — dropped after evidence (141 false-positive warnings on idiomatic
  Mantine/visx; React Compiler supersedes manual memoization).
- **`@deprecated` back-compat aliases** — every shim slated for 1.29.0 removal is tracked in
  `docs/MATURATION-LEDGER.md` § Consolidation and `MIGRATING.md` § Unreleased, not here.

## Not part of this refactor

**The BLUEPRINT S0–S5 argo plan is superseded as basalt-ui's roadmap — do not execute it here.**
The argo consumer migration it describes ran to completion 2026-07-11; distilled feedback from that
run lives in `docs/ARGO-MIGRATION-LEARNINGS.md`. Consult it before touching CLI packaging, the
charts/tokens API, the shell, or the query/forms/notifications/commands batteries.

## Doc map

- **Living reference** — **`STATUS.md`** (this file), `DESIGN-CORE.md`, `MANTINE-THEMING.md`,
  `CHARTS-SPEC.md`, `CONTROLS-SPEC.md`, `ASIDE-SPEC.md`, `FRAMEWORK-FREE.md` (consuming the token
  system with no React/Mantine/bundler), `MATURATION-LEDGER.md` (the running checklist for the
  current maturation + consolidation loops — one row per finding, `.claude/maturation/` holds the
  untracked per-session audit evidence it cites), `ARGO-MIGRATION-LEARNINGS.md`.
- **Ships to consumers** — `packages/basalt-ui/MIGRATING.md` (per-minor API delta), `README.md`,
  `llms.txt`, `AGENTS.md`, `agent/rules/*`, `agent/skills/*`. **Nothing under `docs/` is in the
  tarball** — a shipped file citing a `docs/*.md` path is pointing a consumer at a path they do not
  have; those references are GitHub URLs, marked as outside the package.
- **`docs/archive/`** — superseded scope ledgers and historical process artifacts, kept for
  provenance only:
  - Per-release narratives — `STATUS-HISTORY.md`.
  - `MATURATION-REVIEW.md`, `MATURATION-ROADMAP.md`, `ENFORCEMENT-HARDENING.md`,
    `INTEGRATION-DX.md`, `CONTROLS-SYNTHESIS.md` — executed/superseded scope ledgers.
  - `BLUEPRINT.md` — superseded plan (S0–S5 = argo-consumer migration, do not execute here).
  - `AGENT-CHAT-SPEC.md`, `CONTENT-SPEC.md`, `DESIGN-SPEC.md` — archived 2026-09-02, live
    invariants folded into shipped rules / `DESIGN-CORE.md` (see each file's banner).
  - The `PHASE-1-*` and `*-HANDOVER.md` set — historical process artifacts, phase complete.
- **Deleted** — 7 orphaned pre-pivot marketing/tooling docs (Tailwind/Astro era, zero references
  repo-wide).
