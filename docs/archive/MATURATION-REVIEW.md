# Basalt UI — Maturation Review (2026-07-06)

> **ALL WAVES EXECUTED (2026-07-07)** — every task (T01–T32) is complete (commits `7783adb`,
> `4de05ad`, `3be610c`, `b16d3fe`). This document is retained as a historical ledger;
> `docs/STATUS.md` is the live SSOT. The §4 findings and §5 tasks below are DONE — read them as
> provenance, not an action list.

> Actionable synthesis of a multi-agent maturation pass over the working tree of
> `feat/s0-mantine-pivot`. Aligns with [`STATUS.md`](./STATUS.md) — it does not re-open the
> owner-gated finish line (push · PR · npm Trusted Publisher · review · release) or re-propose
> anything in STATUS.md's "Deferred by design" list. This is the **quality backlog** to burn down
> before/around that ship sequence, not a new roadmap.
>
> **All open questions were resolved by the owner on 2026-07-06** — §6 records the decisions;
> T08, T09, T19, and T32 encode them. The doc is implementation-ready: execute tasks in wave order.

## 1. Method

Eight analysis angles (architecture, typescript-api, consumer-dx, charts-tokens, docs-doctrine,
agent-layer, ux-components, test) each surfaced candidate findings, followed by an adversarial
verification pass that re-checked every claim against source at file:line granularity — refuted
findings were dropped, two were killed outright, several had severity or failure-mode corrected.
Surviving findings were cross-checked against external ecosystem benchmarks (Mantine-kit packaging,
agent-native library conventions, TanStack/visx design-system norms as of mid-2026). Findings below
are deduped across angles: docs-drift and peer-dep issues that multiple analysts reported are merged
into one entry each, keeping the strongest evidence. One finding (MCP-server) is marked `[unverified]`
— its verifier pass did not complete.

## 2. Verdict

The trajectory delivered. The three architectural bets — a Mantine-free headless boundary
(`charts`/`tokens`/`agent` verified zero `@mantine/*` imports, mechanically enforced), a
const-generic `SURFACES`→`BasaltRegister`/`Slot` type spine locked by CI compile-fixtures, and an
opt-in optional-peer subpath topology — are real, hold under scrutiny, and put the type architecture
and enforcement seam **above the mid-2026 bar** for a Mantine extension package. The charts/tokens
pipeline is a genuine one-obvious-step flow; the agentic DX layer (llms.txt from SSOT, AGENTS.md,
lazy-peer degradation, exhaustive `assertNever` part rendering) is more mature than the median npm
library.

Where it falls short is **the first mile and the newest code**. "Instantly usable, greenfield-friendly"
is contradicted by concrete breakage on the literal onboarding path: the GitHub front-door README
still sells the killed Tailwind product; the CLI's own scaffolded root route renders a blank page
(missing `<Outlet />`); the README quickstart yields an unstyled app (missing `@mantine/core/styles.css`);
the theme guard silently no-ops on any non-argo layout; and a shipped subpath export (`./connectivity`)
is absent from the SSOT, which means **CI's `check-coverage` gate is currently red**. The uncommitted
multi-thread agent layer ships a generic `TPart` extensibility facade that crashes at runtime for the
documented use case, and leaves reloaded in-flight threads stuck "streaming" forever. Accessibility is
the weakest cross-cutting theme: several interactive affordances and the flagship streaming transcript
have no keyboard/screen-reader path. None of this is architectural — it is fixable defect and doc debt,
mostly S-effort. Fix it now while there are zero external consumers and breaking changes are free.

## 3. Strengths (deduped)

**Architecture & boundaries**
- Clean acyclic module DAG, single composition root (`provider/index.tsx`); `tokens/` is a pure leaf.
- Mantine-free boundary is real and double-enforced (repo-local `.oxlintrc.json` **and** shipped
  consumer preset): zero `@mantine/*` value imports in `charts`/`tokens`/`agent`, `@visx/*` confined
  to `charts/**`.
- Correct required-vs-optional peer split; root-reachable modules import only `@mantine/core`+`hooks`.
  Optional peers degrade gracefully via `React.lazy`+dynamic import+`.catch` (`streaming-markdown`,
  `stick-to-bottom`, `query/devtools`).
- The `exports` map is the encapsulation boundary — kernel files build to dist but aren't deep-importable.

