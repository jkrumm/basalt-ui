# Basalt UI — Status

> **Single source of truth for current state.** As of **2026-10-14**: the 2.0 release candidate.
> The plan and its live state: `docs/waves/PLAN.md`; the contract: `docs/V2-SPEC.md`.

**Published version: read it, don't trust a doc.** `npm view basalt-ui version` is what npm serves
(`1.41.0`, the frozen 1.x line, until W11 publishes `2.0.0` through `make release`);
`packages/basalt-ui/CHANGELOG.md` has the release notes, `packages/basalt-ui/MIGRATING.md` the
breaking half (§ 2.0.0 for the upgrade). What `master` carries beyond the tag:
`git log $(git describe --tags --abbrev=0)..HEAD`.

## 2.0 in one table

| Area            | Truth on `master`                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Surface         | 15 subpaths (1.41: 24), required peers defined once in V2-SPEC § 1; gated in `scripts/check-budgets.ts`      |
| Wiring          | `BasaltProvider router` + `createBasaltRouter`; theme optional; dev dock and theme lab provider-mounted      |
| Charts          | `@tanstack/charts` behind one host (`src/charts/host.tsx`); visx is gone; V2-SPEC § 9                        |
| Data and state  | `./table` on Table v9, `./state` stores, `./forms` on `@mantine/form`                                        |
| Shell           | routing, transitions, SSR and streaming (W7, W10); `PageBar`/`PageAside` in the root barrel                  |
| AI and content  | `./agent` (runtime + chat UI), `./content`                                                                   |
| Lint and agents | one lint engine (strictness: V2-SPEC § 3); six shipped rules, three skills; `basalt-ui init`/`sync`/`doctor` |
| Waves           | W1–W10 done; W11 (this RC: docs, playground validation, publish) active; W12–W15 are argo and the loop       |

Adopted downstream: seven consumer repos on 1.x; argo migrates first (W12–W14), no other consumer
moves before the argo loop converges. `rollhook` runs the framework-free route
(`docs/FRAMEWORK-FREE.md`).

## Validation

`bun run pre` is the fast inner loop; `make check` is the full local gate (build first, then `pre`,
the layout suite, coverage and doc-drift gates, `scripts/pack-test.sh`). The pack-test is the only
gate that exercises `dist`; the playground aliases `basalt-ui` to `src`. Run it, don't quote a count.

## Doc map

- **Live law** — `V2-SPEC.md` (the contract, wins), `DESIGN-CORE.md` (token and identity law),
  `MANTINE-THEMING.md` (resolver wiring method), `CONTROLS-SPEC.md` and `ASIDE-SPEC.md` (1.26-era
  homes, stores, guards, aside region; V2-SPEC restates only their surface), `FRAMEWORK-FREE.md`.
- **Records** — `MATURATION-LEDGER.md` (closed 2026-10-14), `waves/` (plan, evidence, audits).
- **Ships to consumers** — `packages/basalt-ui/{MIGRATING.md,README.md,llms.txt,AGENTS.md}`,
  `agent/rules/*`, `agent/skills/*`. **Nothing under `docs/` is in the tarball**: a shipped file
  citing a `docs/*.md` path points a consumer at a path they do not have; use a GitHub URL.
- **`docs/archive/`** — superseded specs, scope ledgers and process artifacts, provenance only (each
  carries a banner). `STATUS-HISTORY.md` holds the per-release narratives.

## Deferred by design

`tsdown` (swapping the declaration emitter on a type-spine package), `create-basalt-app`,
dtcg-interchange, `@mantine/dropzone`, full `<Chat>`/voice, `react-perf` lint (141 false positives on
idiomatic Mantine; React Compiler supersedes it). Intentional cut lines, not gaps.
