# basalt-ui 2.0 — the rewrite

**Goal:** basalt-ui 2.0.0 is on npm. It is a strict, small, hard-to-abuse framework over Mantine 9 and
the TanStack stack, with charts on TanStack Charts (visx fully gone) and a rewritten lint and agent
layer. argo runs on it in production, every chart and the AI chat rewritten, and the run is proven
with screenshots, performance and render measurements, and logs/traces against a recorded 1.41
baseline.

**Gate (every wave):** `make check` green; `/review` clean on every merged diff; the wave's evidence
written under `docs/waves/evidence/w<n>.md`. That file is an index; per-lane files live under
`docs/waves/evidence/w<n>/`. From W2 on, that evidence is `make evidence` output
diffed against the baseline, and a regression has to be fixed or explicitly accepted in the wave's
**Left behind**.

**Mode:** fleet, orchestrated. The orchestrator tab is the mother: it holds this file, spawns one lead
per wave, and reviews close-outs. It never reads code. Each lead follows `/wave` `roles/lead.md`,
writes worker briefs from `roles/worker.md`, fans out with `rd fan` on disjoint file groups, and
lands with `rd merge`. A lead does NOT spawn the next wave.

**Model:** waves run on the default wave model. W1 and W4 are novel design work (the v2 contract, the
chart engine), so the mother spawns them with `RD_WAVE_MODEL=opus`.

## Charter — what the owner asked for (2026-10-13)

These six points are the acceptance test for every decision.

1. **Strict and hard to abuse.** Fewer public symbols and subpaths than 1.41. One way to do each
   thing. Lint rules at `error`. Types that make wrong usage fail to compile. Every public symbol
   needs a named consumer outside the playground (the adopt-or-delete rule carries forward).
2. **A framework, not a kit.** A deep Mantine wrapper wired to the TanStack stack (Router, Query,
   Table, Virtual, Hotkeys, Charts, and Store/Pacer/DB/AI/Devtools where they earn it), with the
   wiring done for the consumer.
3. **TanStack libraries are judged on merit, not version number.** A pre-1.0 library is adopted if a
   playground demo plus an argo use case prove it pays for itself. If it is adopted, its exact pin
   and an upgrade-test note go into the spec.
4. **Discard the old.** visx goes completely, with no raw re-exports. Every 1.x-only surface,
   compatibility shim and dead export is deleted rather than ported. `MIGRATING.md` § 2.0 maps each
   removal.
5. **The agent layer is a product.** The shipped rules and skills, the AGENTS.md block, and
   `init`/`sync`/`doctor` get rewritten: less prose, more enforcement. Success is measured by a fresh
   consumer (argo) reaching a correct setup with one command and the agent writing correct code on
   the first try.
6. **Proven, not claimed.** Every wave produces evidence: screenshots, bundle bytes, render and
   interaction timings, layout suite results, OTel traces/logs where a runtime exists. argo is the
   production partner that has to agree.

**Inputs:** `docs/waves/audit-h-ecosystem-2026-10.md` (versions, verdicts, consumer blast radius),
`docs/archive/STATUS-HISTORY.md` § Chart-layer rebuild (the four ideas carried over from TanStack
Charts), `docs/CHARTS-SPEC.md`, `docs/DESIGN-CORE.md`, `packages/basalt-ui/MAINTAINING.md`.

**Branching** (owner decision 2026-10-13, superseding the first draft): `master` is the only line;
1.x is frozen at `v1.41.0` with no maintenance; consumers stay exact-pinned until they migrate.

## Wave 1 — Contract: the 2.0 spec and the doctrine change <!-- status: done -->

- [x] Doctrine. AGENTS.md § "No majors", `MAINTAINING.md`, `scripts/release.sh` and the
      `never-trigger-releases` memory now sanction exactly one major (2.0.0, owner decision 2026-10-13).
      Everything after 2.0 goes back to no-majors. Give `release.sh` an explicit, once-only path for
      2.0.0.
