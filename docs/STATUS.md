# Basalt UI — Status

> **Single source of truth for current state.** As of **2026-07-05**. The other docs in `docs/`
> are historical process artifacts or superseded scope ledgers — this file is what's true now.

**Branch:** `feat/s0-mantine-pivot` (PR-required, unmerged, **15 commits ahead of `origin`**).
**Version:** `1.0.0` in `package.json`, **unpublished** (last npm tag: `v0.4.2`).

## TL;DR

The 1.0 Mantine pivot is **functionally complete**. No feature work remains for the 1.0 cut
line. What's left is the owner-gated **ship sequence** (push → PR → npm Trusted Publisher →
review → release). The June-era roadmap/handover docs still phrase built work as "remaining" —
that language is historical; see the banner on each.

## Built (verified as-built, 2026-07-05)

- **Spine** — `surfaces.ts` (the SSOT registry), `register.ts` (`BasaltRegister`/`Slot`/`SeriesKey`/
  `AsyncState`), `state.ts` (`createPersistedState`), `guard/` (incl. the `basalt guard-hook`
  PreToolUse adapter; `GUARD_RULES` drives `checkSource`), provider freeze (`BasaltErrorBoundary` +
  `onError` + CSP nonce).
- **Seven batteries** ship as runtime subpaths: `./query`, `./router-tanstack`, `./agent`,
  `./commands`, `./forms`, `./notifications`, `./data` — plus `./guard`, `./state`,
  `./connectivity`, `./llms.txt`. All 15 subpaths resolve in the pack-test.
- **Charts / tokens** — config-driven chart system (legend/tooltip/crosshair), `ResponsiveChart` +
  `useChartSize`, the semantic-tier `--vx-*` token keystone, zinc-charcoal palette, motion
  discipline (oxlint + `check-theme` enforced).
- **Enforcement** — `SURFACES` projects `gen-oxlint` + `gen-llms`; `check-coverage` (8 assertions);
  Mantine-free boundary enforced on headless surfaces; `@visx/*`-only-in-`charts` boundary.
- **Release gates** (`scripts/pack-test.sh`) — `publint --strict` + `attw` (esm-only) +
  `check-dist-layering.mjs` (7 Mantine-free subpaths + root-barrel) + 15-subpath resolution.
- **CLI** — `init` · `sync` (+ `--check` drift gate) · `check-theme` · `check-coverage` · `info`
  (+ `--json`) · `doctor` · `guard-hook`.
- **Agent-DX** — `llms.txt`, `AGENTS.md`, `basalt info --json`, `basalt doctor`; the `basalt`
  plugin (skills) + `basalt init` (rules + CLAUDE block + DESIGN.md seed).
- **Resolved owner decisions** — `@visx/*` bumped alpha.11 → **4.0.0 stable** (+ `@visx/responsive`);
  `@tanstack/react-hotkeys@0.10.0` optional peer (live keybinding) shipped; `createForm` →
  `useBasaltForm` rename.

## Open — the finish line (owner-gated, cannot be closed from source)

1. **Push** the 15 commits to `origin/feat/s0-mantine-pivot`.
2. **Open the PR** (basalt-ui is PR-required).
3. **npm Trusted Publisher** — configure `jkrumm/basalt-ui` → `publish.yml`, then **delete the
   `NPM_TOKEN` GitHub secret**. Without this the OIDC publish 403s.
4. **`/code-review ultra`** at the finish line (billed).
5. **Merge**, then trigger the release workflow (semantic-release-monorepo, npm provenance).

## Validation

Last verified green ~**2026-06-21** — before ~15 subsequent commits. **Re-run `bun run pre` +
pack-test before shipping**; the current tip has not been re-validated.

## Deferred by design — do NOT build for 1.0

Intentional cut-line calls, not gaps:

- **tsdown migration** — NO-GO for 1.0 (swapping the tsc declaration emitter on a type-spine
  package; owner may override).
- **Phase-5 kill-list** — bottom-sheet, PWA vite helper + runtime hooks, canvas-line-kind,
  appshell-aside-slot, `create-basalt-app`, dtcg-interchange, `@mantine/dropzone`, full
  `<Chat>`/voice. Advisory-only.
- **`no-explicit-any` → error escalation**, **`./state` static-lint globs** (would over-reach into
  consumer state files), **controlled `DataTable` sorting** prop.
- **`@example` JSDoc markdown-compile harness** (the playground demos already are canonical
  compiling examples).
- **`react-perf` lint** — dropped after evidence (141 false-positive warnings on idiomatic
  Mantine/visx; React Compiler supersedes manual memoization).
- **3 `@deprecated` back-compat aliases** — `state.ts` legacy connectivity export, `ZonedLine`/`Bars`
  `ZoneSpec` aliases — remove at the next major.

## Not part of this refactor

**argo consumer-side migration is a separate repo task** (`~/SourceRoot/argo`) and is **not done**.
This refactor only extracted read-only *from* argo *into* basalt-ui. The BLUEPRINT S0–S5 argo plan
is superseded as basalt-ui's roadmap — do not execute it here.

## Doc map (post-reconciliation)

- **`STATUS.md`** (this file) — current state, single source of truth.
- **Superseded scope ledgers** — `MATURATION-ROADMAP.md`, `ENFORCEMENT-HARDENING.md`,
  `INTEGRATION-DX.md`. Their phases are built except the finish line above; per-phase
  "proposal/remaining" language is historical.
- **Superseded plan** — `BLUEPRINT.md` (S0–S5 = argo-consumer migration, do not execute here).
- **Historical process artifacts** (phase complete, kept for provenance) —
  `ONE-ZERO-DRIVE-HANDOVER.md`, `EXECUTION-HANDOVER.md`, `PHASE-1-HANDOVER.md`,
  `PHASE-1-GROUNDING.md`, `PHASE-1-DESIGN.md`, `PHASE-1-IMPLEMENT-HANDOVER.md`.
