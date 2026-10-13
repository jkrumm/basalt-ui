# Audit H — Ecosystem upgrade sweep (2026-10-13)

> Input to `docs/waves/PLAN.md` (basalt-ui 2.0). Superseded where the plan's charter says otherwise:
> the 2.0 decision replaces the "spike, don't migrate" chart verdict, and pre-1.0 TanStack libraries
> are judged on merit in W1's adoption ledger, not skipped. The "W1–W5" labels below are this audit's
> own and are not the plan's waves.

Baseline: basalt-ui 1.41.0 on `master`. Evidence: `bun outdated`, npm registry, the
`@tanstack/charts@1.1.0` + `streamdown@2.7.0` tarballs read directly, four research-gateway reports
(TanStack Charts, TanStack ecosystem, AI/streaming-markdown, React/Mantine/motion/TS7), an Explore
pass over the repo, and a consumer grep across `~/SourceRoot`.

## Verdicts

| Area                                        | Current                                 | Latest                             | Verdict                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------- | --------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@mantine/*`                                | ^9.3                                    | 9.7.2                              | **Bump floor to ^9.7.** Additive only, no theming/resolver breaks. Adopt-or-delete: `useAppShellResize` (9.7) vs our `aside-docking`, `EmptyState`/`DataList`/`Toolbar`/`ActionBar` vs basalt equivalents.                                                                                                                                                                         |
| `@tanstack/react-table`                     | >=8 <9                                  | 9.3.1                              | **Migrate (own wave).** Stable, React-Compiler-safe, first-party Mantine example. One `useReactTable` call (`data/data-table.tsx:1514`), 5 row-model calls, 3 `flexRender`, ~40 type uses. `createColumnHelper` is re-exported → consumer-visible: MIGRATING entry. `createTableHook` is the documented wrapper API. No codemod; `useLegacyTable` bridge exists but don't ship it. |
| `@tanstack/react-hotkeys`                   | 0.10.0 exact                            | 0.13.0                             | **Widen after a type diff.** Never imported — `commands/projectors.ts` mirrors its types. Exact peer pin forces consumers onto 0.10. Alpha: keep exact pin, move to 0.13.0.                                                                                                                                                                                                        |
| `@tanstack/react-query`                     | ^5.101                                  | 5.104.2                            | **Bump floor.** 5.102 adds `queryClient.query()` and deprecates `fetchQuery`/`prefetchQuery`/`ensureQueryData` (removed in v6) — grep `src/` + `agent/templates/query-client.ts.tpl`. Removed experimental `experimental_prefetchInRender`/`promise`.                                                                                                                              |
| `@tanstack/react-router`                    | ^1.170                                  | 1.170.44                           | **In range.** `defaultViewTransition` (`document.startViewTransition`, not React's component) — see W3.                                                                                                                                                                                                                                                                            |
| `@tanstack/react-virtual`                   | >=3.13.26 <4                            | 3.14.x                             | In range, nothing to do.                                                                                                                                                                                                                                                                                                                                                           |
| TanStack Pacer / Store / DB / Devtools / AI | —                                       | 0.x                                | **Skip.** All pre-1.0; no basalt consumer need. Form 1.x is stable but `@mantine/form` is the shipped stance.                                                                                                                                                                                                                                                                      |
| `ai`                                        | ^7.0.15                                 | 7.0.138                            | **Bump floor.** All patch-level. Check `agent-chat` against: `throttle` now stable, status stays `submitted` until first content (7.0.66), `ReasoningLevel` gained `max` (7.0.129 — exhaustive switches), typed UI errors (7.0.100). `WebSocketChatTransport` (7.0.135) works via the existing `transport` seam — document, don't wrap.                                            |
| `remend`                                    | 1.3.0 exact                             | 1.4.0                              | **Bump + one fix.** 1.4 emits `![alt](streamdown:incomplete-image)` instead of dropping the image; `content/url-hardening.ts` handles `incomplete-link` only — extend it.                                                                                                                                                                                                          |
| `shiki`                                     | ^4.3                                    | 4.5.0                              | Bump.                                                                                                                                                                                                                                                                                                                                                                              |
| streamdown                                  | rejected                                | 2.7.0                              | **Stays rejected.** Still Tailwind-bound (`tailwind-merge` dep, `@source` setup, "not a full unstyled mode"). Its architecture — block split, `React.memo` settled blocks, `remend`-repaired tail — is already ours (`content/markdown.tsx:34-39`).                                                                                                                                |
| `motion`                                    | 12.42.0 exact                           | 14.2.0                             | **Bump.** Only user-facing break in 12→14: optional `@emotion/is-prop-valid` dropped (13.0). 4 import sites, all `motion/react`.                                                                                                                                                                                                                                                   |
| `react`                                     | ^19.2.7                                 | 19.3.0                             | `<ViewTransition>`, `addTransitionType`, Fragment refs **stable in 19.3**. `<Activity>`/`useEffectEvent` stable since 19.2. See W3.                                                                                                                                                                                                                                                |
| `typescript`                                | ^6.0.3                                  | 7.0.2                              | **Hold until 7.1.** No programmatic API in 7.0 — anything calling the TS API breaks (`@arethetypeswrong/cli` in pack-test, router codegen, ts-based tools). Our build is CLI-only (`tsup dts: false` + `tsc --emitDeclarationOnly`), so a later move is cheap.                                                                                                                     |
| `oxlint` / `oxfmt`                          | 1.68 / 0.53                             | 1.88 / 0.72                        | **Bump, own commit.** Changelogs unverified by research; `make check` is the proof. oxfmt 0.x may reformat → separate `chore:` reformat commit. Ships to consumers via `configs/`.                                                                                                                                                                                                 |
| Root tooling                                | commitlint 20, semantic-release plugins | commitlint 21, changelog 7, git 11 | Separate `ci:` commit; dry-run release afterwards.                                                                                                                                                                                                                                                                                                                                 |

## TanStack Charts — revisit (archived rejection said "revisit at 1.0")

Verdict: **spike, don't migrate.** It is not a dependency swap. It replaces the chart layer.

- **What it is:** a grammar of graphics (`defineChart({ marks, scales, color, tooltip })` → keyed
  scene → SVG by default, Canvas per mark). The React adapter is a single `<Chart definition>`
  component: no hooks, no context, no slot overrides. 13 `d3-*` runtime deps; theming through
  `currentColor` + `--ts-chart-1..6`.
- **Maturity:** repo created 2026-07-28; 0.11 → 0.18 in five weeks; **1.0.0 on 2026-10-03**, 1.1.0 on
  10-09. Has a real semver contract since 1.0. Its README says the implementation was produced almost
  entirely with AI.
- **What we'd gain:** first-party keyboard focus + a11y, full-SVG SSR, Canvas for dense marks, a
  much larger mark catalogue (box, violin, ridgeline, sankey, treemap, hexbin, contour), a React
  Native adapter, and it ships its own agent skills.
- **What it costs:**
  - `src/charts/**` is ~11.6k non-test + ~10k test lines built on visx JSX composition. The
    `CartesianChart` contract has to be **re-expressed** as a definition compiler. That covers measured
    margins, the `useSyncExternalStore` shared cursor, the Mantine-free tooltip, zones, dual-axis and
    plot-first mobile.
  - Brush/zoom are horizontal-only.
  - Rules to rewrite: the `visx-boundary`/`visx-tooltip` rules, the `raw-visx-axis` guard,
    `basalt-charts.md`, the charts skill and CHARTS-SPEC.
- **Consumer blast radius:** argo 48 files, linewatch 22, weatherorb 4, rb (direct `@visx/*`). The
  raw visx re-exports (`LinePath` ~38 uses, `AreaClosed`, `Threshold`, `GridRows`, `scaleLinear`)
  are public surface and each needs a MIGRATING entry.
- **Spike (W5):** port `ZonedLine` + `Bars` onto `@tanstack/charts` behind the _unchanged_
  `CartesianChart`/kind props, in the playground only. Go/no-go criteria:
  1. Layout suite + chart tests pass unmodified.
  2. Shared cursor sync across charts still works.
  3. Token theming via `--vx-*` (map onto `--ts-chart-*` / `theme`).
  4. gzip delta measured per kind.
  5. Mobile plot-first behaviour holds.
  6. The kind ends up shorter than today's.

  On "go", migrate kind by kind under the same public API (consumers untouched), then deprecate the
  raw visx re-exports through MIGRATING.

## Claude Code layer

- `AGENTS.md`-only is **already shipped in 1.41.0** (`ce26af8`, `61c32de`). `init`/`sync` write the
  block to `AGENTS.md`, migrate a legacy `CLAUDE.md` block, and `doctor` warns on a shadowing
  `CLAUDE.md`. No fleet repo has a `CLAUDE.md`.
- TanStack ships agent skills inside its packages (Charts `skills/`, Table `migrate-v8-to-v9`). Use
  them as references for W2/W5; don't vendor them.

## Waves

| Wave     | Scope                                                                                                                                                                                                                | Commit shape                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| W1       | Housekeeping: peer floors/pins (Mantine ^9.7, query, ai, shiki, remend 1.4 + `incomplete-image` hardening, motion 14, hotkeys 0.13 after type diff), playground dev deps, oxlint/oxfmt, root tooling                 | `feat:` package · `chore:` playground · `ci:` tooling · `chore:` reformat |
| W2       | Table v9: `DataTable` onto `useTable`/`tableFeatures` (eval `createTableHook`), peer `^9`, MIGRATING                                                                                                                 | `feat:` package + consumer bumps                                          |
| W3       | Transitions: one route story — router `defaultViewTransition` in `router-tanstack` + `__root.tpl`; React `<ViewTransition>`/`<Activity>` for aside/tab/thread swaps; reduced-motion; decide motion vs VT per surface | `feat:` package, playground evidence first                                |
| W4       | Mantine 9.7 adopt-or-delete: `useAppShellResize` vs `aside-docking`, `EmptyState`/`DataList`/`Toolbar` vs basalt equivalents — only where it deletes basalt code                                                     | net-negative `refactor:`/`feat:`                                          |
| W5       | TanStack Charts spike (above) → go/no-go                                                                                                                                                                             | playground-only until go                                                  |
| Deferred | TS 7 (until 7.1 API), TanStack AI/DB/Store/Pacer, streamdown                                                                                                                                                         | —                                                                         |