**Type system**
- Maximally strict `tsconfig` (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`) actually honored in code via the conditional-spread pattern.
- Effectively zero `any` (one justified, commented occurrence).
- The `defineX<const T>` const-generic factory + `Slot`/`BasaltRegister` augmentation seam is applied
  consistently across four subsystems and **locked by `*.type-guard.ts` compile fixtures wired into CI**.
- Declaration health checked against the real tarball (`attw --profile esm-only` in the pack-test).

**Charts / tokens**
- Three-tier token system is real: every `VX.*` ref resolves to an emitted `--vx-*` declaration
  (no dangling `var()`). `defineSeries`/`groupTokens`→`paletteOptions` is genuinely one-step,
  verified end-to-end in the playground; renamed series keys fail `tsc` at every call site.
- `ChartFrame`/`ResponsiveChart` are SSR-safe by construction (gate on measured `width>0`).
- `series.ts` descriptor is a true SSOT for marks+legend+tooltip — drift is structurally prevented.

**Consumer DX & release gates**
- `init`/`sync` sha256 three-way manifest is a solid idempotent-scaffolding design.
- `check-coverage`'s 8 cross-artifact assertions are a rare level of drift prevention for a design system.
- Pack-test is a genuine dist gate (`publint` + `attw` + exact tarball file-list asserts + scratch-install
  subpath resolution).

**Agent layer & docs**
- `STATUS.md` is an accurate, self-aware living SSOT; 10/12 planning docs already carry accurate
  dated supersession banners.
- llms.txt + AGENTS.md + rules + skills meet the mid-2026 agent-native baseline; `basalt-agent.md`
  was updated in lockstep with the new agent-chat feature (spot-checked line-by-line, no drift).
- Persisted stores correctly work around whole-value `setState` via a synchronously-mutated ref.

## 4. Findings (grouped, deduped)

Severity is post-verification. `[downgraded]`/`[unverified]` carry the verification note.

### 4.1 Broken promises / CI-red (Wave 1)

| Finding | Sev | Evidence |
|-|-|-|
| `./connectivity` is a real shipped export absent from `SURFACES` — **CI `check-coverage` currently fails** (assertion 5), and the subpath is missing from llms.txt (17 vs 18), AGENTS.md, README tables | critical | `package.json` exports `./connectivity`; `src/surfaces.ts` has no key; live `basalt check-coverage` → `✖ 1 failure`; `.github/workflows/ci.yml:54` |
| Root `README.md` describes the killed pre-pivot Tailwind/ShadCN/Starlight/Tremor product; tells readers to `@import 'basalt-ui/css'` / `'basalt-ui/starlight'` (exports that no longer exist) | critical | `README.md` L10,27,46,52,62; untouched since `0af5b87` (pre-pivot); `packages/basalt-ui/README.md` already correct |
| `basalt init`'s scaffolded `__root.tsx` never renders page content — `__root.tpl` renders `<BasaltShell .../>` with no children and never imports `Outlet`; `AppShell.Main` is permanently empty | critical | `agent/templates/__root.tpl`; `src/shell/index.tsx:271`; playground root proves `<Outlet/>` required (`apps/playground/src/routes/__root.tsx:16,277`) |
| README quickstart never imports `@mantine/core/styles.css` — literal followers ship an unstyled app (Mantine v9 ships zero component CSS without it) | high | `packages/basalt-ui/README.md` L18-25,65-77; `apps/playground/src/main.tsx:1` imports it first |
| `check-theme`/`guard-hook` default `roots` are argo's own paths (`apps/dashboard/src`, `packages/charts/src`); `walkTsFiles` silently returns `[]` on a missing dir, so any other consumer scans 0 files and prints `✓ no off-palette colors` (false-clean). Required `"basalt": { "roots": [...] }` key is undocumented in README/INTEGRATION-DX | high | `src/cli/index.ts:102-109,125-145,184` |
| `basalt init` unconditionally seeds `query-client.ts` + `__root.tsx` referencing `basalt-ui/query` and `@tanstack/react-router`/`react-query`, though both are documented **optional** peers — a consumer who didn't install them gets files with unresolved imports | high | `src/cli/index.ts:428-452`; `peerDependenciesMeta` marks both optional |
| Persisted threads stuck `'streaming'` forever after reload/remount — live-run map + `controllersRef` init empty, but `ThreadStatus:'streaming'` is persisted; nothing reconciles on mount. Skeleton row never resolves | high `[downgraded]` | `src/agent/use-agent-thread-runs.ts:145,148`; `thread.ts:180,212-220`; `thread-outcome-card.tsx:136-137`. Not fully unrecoverable — reopening+resending restarts a run |
| Subpath barrels eagerly couple independently-`optional` peers: `basalt-ui/data` value-imports both `@tanstack/react-table` **and** `@tanstack/react-virtual`, so either fails without the other; `BasaltOverlays` static-imports modals+spotlight+notifications and calls `createSpotlight()` at module eval — requires all three even when props default-disable the layers | high | `src/data/index.ts:34,40-45`; `data/virtual-list.tsx:18`; `commands/overlays-mount.tsx:46-48,62` |
| `ThreadWorkspace<TPart>` generic is a facade — accepts a consumer-extended `TPart` (JSDoc advertises it, `transport.ts:6`) but double-casts to base `AgentPart` and hands to a non-generic render layer; a custom `part.type` hits `PartList`'s `default: assertNever` and **throws at runtime**, with no way to register a renderer | high `[downgraded]` | `thread-workspace.tsx:53,91,106,109`; `thread-message.tsx:130,186,188`; `part-list.tsx:87` |

### 4.2 Accessibility (Wave 1 high / Wave 4 medium-low)

| Finding | Sev | Evidence |
|-|-|-|
| No accessible text alternative anywhere in the chart system — all 7 kinds + 2 sparklines render a bare `<svg width height>` (no role/aria-label/`<title>`/`<desc>`/data-table fallback). Screen readers get an unlabeled empty graphic | high | grep of `charts/{kinds,sparklines}` returns zero aria/role/title/desc; e.g. `MultiLine.tsx:221`, `Heatmap.tsx:134`, `LineSparkline.tsx:33` |
| Collapsed-sidebar flyout submenu unreachable by keyboard — Popover opens only via `onMouseEnter`/`Leave`, no `onFocus`/`onBlur`; children render exclusively in that hover-only dropdown | high | `shell/app-sidebar.tsx:281-360` (esp. 294,303-304) |
| `BasaltDataTable` sortable headers mouse-only — `Table.Th` with `onClick` but no `tabIndex`/`onKeyDown`/`role`, and no `aria-sort` despite sort state being computed | high | `data/data-table.tsx:169-181` |
| Streaming agent-chat transcript has no `aria-live` region — streaming surfaced only via a visual `<Loader>` | high `[downgraded]` | grep of `agent-chat`/`agent` returns zero `aria-live`/`role="log"`; `thread-detail-panel.tsx:122-135`; `thread-message.tsx:162-182` |
| Legend hover-dim highlight is mouse-only — plain `<div>` with `onMouseEnter`/`Leave`, no `tabIndex`/`role`/focus handlers; keyboard users can't trigger per-series highlight | medium | `charts/…/ChartLegend.tsx:235-260` |
| `ThemeToggle` direct-select popover can close mid-keyboard-interaction — `Dropdown` has no `onFocus`/`onBlur` to cancel the 200ms close timer when tabbing into the `SegmentedControl` | medium | `theme-toggle/index.tsx:129-132,154,159-169` |
| Mobile bottom-nav section tabs expose active state only via CSS `data-active` — no `aria-current`/`aria-selected` | low | `shell/app-mobile-nav.tsx:74-85` |

### 4.3 API / type hygiene (Wave 2)

| Finding | Sev | Evidence |
|-|-|-|
| Shipped oxlint preset leaks package-internal Mantine-free bans onto consumers via unscoped globs — `**/guard/**`, `**/query/**`, `**/router-tanstack/**`, `**/agent/**` ban `@mantine/*`; a consumer with an identically-named `src/query/` or `src/agent/` folder gets false `no-restricted-imports` errors | medium `[downgraded]` | `configs/oxlint.json` L112,142,172,202; `./state` surface already mitigates this in `surfaces.ts` |
| `vite` is a runtime import in the shipped `./vite` subpath but declared only in `devDependencies` — never a peer; the coverage gate is structurally blind to it (`tooling` kind exempt) | medium | `src/vite.ts:17-18`; `package.json:146`; `surfaces.ts:232-237`; `cli/index.ts:849-878` |
| No `retry`/`regenerate` primitive at the multi-thread run layer — `useAgentStream` has `regenerate()`, `useAgentThreadRuns` exposes only `start`/`stop`/`stopAll` and caches no last input; on failure the error Alert forces the user to retype from memory | medium | `use-agent-stream.ts:54-55,131-134`; `use-agent-thread-runs.ts:78-87`; `thread-detail-panel.tsx:129-133` |
| `ThreadRunState.status` typed as full 4-variant `StreamStatus` but only ever holds `'streaming'` — finished runs are `.delete()`d from the map, so `runs.get(id)?.status === 'done'` is type-correct but permanently false | medium | `use-agent-thread-runs.ts:53-58,183,203,226-232` |
| Three overlapping, inconsistently-named status unions (`StreamStatus`, `ThreadStatus`, `AgentOutcome.status`) for adjacent concepts, undocumented subset relationship relied on by structural subtyping; `StreamStatus` uses `'idle'` where `ThreadStatus` uses `'pending'` | medium | `use-agent-stream.ts:36`; `thread.ts:33`; `outcome.ts:35`; `use-agent-thread-runs.ts:225` |
| `AgentThread.meta` is an untyped `Record<string,unknown>` with no generic hook — inconsistent with the framework's own `Slot`/`BasaltRegister` typed-extensibility convention used everywhere else | low | `thread.ts:60,93,165` |
| Root barrel's `export * from './agent-chat'` (`src/index.ts:82`) is the sole wildcard in an otherwise 100%-explicit main entry — silently auto-widens the published root API on any new agent-chat symbol | low | `src/index.ts:82`; `agent-chat/index.ts` |

### 4.4 Docs & doctrine drift (Wave 3)

| Finding | Sev | Evidence |
|-|-|-|
| visx version doctrine wrong in both CLAUDE.md files — claim "8 @visx/* pinned at `4.0.0-alpha.11`, intentionally held, co-scheduled with tsdown"; reality is **9** packages at stable `4.0.0` (matches STATUS.md — the bump already happened) | medium `[downgraded]` | `packages/basalt-ui/CLAUDE.md:84-87`; root `CLAUDE.md:41`; `package.json:123-131`; `bun.lock:929` |
| `@mantine/dates` claimed an optional peer in both CLAUDE.md files but undeclared in `package.json` and unreferenced in `src/` — stale doctrine misleading agents/consumers | medium | root `CLAUDE.md:39`; `packages/basalt-ui/CLAUDE.md:89` |
| AGENTS.md agent-layer rows stale vs SURFACES/llms.txt — root + `./agent` rows omit `ThreadWorkspace`/thread-chat, `createThreadsStore`, `useAgentThreadRuns`, outcome-resolver. No generator/assertion guards AGENTS.md prose (unlike llms.txt) | medium `[downgraded]` | `AGENTS.md:11,23`; `llms.txt:22,97`; `surfaces.ts:335-336` |
| README canonical `BasaltProvider` wiring omits `<ColorSchemeScript>` — documented FOUC/FART pitfall in MANTINE-THEMING.md, and provider docs an SSR nonce path | medium | `README.md:64-78`; `MANTINE-THEMING.md:236-238,388-389`; `provider/index.tsx:69-74,199` |
| STATUS.md doc-map omits 2 living reference docs (`DESIGN-CORE.md`, `MANTINE-THEMING.md`) and the orphaned marketing-doc category — undercuts its "complete map" claim (lists 10 of 18 files) | medium | `STATUS.md:3,78-87` |
| 10 self-declared-dead planning/handover docs (~230KB) sit flat in `docs/` next to the 3 living docs (3:10 signal-to-noise); all already carry accurate supersession banners | medium | banners at `BLUEPRINT.md:3`, `MATURATION-ROADMAP.md:3`, `PHASE-1-*.md:2`, etc. |
| 7 pre-pivot marketing-authoring docs are pure orphans (zero references repo-wide) describing Tailwind-prose/Astro-SSG tooling that won't survive the marketing rebuild | medium | `BRAND_VOICE.md`, `brand_context.yaml`, `llm.md`, `prose/*`, `research/DARK_MODE_IMPLEMENTATION.md` |
| `docs/diagrams/` is an empty, untracked directory (local-only cruft) | low | `git ls-files docs/diagrams` empty |

## 5. Task list

Ordered waves. Each task is independently implementable by a later coding-agent session without
re-analysis. `bun run pre` (fmt:check + lint + typecheck) + pack-test are the validators; **basalt-ui
changes are a separate commit** (empty scope). Ecosystem-norm citations are directional, not gospel.

### Wave 1 — Correctness & broken promises

**T01 — Register `./connectivity` in SURFACES; unblock CI** · critical · S
- Files: `packages/basalt-ui/src/surfaces.ts`, regenerated `llms.txt` + `configs/oxlint.json`,
  `packages/basalt-ui/README.md` (subpath table), `packages/basalt-ui/AGENTS.md` (subpath table).
- Steps: add a `'./connectivity'` entry to `SURFACES` (`kind:'doctrine'`, `layer:'mantine-coupled'`,
  description covering `ConnectivityProvider`/`ConnectivityIndicator`/`useConnectivity`); run
  `bun scripts/gen-llms.ts` and `bun scripts/gen-oxlint.ts`; add the row to the README + AGENTS subpath tables.
- Accept: `node packages/basalt-ui/bin/basalt.mjs check-coverage` → 8/8 pass; llms.txt has 18 entries.
- Deps: none. **Do first — this is the current CI-red blocker.**

**T02 — Rewrite root README.md for the post-pivot product** · critical · S
- Files: `README.md` (repo root).
- Steps: replace tagline, feature list, install/usage, and repo-structure block to mirror
  `packages/basalt-ui/README.md`'s framing (Mantine v9 + visx, `bunx basalt init`, subpath table,
  `apps/playground`+`apps/marketing`). Delete all Tailwind/ShadCN/Starlight/Tremor/`./css`/`./starlight`/`apps/web`
  references. A thin pointer to `packages/basalt-ui/README.md` + monorepo structure is acceptable.
- Accept: no grep hit for `Tailwind|ShadCN|Starlight|Tremor|basalt-ui/css|basalt-ui/starlight|apps/web` in `README.md`.
- Deps: none.

**T03 — Add `<Outlet />` to the `__root.tpl` scaffold** · critical · S
- Files: `packages/basalt-ui/agent/templates/__root.tpl`.
- Steps: import `Outlet` from `@tanstack/react-router`; render `<BasaltShell ...><Outlet /></BasaltShell>`,
  matching `apps/playground/src/routes/__root.tsx`.
- Accept: the seeded root route renders child route content, not an empty `AppShell.Main`.
- Deps: none. **Blocks T06.**

**T04 — Add `@mantine/core/styles.css` import to README quickstart** · high · S
- Files: `packages/basalt-ui/README.md` ("Wire the runtime", ~L65-77).
- Steps: add `import '@mantine/core/styles.css'` ordered **before** `import 'basalt-ui/styles.css'`.
- Accept: following the quickstart verbatim yields a styled app.
- Deps: coordinate with T31 (same snippet).

**T05 — Make `check-theme` fail loud on zero-scan; document `roots`** · high · M
- Files: `packages/basalt-ui/src/cli/index.ts` (`checkTheme`), `packages/basalt-ui/README.md`,
  `apps/playground/package.json`.
- Steps: (1) in `checkTheme`, when total scanned files == 0, print a warning
  (`basalt check-theme: 0 files scanned across configured roots — set "basalt": { "roots": [...] }`);
  (2) document the `"basalt": { "roots": [...] }` key in the README quickstart; (3) add
  `"basalt": { "roots": ["src"] }` to `apps/playground/package.json` so the flagship consumer dogfoods the guard.
- Accept: `check-theme` in a repo with unresolved roots warns instead of printing `✓`; playground scans >0 files.
- Deps: none.

**T06 — Gate router/query scaffolding on installed peers** · high · M
- Files: `packages/basalt-ui/src/cli/index.ts` (`managedFiles`, run/flag parsing).
- Steps: detect whether the consumer's `package.json` depends on `@tanstack/react-router`/`react-query`
  (or add `--with-router`/`--with-query` flags); only append the `queryClient`/`rootRoute` seed entries
  when present. Skipped files should print a hint.
- Accept: `basalt init` in a project without TanStack peers writes no files with unresolved imports.
- Deps: **T03** (the now-conditionally-seeded `__root.tsx` must be correct first).

**T07 — Reconcile orphaned in-flight threads on mount** · high · S
- Files: `packages/basalt-ui/src/agent/use-agent-thread-runs.ts`, optionally `agent/thread.ts` (new status),
  `agent-chat/thread-detail-panel.tsx`.
- Steps: on mount, for every `store.threads` entry with `status` `'streaming'`/`'pending'` and no
  `controllersRef` entry, call `store.setStatus(id, 'error')` — or add a distinct `'interrupted'`
  `ThreadStatus` and render "Interrupted — resend to continue".
- Accept: a reload during a stream leaves the thread in a terminal/interrupted state, not an unresolving skeleton.
- Deps: none (synergizes with T16).

**T08 — Split `./data` into `./data/table` + `./data/virtual`; lazy-load `BasaltOverlays` layers (Decision A)** · high · M
- Files: `packages/basalt-ui/src/data/index.ts`, `data/virtual-list.tsx`, `commands/overlays-mount.tsx`,
  `package.json` (exports), `tsup.config.ts`, `src/surfaces.ts`, pack-test subpath list.
- Steps: (1) add subpath exports `./data/table` (`BasaltDataTable`; peer `@tanstack/react-table`) and
  `./data/virtual` (`BasaltVirtualList`; peer `@tanstack/react-virtual`); keep `./data` as a convenience
  barrel re-exporting both, JSDoc'd as "pulls both peer groups — use the fine subpaths for per-feature
  opt-in". (2) Wire the new subpaths through the exports map, tsup entries, and SURFACES (llms.txt/oxlint
  regenerate from it; the agents-sync test forces the AGENTS.md rows). (3) Lazy-import each `BasaltOverlays`
  layer behind its flag, mirroring `agent/stick-to-bottom.tsx`'s `React.lazy` + missing-peer `.catch`
  fallback; fix the misleading "set `spotlight={false}` to avoid it" comment in `overlays-mount.tsx`.
  (4) Extend the pack-test subpath-resolution gate to the two new subpaths.
- Accept: importing `./data/table` resolves without `@tanstack/react-virtual` installed (and vice versa);
  mounting `BasaltOverlays` with a missing optional peer degrades to the fallback instead of crashing;
  `check-coverage` + pack-test green including the new subpaths.
- Deps: none. Ecosystem norm: `peerDependenciesMeta.optional` exists precisely to gate subfeatures per-feature.

**T09 — Drop the `ThreadWorkspace` `TPart` facade; hardcode `AgentPart` (Decision B)** · high · S
- Files: `agent-chat/thread-workspace.tsx`, `thread-detail-panel.tsx`, `thread-message.tsx`; leave the
  headless `agent/part-list.tsx` untouched unless its generic shares the same unsoundness.
- Steps: remove the `TPart` type parameter from the chat components and type parts as `AgentPart`
  end-to-end; delete the unsound casts and the false justification comment at
  `thread-workspace.tsx:102-105`; strip JSDoc that advertises custom part types at the workspace level
  (also check `agent/rules/basalt-agent.md` for the same claim) and point custom-part consumers at the
  headless layer (`PartList` + renderers) instead.
- Accept: no casts bridging `TPart`→`AgentPart` remain; no advertised usage can reach the runtime
  `assertNever` throw; nothing documents workspace-level custom parts; typecheck green.
- Deps: none.

**T10 — Chart accessible text alternative + guard rule** · high · M
- Files: `charts/ChartFrame.tsx`, `charts/ResponsiveChart.tsx`, `charts/sparklines/*`, `src/guard/index.ts`.
- Steps: add an `ariaLabel` prop plumbed to the outer `<div>` in **both** `ChartFrame` (covers MultiLine/Bars/
  DualPanel/Donut/ZonedLine/StackedArea) and `ResponsiveChart` (covers Heatmap), plus directly on
  `LineSparkline`/`BarSparkline`. Add a guard rule mirroring `raw-visx-axis`/`unframed-chart` to enforce it.
- Accept: every chart entry point accepts+applies an accessible label; guard flags a chart without one.
- Deps: none. Ecosystem norm: visx ships no a11y layer — labeling is the consuming design system's job.

**T11 — Keyboard-reachable collapsed-sidebar flyout** · high · S
- Files: `shell/app-sidebar.tsx` (parent-with-children Popover, ~L281-360).
- Steps: add `onFocus`/`onBlur` (→ `scheduleOpen`/`scheduleClose`) to `Popover.Target` and `Popover.Dropdown`,
  mirroring `theme-toggle/index.tsx:151-154`. Consider `keepMounted` if focus-into-dropdown needs it.
- Accept: Tab-focusing a collapsed parent reveals + lets you reach its children.
- Deps: none.

**T12 — Keyboard-sortable DataTable headers + `aria-sort`** · high · S
- Files: `data/data-table.tsx:169-181`.
- Steps: on sortable `Table.Th` add `tabIndex={0}`, `onKeyDown` firing the toggle on Enter/Space, and
  `aria-sort` from `getIsSorted()` (`ascending`/`descending`/`none`).
- Accept: keyboard users can toggle sort; screen readers announce sort state.
- Deps: none.

**T13 — `aria-live` on the streaming transcript** · high · S
- Files: `agent-chat/thread-message.tsx` (live `MessageBlock` branch, ~L212-214).
- Steps: wrap **only** the trailing in-flight block in `<div aria-live="polite" aria-atomic="false"
  aria-relevant="additions">` (not the settled history), to avoid re-announcing the whole thread per chunk.
- Accept: streamed deltas are announced; settled history is not replayed on each chunk.
- Deps: none.

### Wave 2 — API / DX improvements

**T14 — Stop the shipped oxlint preset banning consumer folders** · medium · S
- Files: `packages/basalt-ui/src/surfaces.ts`, regenerated `configs/oxlint.json`.
- Steps: in `surfaces.ts`, set `globs.shipped: []` for `./guard`, `./query`, `./router-tanstack`, `./agent`
  (keep `globs.repo` for internal enforcement), mirroring the existing `./state` surface; regenerate via the
  oxlint generator (do **not** hand-edit `configs/oxlint.json`).
- Accept: a consumer with `src/query/` or `src/agent/` importing `@mantine/core` gets no false error;
  `sync --check`/coverage stay green.
- Deps: none.

**T15 — Declare `vite` as an optional peer** · medium · S
- Files: `packages/basalt-ui/package.json`.
- Steps: add `vite` to `peerDependencies` (broad range matching the devDep major, e.g. `^7 || ^8`) + mark
  optional in `peerDependenciesMeta`.
- Accept: consumers importing `basalt-ui/vite` get a version-compat signal.
- Deps: none.

**T16 — `retry(threadId)` at the multi-thread run layer** · medium · S
- Files: `agent/use-agent-thread-runs.ts`, `agent-chat/thread-detail-panel.tsx`.
- Steps: cache last user input per thread (`Map<string,string>` ref updated in `start()`); expose
  `retry: (id) => void` in `UseAgentThreadRunsReturn` that replays it; wire a "Retry" action into the error Alert.
- Accept: after a failed run the user can retry without retyping.
- Deps: pairs with T07.

**T17 — Narrow `ThreadRunState.status`** · medium · S
- Files: `agent/use-agent-thread-runs.ts:53-58,32`.
- Steps: narrow `status` to the literal `'streaming'` (or drop the field — presence-in-map already means
  streaming); fix the JSDoc example that implies `'done'`/`'idle'`/`'error'` are reachable.
- Accept: no type suggests an unreachable status on `ThreadRunState`.
- Deps: none.

**T18 — Document/align the three status unions** · medium · S
- Files: `agent/outcome.ts` or `agent/thread.ts`.
- Steps: add a doc block stating `AgentOutcome.status ⊆ ThreadStatus` (terminal subset); consider renaming
  `StreamStatus`'s `'idle'` → `'pending'` to match `ThreadStatus` vocabulary.
- Accept: the subset relationship + vocabulary mapping is explicit.
- Deps: none.

**T19 — Document `AgentThread.meta` as a deliberate untyped escape hatch (Decision C)** · low · S
- Files: `agent/thread.ts:60,93,165`.
- Steps: keep the untyped bag; JSDoc `meta` as intentionally untyped — narrow at the read site (include a
  one-line example) — and state the revisit trigger: add a `TMeta` generic only when a real consumer needs
  typed meta.
- Accept: `meta`'s JSDoc carries the escape-hatch contract + revisit trigger; no generic added.
- Deps: none.

**T20 — Make the root barrel's agent-chat re-export explicit** · low · S
- Files: `src/index.ts:82`.
- Steps: replace `export * from './agent-chat'` with explicit named re-exports mirroring `agent-chat/index.ts`.
- Accept: the main entry has no wildcard; new agent-chat symbols need a deliberate export.
- Deps: none.

**T21 — Keyboard-operable legend highlight** · medium · S
- Files: `charts/ChartLegend.tsx:235-260`.
- Steps: make each legend entry focusable (`tabIndex={0}`, `role="button"` or `<button>`), add `onFocus`/`onBlur`
  mirroring the mouse handlers, and an `aria-label` naming the series.
- Accept: keyboard users can trigger per-series highlight.
- Deps: none.

**T22 — `ThemeToggle` popover keyboard-stable** · medium · S
- Files: `theme-toggle/index.tsx:159`.
- Steps: add `onFocus` (→ `scheduleOpen`) to `Popover.Dropdown` so tabbing from trigger into the
  `SegmentedControl` cancels the pending close.
- Accept: keyboard navigation into the dropdown doesn't race it closed.
- Deps: none.

**T23 — Mobile bottom-nav `aria-current`** · low · S
- Files: `shell/app-mobile-nav.tsx:75-84`.
- Steps: add `aria-current={section.active ? 'page' : undefined}` to the tab `UnstyledButton`.
- Accept: screen readers announce the active section on the mobile breakpoint.
- Deps: none.

**T32 — Establish the `./data` opinionated-grid lane + raw escape hatch (Decision D)** · medium · S
- Files: `packages/basalt-ui/src/data/index.ts` (the table subpath entry after T08), `agent/rules/basalt-data.md`.
- Steps: re-export the raw TanStack table escape hatch (`useReactTable`, `flexRender`, `createColumnHelper`,
  type `ColumnDef`) from the table subpath where not already exported; state the lane in `basalt-data.md`:
  `BasaltDataTable` is the blessed opinionated grid, the raw re-exports are the escape hatch for bespoke
  tables. Note that grid feature growth (pagination, server-side data, column visibility) is consumer-pulled
  future work and controlled sorting stays deferred (§7).
- Accept: a bespoke table builds from the subpath's re-exports alone (no direct `@tanstack/react-table`
  import in consumer code); `basalt-data.md` states the lane; `check-coverage` green.
- Deps: T08 (subpath split lands first).

### Wave 3 — Documentation cleanup (file-by-file inventory)

Target end-state living doc set: `STATUS.md` + `DESIGN-CORE.md` + `MANTINE-THEMING.md` +
`MATURATION-REVIEW.md` (this file). Everything else is archived, deleted, or fixed.

**T24 — Archive the 10 dead planning/handover docs** · medium · S
- Steps: `git mv` into new `docs/archive/`: `BLUEPRINT.md`, `MATURATION-ROADMAP.md`, `ENFORCEMENT-HARDENING.md`,
  `INTEGRATION-DX.md`, `PHASE-1-DESIGN.md`, `PHASE-1-GROUNDING.md`, `PHASE-1-HANDOVER.md`,
  `PHASE-1-IMPLEMENT-HANDOVER.md`, `EXECUTION-HANDOVER.md`, `ONE-ZERO-DRIVE-HANDOVER.md`. No content edits
  (banners already state status); fix each banner's relative `./STATUS.md` link → `../STATUS.md`.
- Accept: `ls docs/` shows only the living set + `archive/`; moved banners' cross-links resolve.
- Deps: coordinate with T26 (STATUS.md doc-map paths).

**T25 — Delete the 7 orphaned pre-pivot marketing docs** · medium · S
- Steps: `git rm` `docs/BRAND_VOICE.md`, `docs/brand_context.yaml`, `docs/llm.md`, `docs/prose/PROSE_TRANSITION.md`,
  `docs/prose/tailwind_prose.md`, `docs/prose/prose_styles.js`, `docs/research/DARK_MODE_IMPLEMENTATION.md`
  (zero references repo-wide; describe Tailwind/Astro tooling that won't survive the marketing rebuild). If
  voice guidance is wanted later, it belongs inside `apps/marketing/` when that work starts.
- Accept: those files are gone; no dangling references.
- Deps: none.

**T26 — Fix STATUS.md doc map** · medium · S
- Files: `docs/STATUS.md:78-87`.
- Steps: add a "Living reference" row (`DESIGN-CORE.md`, `MANTINE-THEMING.md`, `MATURATION-REVIEW.md`); update
  the superseded/historical rows to point at `docs/archive/` after T24. Optionally note the deleted marketing docs.
- Accept: the doc map accounts for every file under `docs/`.
- Deps: T24 (paths), T25 (deletions).

**T27 — Remove empty `docs/diagrams/`** · low · S
- Steps: `rmdir docs/diagrams` (untracked local cruft), or add a placeholder `README.md` if diagrams are planned.
- Accept: no empty untracked dir.
- Deps: none.

**T28 — Correct visx version doctrine in both CLAUDE.md** · medium · S
- Files: `packages/basalt-ui/CLAUDE.md:84-87`, root `CLAUDE.md:41`.
- Steps: state the true pin — **9** `@visx/*` packages (add `@visx/responsive`) exact at stable `4.0.0`;
  drop the "alpha.11 intentionally held / co-scheduled with tsdown" framing (STATUS.md already records the bump).
- Accept: doctrine matches `package.json` + STATUS.md.
- Deps: none.

**T29 — Remove stale `@mantine/dates` doctrine** · medium · S
- Files: root `CLAUDE.md:39`, `packages/basalt-ui/CLAUDE.md:89`.
- Steps: remove the "@mantine/dates optional peer" claim from both (undeclared + unused). If a date-picker
  integration is genuinely planned, instead add it to `peerDependencies`/`peerDependenciesMeta` now.
- Accept: doctrine and `package.json` agree.
- Deps: none.

**T30 — Refresh AGENTS.md agent-layer rows** · medium · S
- Files: `packages/basalt-ui/AGENTS.md:11,23`.
- Steps: update the root + `./agent` rows to match llms.txt's current text (ThreadWorkspace/thread-chat,
  `createThreadsStore`, `useAgentThreadRuns`, outcome-resolver). Optional follow-up: extend `scripts/gen-llms.ts`
  to also patch AGENTS.md's subpath table from SURFACES so it can't drift again.
- Accept: AGENTS.md rows match SURFACES/llms.txt.
- Deps: T01 (the connectivity row should also land here).

**T31 — Add `<ColorSchemeScript>` to README wiring** · medium · S
- Files: `packages/basalt-ui/README.md:64-78`.
- Steps: add `<ColorSchemeScript defaultColorScheme="dark" />` (matching `BasaltProvider`'s default) with a
  one-line SSR/FOUC callout.
- Accept: following the README doesn't hit the documented FART pitfall.
- Deps: coordinate with T04 (same snippet).

### Wave 4 — Polish

Medium/low a11y and hygiene items already itemized as tasks: **T19, T20, T21, T22, T23**. No additional
Wave-4-only tasks — the remaining low-severity findings are covered above.

## 6. Resolved decisions (2026-07-06)

Owner decisions, baked into the tasks above. Implementation sessions execute these as settled — do not
re-litigate.

**A. Optional-peer coupling in `./data` / `BasaltOverlays` → split + lazy-load (T08).**
Split `./data` into `./data/table` and `./data/virtual`; lazy-import each `BasaltOverlays` layer behind its
flag. Preserves true per-feature opt-in — the point of the subpath topology, and the ecosystem norm for
`peerDependenciesMeta.optional`. T08 carries the concrete steps.

**B. `ThreadWorkspace` `TPart` → drop the generic, hardcode `AgentPart` (T09).**
The display layer doesn't use the flexibility, and the current generic is a facade (unsound casts, reachable
runtime `assertNever` throw). Strict concrete typing wins. The headless layer (`PartList` + renderers) remains
the extension point if custom parts ever materialize; chat-level extensibility can return at the next major.

**C. `AgentThread.meta` → keep the untyped bag, document it (T19).**
Same principle as B: no speculative generic machinery for unused flexibility. JSDoc `meta` as a deliberate
escape hatch narrowed at the read site; add a `TMeta` generic only when a real consumer needs typed meta.

**D. `./data` lane → opinionated grid (T32).**
`BasaltDataTable` is the blessed, batteries-included grid (Mantine-React-Table direction, not a shadcn-style
copy-paste recipe). Per the ecosystem norm both lanes share, the raw `useReactTable`/`ColumnDef` escape hatch
must be exported and documented — T32. Grid feature growth (pagination, server-side data, column visibility)
is future feature work pulled by a real consumer (argo), not this review; the controlled-sorting deferral in
§7 stays deferred.

**E. Peer-surface size — no change (informational).**
The surface is large because the framework scope is large, and it's correctly optional-gated
(`check-coverage` already asserts `optionalPeers` ⊆ declared peers; T15 covers `vite`). No task.

## 7. Explicitly not doing

Deferred **by design** for 1.0 (do not re-propose — see STATUS.md):
- **tsdown migration** — documented NO-GO for 1.0; tsup stays.
- **Phase-5 kill-list** — bottom-sheet, PWA vite helper + runtime hooks, canvas-line-kind, appshell-aside-slot,
  `create-basalt-app` scaffolder, dtcg-interchange, `@mantine/dropzone`, full `<Chat>`/voice, and the rest of that
  documented kill-list.
- **`no-explicit-any` → error escalation**, **`./state` static-lint globs**, **controlled `DataTable` sorting prop**
  — three justified deferrals.
- **Removing the three `@deprecated` back-compat aliases** (`state.ts:38` legacy connectivity export;
  `ZonedLine`/`ZonedBars` `ZoneSpec` aliases) — scheduled for the next major.
- **Lane D gates and the argo-side consumer migration** — explicitly deferred (separate repo task).

Killed in verification as not worth doing now (stays dead):
- **MCP server for basalt-ui docs** `[unverified]` — the corpus (11 rule files, one SSOT-generated llms.txt,
  `check-coverage` sync) is small enough to `Read`/`Grep` directly; an MCP query layer earns its complexity only if
  the rule corpus grows past economical direct reading or needs cross-repo search. Ecosystem note: Mantine/shadcn
  ship one, but that's the advanced tier, not the mid-2026 baseline — a prioritization call, not a compliance gap.