- [x] `docs/V2-SPEC.md`, the single ground truth that replaces the 1.x specs as each one is ported:
  - the public surface table (subpaths and symbols, each with its named consumer)
  - the provider and wiring contract (one `BasaltProvider`, router + query + hotkeys + devtools)
  - the strictness rules
  - the token and theme contract (unchanged law, `--vx-*` kept)
  - the transitions story (React 19.3 `<ViewTransition>`/`<Activity>` vs the router's
    `defaultViewTransition`: pick one per surface)
  - the AI/content contract
  - the observability contract (what the framework logs and traces, and how a consumer wires OTel)
- [x] The library adoption ledger in the spec, one row per library, with a playground spike where a
      verdict needs evidence:
  - Table v9 (`createTableHook`)
  - Store (Table v9 already depends on it)
  - Pacer (debounced filters/search)
  - DB (argo live data?)
  - Devtools shell vs basalt's own dev dock
  - Hotkeys 0.13
  - Form vs `@mantine/form`
  - TanStack AI vs AI SDK 7 (argo's ai@5→ai@7 skew decision D3 is an input)
- [x] The chart contract: the 2.0 chart API on `@tanstack/charts`. It covers:
  - kinds, the composition rung that replaces `CartesianChart`, cursor sync, tooltip, zones,
    dual-axis, plot-first mobile
  - a `--vx-*` → chart theme bridge
  - a11y and SSR
  - the full argo/linewatch/weatherorb chart inventory mapped to 2.0 kinds (Explore pass over
    consumers)

  Read the installed `@tanstack/charts@1.1.0` docs and skills, not memory.

- [x] A spec-level `/review` pass, then commit the spec and the doctrine as separate concerns (package
      vs non-package commits).

**Left behind:**

- **Landed** (all via `rd merge`): #109 spec skeleton + transitional prose ceiling, #110 release
  doctrine, #111 § 1–7 + `docs/waves/v2-surface.md` (W3's per-symbol deletion checklist), #112 § 8,
  #113 § 9 + `docs/waves/v2-chart-inventory.md`, then this close-out. Evidence index:
  `docs/waves/evidence/w1.md`. Spike branches are evidence, never merged: `spike/w1-ledger` @
  `5f8e614`, `spike/w1-charts` @ `f74f671`.
- **Owner reversal mid-wave:** no `1.x` maintenance branch, no `next` channel. The `1.x` and
  `latest` branches and the `v2.0.0-placeholder.0` tag pushed earlier in the wave were deleted;
  `.releaserc.json` and the workflows are unchanged from 1.41.
- **Release state:** `release.sh`'s gate now refuses every computed 1.x version, so nothing is
  releasable until 2.0.0. W3 lands the ONE designated `feat:` commit with a `BREAKING CHANGE:`
  footer pointing at `MIGRATING.md` § 2.0 (MAINTAINING.md § The one sanctioned major). The gate
  checks the computed version, not the commit, so review keeps it to one.
- **Owner calls before the dependent wave** (V2-SPEC § 10): accept TanStack Charts' +14.5 KB gzip on
  the first chart (before W4); accept Table v9's +4 070 B (before W6).
- **Deferred tests and gates, by wave** (review findings, accepted as later work):
  - W3: the `check-budgets` gates § 1 names (`consumers.json` keyed per symbol name, non-chart type
    budget ≤ 60, one import path per symbol); commit the W1 surface scan scripts; `*.type-guard`
    fixtures per § 3 row; `BasaltEvent` union test and telemetry sink tests; `createBasaltRouter`
    defaults test; a `pack-test` pair for each subpath-required peer; `no-dev-helper` fixtures.
  - W4: port the chart spike's 12 tests; a test that the § 9.8 allowlist matches the engine's
    exports; the ChartHost split; layout cases per container class; cursor-group teardown; a
    recompute check for the inventory counts.
  - W6: port the ledger spike tests (`table-parity`, `table-v9-nosortfns`, `table-v9.type-guard`,
    `hotkeys.type-guard`, `hotkeys-dispatch`); add pinned-column offset and `datetime` sort cases;
    re-run them before any Table 9.3.x bump (9.3.1 was blocked by `minimumReleaseAge` until
    2026-10-15).
- **Flake for W2:** the layout test `shell chrome … with the inset unset the zone is exactly as it
  was` fails intermittently under load (rail measured 171 px, expected 48 px). Clean master passed
  3/3 and direct `make check` passed on every merged SHA, while the merge train failed on it every
  time (5/5), so suspect the train's environment (`host_run`) before load. #111 and #113 merged with `--no-check` after a
  direct `make check` exited 0 on the exact SHA. W2's harness reuses the layout infrastructure, so
  fix the root cause there. W2 should also make the spike evidence reproducible without the spike
  branches (the W1 numbers cite them until W4/W6 port their tests).
- **Budget:** the spec prose ceiling went 3200 → 3166, its landed value.

## Wave 2 — Baseline and the evidence harness <!-- status: done -->

- [x] `make evidence`: one command, deterministic output under `.evidence/<label>/` (gitignored), with
      a summary md that is committed. It records:
  - gzip bytes per subpath and per playground route chunk
  - chart render timings (first paint, update under streaming data, hover latency) through a
    headless Chrome harness reusing the layout-suite infrastructure
  - React Profiler commit counts for chat streaming
  - Lighthouse for 3 playground routes
  - screenshots per route × light/dark × desktop/mobile
- [x] Record the 1.41 baseline: playground, plus argo's dashboard routes against a local build (no dev
      servers left running).
- [x] Observability: decide the framework's logging/tracing hooks per the V2-SPEC observability
      contract. Wire the playground to the local OTel collector so evidence includes traces.
- [x] Commit the harness and the baseline summary.

**Left behind:**

- **Landed:** #115 lane contract, flake fix (`7489033`, `4c5c51c`), then #120 `make evidence` with all lanes
  plus both baselines. Index: `docs/waves/evidence/w2.md`. Usage:
  `make evidence LABEL=<l> [DIST=<dir>] [ROUTES=<file>]`; a clean run takes ~6 min.
- **Flake:** root cause was `collapseSidebar` waiting on the navbar only while the header zone eased
  on its own transition. Fixed by waiting for all running animations; 9/10 to 10/10 under load, and the
  merge train passed its layout suite on #120. Diagnosis: `evidence/w2/flake.md`.
- **Baselines:** playground at 1.41 (`evidence/w2/baseline-1.41.md`) and argo's dashboard at its pinned
  **1.36.0** (`evidence/w2/argo-baseline-1.36.md`; argo never moved to 1.41). The argo run covers only
  the bundle, screens and lighthouse lanes: charts-perf, chat-profile and otel are playground-specific
  and fail on argo's DOM, recorded as such. Argo has no API behind a static build, so its screenshots
  show empty/error states; chart-render and streaming comparison for argo happens in W12 on a real stack.
- **Observability:** V2-SPEC § 7 adopted unchanged (`evidence/w2/observability.md`). The playground emits
  the § 7 events by hand through `telemetry.ts` (build flag `VITE_TELEMETRY=1`, runtime sink
  `window.__BASALT_OTLP__`); W3 swaps the sources for the real `telemetry` seam. `route.error`,
  `query.error`, `mutation.error` are not measurable until W3 (no app-level client, no
  `createBasaltRouter`). The local collector was not used: the lane runs an in-process OTLP receiver.
- **Measurement caveat for W4/W5:** headless Chrome here has a ~66 ms idle rAF frame (control row in the
  tables). Compare deltas against the same-machine control, never absolute frame times.
- **Review fixes applied:** discarded `toSorted`, missing `VITE_TELEMETRY` on the evidence build, a
  boot-blocking telemetry import, duplicated `median`/`withTimeout`/`sortKeys`, `routes` into `LaneCtx`,
  `scripts/evidence` added to `typecheck`.
- **Deferred (accepted):** unit tests for `telemetry.ts` pairing/mapping and `serve.ts` edge cases; an
  `AbortSignal` in `LaneCtx` so a timed-out lane stops its work; `lighthouse()`/`main()` complexity;
  `lighthouse` and `index.ts` decomposition; `fmt` does not cover `scripts/`. The spike-branch
  numbers from W1 are still cited until W4/W6 port their tests (W1 deferral stands).

## Wave 3 — Foundation: toolchain, deletions, skeleton <!-- status: done -->

- [x] Toolchain per audit H W1: Mantine ^9.7, React 19.3, Query 5.104, AI SDK 7.0.138, shiki 4.5,
      remend 1.4 (plus `incomplete-image` hardening), motion 14, Hotkeys 0.13, oxlint 1.88, oxfmt 0.72,
      root tooling. TypeScript stays 6.x until 7.1 ships an API.
- [x] Delete everything the spec marks "not in 2.0" (1.x shims, on-notice exports, dead subpaths).
      Write each removal into `MIGRATING.md` § 2.0.
- [x] The 2.0 subpath skeleton and the budgets (`check-budgets.ts`) reset to the spec's targets.
- [x] The provider/wiring contract implemented (`BasaltProvider` plus TanStack wiring per the
      spec), with playground root and `agent/templates/__root.tpl` on it.

**Left behind:**

- **Landed:** #122 toolchain, then #127 as three linear commits on `master`: `refactor:` package,
  `chore:` playground/docs/root, and the ONE designated `feat:` commit carrying `BREAKING CHANGE:`
  (release.sh's gate is now satisfiable; nothing was released). Four topic PRs (#123 gates, #124
  agent/data, #125 provider, #126 core) built in parallel were integrated on `w3/integrate` and closed
  as superseded; the merge train cannot rebase merge commits, so a topic-merge history has to be
  linearised first. Evidence index: `docs/waves/evidence/w3.md` (−15k lines net; budgets all green).
- **Toolchain floors:** Mantine ^9.7, React 19.3, Query ^5.104, `ai` ^7.0.137, shiki ^4.5, remend 1.4.0 +
  `incomplete-image` hardening, motion 14.1.0, hotkeys 0.13.0, oxfmt ^0.72. **Blocked by
  `minimumReleaseAge`, re-check later:** motion 14.2.0, oxlint 1.88 (on ^1.87). The new React-compiler
  oxlint rules and `no-constant-binary-expression` are off in the root and playground configs (about 90
  hits, mostly `src/charts/**`): W4 turns them back on for the chart layer.
- **Deviations from V2-SPEC, to resolve in the named wave:**
  - non-chart value symbols 97 vs 92: four helpers exist only for `./charts` (W4 deletes), plus `useNav`
    on the root barrel because `BasaltShell` has no `nav` prop yet (W7).
  - `@tanstack/react-table` is still `>=8 <9`; the 9.2.8 exact pin lands with Table v9 (W6).
  - `ThemeToggle` still imports `motion` at the root (spec § 5 drops it, W7); the peer-class gate carries
    a deferred list for it and for `ai`/`@ai-sdk/provider`/hotkeys/`dayjs` classifications (W7/W8).
  - rule lines 734 (target 450) and charts 97 (48) are gated at landed values.
  - `src/charts/utils/format.ts` import paths were edited once to compile; W4 will see a small conflict.
- **Not done / owner of the gap:** `no-dev-helper` fixtures and the `router-view-transition` rule (W9);
  `*.type-guard` fixtures exist for the §3 rows implemented, `BasaltEvent` and `createBasaltRouter`
  defaults tests exist; `chat.turn` has a type and no source (W8).
- **chat-profile evidence lane is blind** until W8 (its page is deleted surface); every other lane ran.
- **Open owner-less review nits (accepted):** notify.tsx duplication with `state/persisted.ts`, `cli/init`
  vs `sync` clones, `surface-scan/*` hard-coded paths, `peer_array` eval in pack-test.sh.
- **Spotlight `when()`** is recomputed on open; `defineNav` is a last-write-wins global (mirrors
  `defineCommands`), revisit when W7 gives `BasaltShell` its `nav` prop.

## Wave 4 — Chart engine on TanStack Charts <!-- status: active -->

- [ ] Chart core: the composition rung, theme bridge, shared cursor/focus sync, tooltip (Mantine-free
      in the chart layer), axes/format, zones and thresholds, dual-axis, responsive and plot-first
      mobile, a11y. `src/charts/**` stays Mantine-free.
- [ ] Port the first two kinds (`ZonedLine`, `Bars`). Diff them against the baseline with
      `make evidence`.
- [ ] Remove every `@visx/*` dependency, peer and re-export. Replace the visx lint rules and the
      `raw-visx-axis` guard with their 2.0 equivalents.
- [ ] Rewrite `docs/CHARTS-SPEC.md` for 2.0, or fold it into V2-SPEC.

**Left behind:**

## Wave 5 — Chart kinds, complete <!-- status: pending -->

- [ ] Port the remaining kinds and sparklines (StackedArea, MultiLine, DualPanel, Donut, Heatmap,
      BandStrip, MirroredBars, LineSparkline, BarSparkline). Add only the new kinds the consumer
      inventory demands (Rule of Three).
- [ ] Playground chart routes rebuilt. Evidence must show no render or hover regression vs the 1.41
      baseline (or a written acceptance), plus a11y keyboard walk screenshots.

**Left behind:**

## Wave 6 — Data and state <!-- status: pending -->

- [ ] DataTable on Table v9 (`useTable` + one module-scope `tableFeatures` set; no `createTableHook`,
      per spec § 8). Virtual 3.14.
      Query `queryClient.query` migration. Store/Pacer/DB per the adoption ledger.
- [ ] Commands/hotkeys on 0.13. Forms per the spec verdict.
- [ ] Evidence: 10k-row table scroll/sort timings vs baseline.

**Left behind:**

## Wave 7 — Shell, routing, transitions <!-- status: pending -->

- [ ] Shell, aside, nav and breadcrumbs per the spec. Mantine 9.7 adopt-or-delete (`useAppShellResize`
      vs `aside-docking`, `EmptyState`/`DataList`/`Toolbar`/`ActionBar`), adopting only where it deletes
      basalt code.
- [ ] The transitions story implemented (route + in-page), with reduced-motion honoured. Screenshots
      plus timing evidence.

**Left behind:**

## Wave 8 — AI chat and content <!-- status: pending -->

- [ ] `./agent` + `./agent-chat` on AI SDK 7 latest. Covers: `throttle`, status semantics,
      `ReasoningLevel` `max`, typed errors, `WebSocketChatTransport` via the transport seam, and TanStack
      AI per the ledger.
- [ ] `./content` streaming markdown hardened (remend 1.4 sentinels, shiki 4.5, mermaid).
- [ ] Evidence: commit counts and frame timings for a long streamed reply vs baseline. OTel trace of
      one chat turn end to end.

**Left behind:**

## Wave 9 — Lint and agent layer <!-- status: pending -->

- [ ] oxlint plugin rewritten to the 2.0 strictness rules, all at `error`, with dogfood levels
      matching. Delete rules whose concern 2.0 makes unrepresentable.
- [ ] Shipped rules and skills rewritten. Target: fewer lines than 1.41's 1,136, with every
      instruction backed by a rule or a type. Also the AGENTS block, `llms.txt`, and
      `init`/`sync`/`doctor` (an upgrade path from 1.x included).
- [ ] DX trial: a scratch app scaffolded with `basalt-ui init`. A fresh agent with only the shipped
      layer builds a dashboard route with a chart, a table and a chat. Record every wrong turn and fix it
      at the source.

**Left behind:**

## Wave 10 — Release candidate <!-- status: pending -->

- [ ] Full playground validation: every route through `make evidence` plus `@verifier`. Fix the
      regressions found.
- [ ] Docs: README, `MIGRATING.md` § 2.0 complete, the ledger closed, the 1.x specs archived.
- [ ] Publish `2.0.0` through `make release` (the one sanctioned major). The mother triggers the
      publish after reviewing the close-out.

**Left behind:**

## Wave 11 — argo, part 1: setup, shell, data, chat <!-- status: pending -->

- [ ] argo branch on `basalt-ui@2.x`: `basalt-ui init`/`sync` (the agent-layer DX test again),
      provider/shell/routing, tables, AI chat.
- [ ] Feed back every basalt friction as a basalt fix shipped as a 2.x minor. Don't work around it in
      argo.

**Left behind:**

## Wave 12 — argo, part 2: every chart, production <!-- status: pending -->

- [ ] All argo charts on the 2.x kinds; basalt fixes found here ship as 2.x minors. Evidence vs argo's
      baseline (render, bundle, screenshots).
- [ ] argo merged and deployed. Verify it is live: health, OTel traces/logs, Uptime Kuma.

**Left behind:**

## Wave 13 — argo learnings and the fleet plan <!-- status: pending -->

- [ ] Fold the argo learnings in as 2.x minors and restate the no-majors doctrine.
- [ ] Write the fleet plan for linewatch, weatherorb, rb, rollhook and basalt-ui-obsidian (each stays
      exact-pinned on 1.41.x until then).

**Left behind:**
