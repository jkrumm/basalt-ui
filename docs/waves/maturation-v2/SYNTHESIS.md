# basalt-ui 2.x maturation: synthesis of the 9 area audits

Inputs: provider-wiring, shell, controls-forms, charts, data-content-commands, tokens-theme, guards, cli-agent-dx, consumer-usage (verdicts already amended/confirmed). Ground rules carried from AGENTS.md: no `feat!:`/`BREAKING CHANGE:` (breaks ship as plain `feat:` on 2.x with a MIGRATING entry and opt-out), `packages/basalt-ui/**` is always its own commit, adopt-or-delete, net-negative waves, one doctrine one home.

Prerequisites outside this plan: PR #285 (slots / registry mechanism) and #286 (root-context typing) land before any step marked `[after #285]` or `[after #286]`.

## 1. Cross-cutting themes

T1. Identity and memo instability (things recreated per render/navigation): provider-02, shell-01, shell-02, shell-06, shell-23, charts-02, charts-19, cf-27, dcc-21 (options bundle). Fix is framework-owned stability (cached anchors, latest-ref, structural compare), not consumer "hoist it" docs.

T2. Wiring left to every consumer: provider-01, 04, 08, 10, 15; consumer-04, 06, 22, 24; cli-02, 07, 16; tokens-theme-21; shell-07, 08; consumer-03, 07; dcc-06, 13, 16, 18. One factory/default per seam.

T3. Dead or consumer-less surface (adopt-or-delete): shell-04/05/16/20; cf-02/03/04/05; charts-18; dcc-01/03/08/10; tokens-theme-01(partly)/06/10/11/13/14; consumer-21; guards-14 (partial); cli-08/12/13/19; consumer-17. Largest net-negative source.

T4. Duplicate implementations of one concept: relative time x4 (cf-05, dcc-12, consumer-05); icons/glyphs (shell-20, cf-25); color math (tokens-theme-11); fold/measure engines (cf-11, cf-12); tooltip/cursor pipeline and chrome (charts-06, 13); intent/severity vocabularies (dcc-09); chart height (charts-03, consumer-01); error surfaces (consumer-04); registry ids (guards-15).

T5. Prose-only or runtime-throw contracts that should be types or lint: dcc-02, dcc-04/05/23, shell-03/12/13, charts-01/10/16, cf-13/14/20, guards-02/03/12/17, consumer-10, provider-03, charts-12 (four failure policies).

T6. Guard honesty and engine split: guards-01/02/04/05/06/07/08/10/15/16/17/22/25; consumer-09/26; tokens-theme-07; charts-17; dcc-23; cli-03/09. Rules claim more than they enforce; two engines with divergent provenance; waivers drifting.

T7. Agent-layer steering: cli-01/02/03/04/05/11/15/19/22/24/25/27. Rules not loading in real layouts, hook installed 1/5, messages without pointers.

T8. Token/theme pipeline double channel: tokens-theme-01/02/03/04/05/12/25, consumer-16/17, provider-15. Four builders, a style tag beside the resolver, hand-authored zinc tail.

T9. Docs/comments narrate history and drift from code: provider-20, cf-16, dcc-14/22, tokens-theme-17/18, charts-23, shell-09, guards-13, cli-06/18, cf-26/shell-24/cli-21/dcc-25/tokens-theme-19 (tests pinning prose/CSS strings/numbers).

T10. Missing shell-less page and state primitives (consumer demand): shell-08, consumer-03/07, consumer-02, consumer-01, consumer-06, consumer-08, consumer-12, consumer-23, shell-07.

## 2. Conflicts and resolutions

C1. shell-14 / provider-17 / dcc-07 / dcc-11 / consumer-24 / cli-16 all depend on #285's registry shape. Resolution: do nothing registry-related until #285 merges; one re-audit step in Wave 8 owns all of them (nav on provider/slots, getActiveNav deleted, dev-warn on double define). Nothing before Wave 8 touches `defineNav`/`defineOverlays`/`defineCommands` semantics.

C2. shell-04 (delete `account`, `brand.menu`, `isActive`...) vs consumer-06 (add `account.signOut`, colorScheme prop, refresh prop). Resolution: delete the unused account surface in Wave 5; consumer-06 re-adds only what argo/rb/linewatch use as a small `BasaltShell` option set (`colorScheme`, `refresh` bound to QueryClient, `signOut` as a global action) in Wave 8. Net deletion stays.

C3. consumer-03 (BasaltPage + CenteredScreen) vs consumer-07 (one Page primitive, "do not ship two") vs shell-08. Resolution: ship exactly one `BasaltPage` (container, gutter, PageBar bleed, Stack gap) plus `CenteredScreen`; shell-07 CSS vars (`--basalt-page-fill-h`, `--basalt-page-bleed`) published by ShellBody. consumer-14 and guards-11 fold into it (guard keys on component, not path).

C4. consumer-17 / tokens-theme-01 / tokens-theme-02 (knobs unused: delete vs keep). Resolution: keep all four knobs (user wants a single config surface and amended verdicts say keep), but collapse to one resolver-owned builder; `BasaltProvider theme` accepts `BasaltThemeOptions`; remove `injectPalette`, `BasaltBridge` style tag. Put knobs on the adopt-or-delete clock in MIGRATING.

C5. charts-03 (`height: 'fill'`, keep `matchHeight` deprecated) vs charts-18 (delete unused) vs consumer-01. Resolution: ChartCard owns height via context; `matchHeight` kept one minor as alias then deleted; `placeholderHeight` deprecated in the same wave and removed in Wave 10 after argo migrates.

C6. charts-01 (keep ChartState shape, ship `chartStateOf`) vs consumer-02 (ChartCard `query` prop, delete `chartStateOf`). Resolution: ChartCard/Section/StatCard share one `query` prop built on exported `QueryState`; the argo-local `chartStateOf` is deleted, nothing new ships under that name. The empty-data auto-state from charts-01 lands in the same step. `basalt/chart-data-fallback` lint rule ships in Wave 3.

C7. guards-14 (keep retired ids/grace) vs cli-13 (sunset 1.x scaffolding). Resolution: keep the grace ledgers (landing point for warn-landing); remove only duplicates; sunset the 1.x doctor tables/skill section only after weatherorb finishes W37-45.

C8. guards-08 (convert preset warns to error/off) vs consumer-26. Same direction; one step. `no-console` scoped, not banned; one exhaustive-deps rule.

C9. guards-05 (`basalt/banned-import` rule) vs dcc-23/consumer-10 (notifications/modals import bans). Resolution: one rule fed by `SURFACES.forbiddenImports` with additive `settings.basalt.bannedImports`; notifications/modals/spotlight/react-markdown entries ride on it. `@mantine/modals` ban gated on #285 outcome for `defineOverlays`.

C10. cf-09 (forms layer: keep `inputProps`, drop `fieldKey`, or delete) vs cf-02/04 (delete dead form layer). Resolution: delete dead FormRow/FormGroup/FormSection/FormActions/form-state first (Wave 5); measure the `inputProps`/`fieldKey` idiom in Wave 9 against argo auth-gate and issues-section, then pick drop-`fieldKey` or delete subpath. No `Field` component.

C11. charts-05 `legend` on zones vs charts-10 discriminated series union vs charts-11 default mark drawing. Order inside the chart waves: series union (charts-10) first because it fixes the `getValue: () => null` fake-series hack; first-class legend entries and default mark drawing build on it.

C12. cli-09 (single `basalt-ui check`) vs guards-04/15 (typed plugin build). Resolution: guard engine groundwork lands first (Wave 3), `check` command and structured reporter in Wave 4, regex kinds with AST twins fold in opportunistically.

C13. tokens-theme-04 (drop component-named space tokens, `only:'core'` disappears) vs rollhook using `--only core`. Resolution: rollhook is a named consumer; keep `--only core` as a no-op alias for one minor then delete; `tokens:css --tailwind` (consumer-25) lands in the same wave.

## 3. Wave plan (each independently shippable as one 2.x minor with a MIGRATING entry)

Every wave: package change is its own commit (basalt-ui isolation); consumer migration PRs follow in the consumer repos; `make check` green; MIGRATING entry has the opt-out. Wave numbering = ship order.

### Wave 1: Wiring correctness and stability (non-breaking, foundation)

Goal: kill remounts, render-time side effects and SSR divergence; one router-options factory.

1. Stable nav anchors and badge identity. Ids: provider-02, shell-01, shell-02, shell-23, shell-06. Files: `router-tanstack/use-nav.ts`, `shell/app-sidebar.tsx`, `shell/app-mobile-nav.tsx`, `shell/app-breadcrumbs.tsx`, `shell/page-bar.tsx`, `shell/page-aside.tsx`, `shell/index.tsx`. WeakMap-cached anchor per item, shallow-compare badges, `useNav` returns `activeCrumb`, narrow memoized contexts. DOM-identity test. Breaking: none. Delete: `findActiveCrumb` walk, hoist-the-badges warning. Consumers: argo, rb, obsidian, linewatch verify focus survives navigation; delete any hoisted `badges` constants.
2. `basaltRouterOptions` + public `BasaltProviderProps`. Ids: provider-01, provider-10 (only if factory lands), provider-04 (optional `history`, managed keys typed `never`, promote test-router internals inside existing surface), provider-16 (export type only). Files: `provider/create-router.tsx`, `provider/index.tsx`, `provider/telemetry.ts`, `query-client.ts`, `index.ts`. Breaking: none. Consumers: weatherorb Start `getRouter()` spreads the factory (drops copied defaults); rb replaces 3 hand-rolled test harnesses.
3. Pure `validateSearch` and search-store hygiene. Ids: provider-05, provider-06 (minor), provider-07 (dev warn only), provider-21 (collapse pass-through wrapper only), provider-22 (one renderToString+hydrate test per lane). Files: `router-tanstack/search-store.ts`, `state/persisted.ts`, `state/fields.ts`, `agent/rules/basalt-state.md`. Breaking: wrapper collapse touches argo `window-stores.ts` and rb library store (type-compatible re-export kept one minor). Consumers: weatherorb (SSR), argo, rb.
4. Telemetry correctness. Ids: provider-09 (hash mutation key), provider-08 (dev console sink default; OTel mapping as init-template recipe, not runtime export), provider-11 (retry skips 4xx), provider-12 (thenable check, trim JSDoc). Files: `telemetry.ts`, `provider/index.tsx`, `query-client.ts`. Breaking: none (retry default change noted). Consumers: argo (HyperDX attribute change; delete local 70-line sink if covered), rb, linewatch gain error visibility.
5. PageAside ownership. Ids: shell-18. Files: `shell/page-aside.tsx`. Claim by `useId` Set, dev-warn second claimant. Consumers: argo site-map. Add two-aside test.

### Wave 2: Format layer and small correctness bugs

Goal: one correct, locale-aware `basalt-ui/format`; fix blockers.

1. `money`/`integer`/`km`/`kcal`. Ids: cf-01 (blocker; digits undefined leaves Intl default), cf-22, cf-23 (drop `fmt*` aliases, keep short names; `LocaleOption | undefined`). Files: `format/number.ts`, `format/measure.ts`, `format/shared.ts`, tests. Breaking: money output changes (no consumer uses it). Consumers: argo walking-pad/garmin (km, kcal).
2. One relative-time. Ids: cf-05, cf-07, dcc-12 (relative-time part). Files: `format/date.ts`; delete `agent/chat/relative-time.ts`, `SyncButton.formatAge`, `commands/notifications/center.tsx` copy. Intl numeric:auto, injectable `now`, style long/short/narrow. Consumers: argo (10 imports; drop local copies at `walking-pad/formatters.ts:30`, `usage-tracking/constants.ts:98`).
3. Provider-level locale/timeZone and missing formatters. Ids: cf-06, consumer-05 (only formatters with 2+ named duplicates: duration styles, bytes, signed delta, null-safe dash). Files: `format/*`, `provider/index.tsx`. Consumers: rb (`lib/format.ts` en-US pin deleted), linewatch (`lib/format.ts` null dash), argo (5 duration spellings). `money` stays on the adopt-or-delete clock.
4. Filter correctness. Ids: cf-18 (flush on Enter/blur/unmount), cf-19 (single accessible name, `disabled`), cf-08 (RangeFilter uses format + `reportOnce`), cf-14 (shared `FilterBase`, one Option type), cf-20 (overload `custom` vs `customPicker`, export picker props), cf-25 (move helpers/glyphs). Files: `controls/*-filter.tsx`, `view-tabs.tsx`, `filter-sheet.tsx`, `glyphs.tsx`. Breaking: option-type unification may touch NumberFilter/Select option literals (linewatch, argo). Contract tests for cf-01/07/18 (cf-26).

### Wave 3: Guard engine foundation and honesty

Goal: one provenance model, typed sources, rules that do what the prose says.

1. Typed plugin build. Ids: guards-04 (enabling step only: shared provenance/waiver helpers as typed TS bundled into `configs/oxlint-plugin.js`, drift check), guards-15 (generate `oxlint-basalt.json` and id sets from one rule table), guards-14 (remove duplicate `KNOWN_RULE_IDS` entry), guards-20 (batched fixture runs, target <15s). Files: `configs/oxlint-plugin.js` (becomes build output), new `configs/plugin-src/*.ts`, `src/surfaces.ts`, `src/guard/index.ts`, `configs/oxlint-plugin.test.ts`. Breaking: none.
2. Alias/namespace provenance. Ids: guards-01 (card-with-border, card-inset, in-body-page-title via `resolveMantineTag`/`resolveBasaltTag`; meta-test forbidding direct `node.name.name` in JSX rules), guards-16 (reproduce first, reject reason-less scoped waiver), consumer-09 (reconcile card padding: flag explicit padding to match `basalt-mantine.md`). Breaking: previously-clean aliased code now errors (argo/rb/linewatch re-run lint; waivers by guard id keep working via `WAIVER_ID_ALIASES`).
3. Claims-vs-enforcement. Ids: guards-02 (extend each guard or delete the sentence; `rule-claims.test.ts` one violating fixture per "never"), guards-12 (`// guards: X` ratchet with baseline of 17 gaps), tokens-theme-07 + guards-10 (inline-radius via `isAllowedCssRadius`, message names `VX.radiusPill`), charts-17 (`CHART_TAGS` generated from charts index + sync test), guards-13 (docs-only alignment, useSizeClass). Consumers: rb (2 waivers), linewatch (1 waiver) removed.
4. New and removed rules. Ids: guards-03 (ban `as never` on Link/navigate/redirect/linkOptions), guards-17 (delete `query-fn-unwrap` and its doctrine sentence unless made type-aware; default is delete), dcc-23 + guards-05 + consumer-10 (`basalt/banned-import` fed by `SURFACES.forbiddenImports`; additive `settings.basalt.bannedImports`; notifications/spotlight/react-markdown/raw Table bans), charts-17 (`chart-data-fallback`, unstable-props), dcc-04 (`basalt/markdown-content-trust`). Breaking: generated `no-restricted-imports` override emission dropped after argo and obsidian migrate; argo deletes verbatim antd/framer-motion copies. Add `SafeSvg` only if argo `vega-lite-diagram` migrates in the same cycle.
5. Preset warn tier. Ids: guards-08, consumer-26, guards-06 (`ai-sdk-major` honours `basalt.aiMajorSkewReason`; retire `basalt-agent-allow`), guards-22 (descriptions for error-level rules), guards-25 (ratchet budgets + `guardLines`). Breaking: warn rules become error/off; `--deny-warnings` seeded; argo drops 8 `basalt-agent-allow` waivers and ~17 `no-console` disables. Add a test asserting no warn levels in preset.

### Wave 4: Agent layer and one gate command

Goal: rules load in real layouts, hook installed everywhere, every message points at its doctrine.

1. Rule paths and messages. Ids: cli-01 (render `paths:` from `basalt.roots`/`basalt.app`; verify Claude Code `paths:` semantics via /research first), cli-03 (what/fix/(rule file § section)/[id], generated from `surfaces.ts`, length test), cli-11 (strip maintainer coverage block from shipped rules), cli-15 (verify nested discovery first; add doctor reachability check). Files: `agent/rules/*.md`, `agent/templates/*`, `cli/sync.ts`, `configs/plugin-src/messages.ts`. Consumers: linewatch (`web/src`), obsidian (`packages/*/src`), argo/rb charts rule now loads.
2. Managed guard hook. Ids: cli-02 (init/sync own `.claude/settings.json` hook entry using local bin; pass-through emits nothing; deny carries remedy + rule path; shared `isScannable`), guards-23 (apply edit to current file, run `checkSource` on result), cli-17 (derive `./node_modules/.bin/*`; `bunx` only for init/tokens:css), cli-25 (numbered Next list, `.catch` in bin). Consumers: argo, linewatch, obsidian, rollhook gain the hook; rb switches from bunx.
3. `basalt-ui check` and doctor registry. Ids: cli-09 (doctor fast checks + sync --check + oxlint + check-theme, one report/exit), cli-10 (check registry, `--json`, `--only`, id-prefixed, help derived), guards-07 (audit-allows runs by default, `--no-audit` for hooks, `basalt.maxWaivers`), cli-21 (commands return `{code, report: Finding[]}`; new tests assert ids/status), consumer-27 (installed-vs-pinned version check), tokens-theme-21 (redundant color-scheme CSS check), provider-15 (plugin colorScheme vs provider default check). Consumers: all five update lint scripts, CI seed, lefthook.
4. Seeds and templates. Ids: cli-04 (AGENTS block: 8-row routing table + definition of done), cli-05 (split `basalt-app` / `basalt-recipes`, delete 1.x upgrade section only after C7 gate), cli-19 (delete `accentHue`, shrink DESIGN seed, warn while untouched), cli-20 + guards-19 (lefthook preset reduced to one `check` command), cli-23 (`bun-version-file`, runner documented), cli-22 (tokens-only profile gets `basalt-tokens` rule for rollhook), cli-24 (informational note only). Delete: `accentHue` key, ~80 lines of lefthook comments.
5. Config/manifest slimming. Ids: cli-08 (delete unused keys via `RETIRED_CONFIG_KEYS`; toggle consolidation as a later step), cli-12 (drop `spacingScale`, seed hashes, legacy hash branches; manifest `{version, basaltVersion, files}`), cli-14 (split `cli/index.ts` into manifest/placement/jsonc/lefthook/oxlint-config modules; tighten budget), cli-07 `[after #286]` (declared `basalt.app.kind`; delete regex heuristics only where an assertion replaces them). Breaking: manifest rewritten on next sync; config keys retired. Consumers: all run `sync`.

### Wave 5: Dead-surface purge (net-negative)

Goal: delete what no fleet consumer imports; one grep per symbol across argo/rb/linewatch/obsidian/rollhook/weatherorb recorded in the PR.

1. Shell props. Ids: shell-04 (account, `brand.menu`, `headerHeight`, controlled collapse, `isActive`, `getScrollElement`, `_asChild` host; keep `search`), shell-05, shell-11 (export only `BasaltShellProps`), shell-20 (shared glyphs module, ~150 lines). Files: `shell/index.tsx`, `account-types.ts`, `app-sidebar-account.tsx`, `app-mobile-nav.tsx`, `apps/playground`. Update MAINTAINING.md router-bump list. Consumers: playground only.
2. Forms dead layer. Ids: cf-02, cf-03, cf-04 (delete FormRow/FormGroup/FormActions/FormSection/form-state; fold ControlGroup privately), consumer-21 (FormGroup, `mergeSanitizeSchema`, `money` verdict deferred to Wave 2 clock). Files: `forms/*`, `controls/form-layout.tsx`, `controls/control-group.tsx`, `form-state.tsx`, tests, MIGRATING stale refs. Consumers: argo `m365-explorer/explorer-page.tsx` moves to `Input.Wrapper`/Stack.
3. Commands/notifications dead code. Ids: dcc-10 (delete singular `define*`, `CommandRunContext`, export public signature types), dcc-08 (delete `action`/`resolveAction`/Inbox; add `title` to `NotificationSpec`; store on `createPersistedState` with schema), dcc-24 (lazy-init store, test reset), dcc-01 (decision: mount `DeriveControls` in dock with inline SVG icons, else delete; default mount since it is the only UI for derive knobs). Consumers: argo (emit only; no change expected).
4. Token/chart leftovers. Ids: tokens-theme-06 (zero-reader VX members, `chartMargin*`; make `dotR`/`legendGap` density-aware), tokens-theme-10 + tokens-theme-11 (delete `vite-color-mix.ts`, reuse `tokens/hct`), charts-18 (delete `foldBands`, `deltaPeriod`, `stateAction` if grep confirms; verify `mark: 'area'`), tokens-theme-13 (remove no-reader aliases, symmetric good/bad/warn tints; argo uses `--vx-neutral` x25 and `VX.goodSoft` x4 so those stay or migrate). Breaking: named removals in MIGRATING with replacement. Consumers: argo.
5. Budgets. Ratchet `check-budgets` to landed values; add dead-export check (cf-03 proposal) to budgets/drift scripts; shell-24/cf-26 cull tests that pin deleted surface.

### Wave 6: Token and theme pipeline

Goal: one resolver-owned channel; palette fully derived; tokens that are real tokens.

1. Single theme CSS channel. Ids: tokens-theme-01, tokens-theme-02, consumer-17, tokens-theme-25 (convert defaultProps where Mantine accepts a CSS string). Files: `theme/index.ts`, `provider/index.tsx`, `tokens/core.ts`, `provider/lab-theme.ts`. `BasaltProvider theme` takes `BasaltThemeOptions`; remove `BasaltBridge` style tag, `injectPalette`, scheme/mediaFallback/only provider options (CLI-only). Breaking: yes. Consumers: argo and weatherorb delete `theme={createBasaltTheme()}`; rb/argo check `groups`/`derived` pass-through.
2. Derived zinc tail. Ids: tokens-theme-03 (overlay, tooltipBg, line*, dotStroke, dark chart chrome, shadow tints from derived surface/ink; neutral-sweep test), tokens-theme-12 (normalize accent hex, integer/range guard for level knobs), tokens-theme-19 (level-0 golden + property tests, drop redundant per-number asserts). Breaking: default palette shifts by LSBs; re-pin level 0. Consumers: all visual-diff spot check (argo, rb).
3. Space token scope. Ids: tokens-theme-04 (generate `spaceDecls` from keys; move component-private geometry to owning CSS modules), tokens-theme-16 (`scaled(rem)` helper; document `CTL_*` as fixed), tokens-theme-23 (state unit policy once). Breaking: component-named `--vx-space-*` vars removed; `--only core` kept as alias one minor. Consumers: none read component-named vars; rollhook `--only core`.
4. Series wiring. Ids: tokens-theme-05 (delete `seriesTokens`, fold `defineSeries` into `groupTokens`, validate `derived`), consumer-16 (self-registering `defineSeriesGroup`, drop `paletteOptions.groups/derived`, drop `BasaltRegister` augmentation where possible), tokens-theme-14 (inline `BREAKPOINTS.article` into `SIZE_CLASSES.expanded`; keep `BP`, `p`). Breaking: yes. Consumers: argo (`lib/series.ts`, `main.tsx`), rb (`series.ts`, `main.tsx`), weatherorb exemptRules raw-hex.
5. CSS layering and ink ladder. Ids: tokens-theme-09 (font stack into `@layer basalt`, reword claim), tokens-theme-08 (collapse near-duplicate ink percentages in src; range check on `alpha()`; named ladder only if argo/rollhook migration names it), consumer-25 (`tokens:css --tailwind` emits the `@theme inline` bridge), tokens-theme-17/18 (doc sweep for this area). Consumers: rollhook deletes its 20-name map.

### Wave 7: Charts (two minors worth of work, shipped as 7a then 7b only if size demands; plan counts as one wave)

Goal: framework-owned chart state/height/definition stability; one chrome; typed series.

1. Stability and engine seam (non-breaking). Ids: charts-02 (latest-ref functions, structural compare for plain data, memoized `rows(key)`, `highlighted` out of definition, dev recompile warning), charts-09 (single `engine-adapter.ts` + engine-bump contract test; `plot.pxToY/pxToX`), charts-12 (`devInvariant`, production always degrades, single reserved key namespace), charts-13 (tag plot rows via Symbol/WeakSet, one `tooltipContent`/`rowsOf`), charts-20 (`defined()`/`Opt<T>`), charts-16 (generic key `K`), charts-21 (cursorResolution default derived from x model), charts-23 (orphans, split `compile.ts`, reuse `src/format`), charts-22 (legend a11y). Consumers: argo drops inline-memo workarounds and 21 explicit `'leading'`.
2. Viewport-gated follower tooltips. Ids: charts-04, consumer-18. `ChartShell` owns IntersectionObserver; `onFollow: boolean | 'in-view'` default in-view. Delete linewatch `charts/use-in-viewport.ts`, wrapper divs, test. Consumers: linewatch (6 charts).
3. ChartCard owns height and query. Ids: charts-03, consumer-01, consumer-02, charts-19, charts-01 (empty data array auto-state; no new `chartStateOf`; export `QueryState`). `height: 'fill'` on all kinds via context; `ChartCard query`/`QueryStateLike[]`; `header?: WidgetHeaderProps`; `placeholderHeight` and `matchHeight` deprecated. Breaking: yes (deprecations first, removal in Wave 10). Consumers: argo (74 placeholderHeight, 51 `chartStateOf` sites, 11 CHART_HEIGHT consts, `time-of-day-chart.tsx` CARD_CHROME), linewatch (8 hand `state={{pending}}`), rb error ladders.
4. Series union and annotation vocabulary. Ids: charts-10 (`LineSeries | BarSeries | DotSeries | LegendEntry`), charts-05 (first-class legend entries on zones/thresholds, `plot.isVisible(key)`), charts-11 (CartesianChart draws by mark by default; `Lines` becomes preset; drop `chartCurve` if unused), charts-14 (domain `tuple | {floor,ceil,pad} | fn`, dev-validate tuples), charts-15 (one axis/dash spelling; thresholds take series key; explicit refLine legend key). Breaking: yes. Consumers: argo (acwr-chart, fitness-trends, 19 refLines, 3 thresholds, `autoMaxFloor` 16), linewatch (latency-band-chart legend-only fake series).
5. One chrome and one vocabulary. Ids: charts-06 (Heatmap, Donut, Sparkline onto shared `ChartShell`; shared `LegendConfig`/`TooltipConfig`/`ChartHeight`/`ChartState`; Sparkline compact empty placeholder), charts-07 (`AbsentSpec`, `FoldSpec`, `NamedState`, `AxisFloor`; `rowOrder`/`colOrder`), charts-08 (BandStrip: always register `[0,1]` fraction scale, hit-mark option, `tooltipRows(ctx)`; delete `ZX_ANCHOR`, `tooltipWithPrimary`), charts-24 (named linewatch; keep seam internal unless it fits an existing subpath: decide in brief). Breaking: yes. Consumers: argo (Heatmap, Donut, DualPanel, 9 Sparklines), linewatch (3 Heatmaps, MirroredBars, BandStrip).

### Wave 8: Shell, page frame and nav ergonomics `[after #285]`

Goal: the page-level primitives consumers keep forking; nav API tightened.

1. BasaltPage and CenteredScreen. Ids: shell-08, consumer-03, consumer-07, consumer-14, guards-11, shell-07 (publish `--basalt-page-fill-h`, `--basalt-page-bleed`; guard raw `--app-shell-*` reads outside shell/), shell-19 (sequenced here), shell-17 (dev warn for ignored `title`/`icon`; align `filtersEnd`). Delete: linewatch `root-layout.module.css`, `page-bar.module.css`; argo auth-gate/error-boundary hand frames; rb `lock-screen.tsx` (333 lines) shrinks. Make the width-@media guard path-independent. Consumers: linewatch, argo (3 full-bleed files), rb.
2. Nav model. Ids: shell-03 (`SidebarSection.key` from group id; delete `slugifyLabel`), shell-12 (`state: 'active'|'ancestor'`, `selected: boolean|'page'`, `mobile: 'tab'|'more'|'hidden'`), shell-13 (derive one meta type from the other; type-equality test), consumer-23 (`icon` accepts component reference; shell renders at region size/stroke), shell-14/provider-17/dcc-11/consumer-24 re-audit result (nav on provider/slots, delete `getActiveNav`, dev-warn on double define), provider-18 (internal typed helper for the single `as never` cast). Breaking: yes; persisted fold resets once. Consumers: argo (settings `active`), rb, obsidian (`routes/__root.tsx`, spotlight).
3. Shell options from consumers' repeated wiring. Ids: consumer-06 (`colorScheme: 'toggle'|'menu'|'none'`, QueryClient-bound `refresh`, `signOut` global action), consumer-04 (one exported `ErrorScreen`; provider `errorScreen` replaces `fallback` and sets router `defaultErrorComponent`), provider-03 `[after #286]` (constrain `createBasaltRouter` context from routeTree), provider-17 router-carried registries only if weatherorb SSR proves a failure. Breaking: error prop rename. Consumers: argo (`main.tsx`, `routes/__root.tsx`), rb, linewatch.
4. Layout and status primitives. Ids: consumer-08 (`ContentGrid cols` / `ContentGrid.Span`, `type=container` baked in; guard Grid/SimpleGrid without it outside shell), consumer-12 (`StatusDot` tone/size/pulse; adopt 3 waiver sites + argo PulseDot/StatusDot), shell-09 (fix `useSizeClass` doc only), shell-15 (section chevron a11y), shell-16 (move Section onto title slice or delete TODO), shell-21/22 (WidgetHeader `delta` object; SettingsRow `control` only). Net-negative requirement: ContentGrid and StatusDot each need argo+rb adoption in the same cycle or they are cut. Consumers: argo (55 grid sites, StatCards), rb (25 grid sites), linewatch.
5. Shell internals. Ids: shell-10 (extract `shell-types.ts`, `page-bar-context.ts`; cycle check in `pre`), shell-25 (split MobileNav; verify Drawer/Menu focus API in installed source before dropping rAF), shell-24 (replace CSS-string tests with layout-suite geometry). Breaking: none.

### Wave 9: Controls, forms, data, content, commands

Goal: remove runtime-throw contracts; markdown trust and sanitizer fail closed.

1. BasaltDataTable. Ids: dcc-02 (discriminated `pagination`/`sorting`/`filtering`, fold `isLoading`/`skeletonRows` into `query`, sticky option), dcc-03 (grep fleet per prop; delete zero-consumer props, notice the rest; split into `use-data-table`, body, pager, toolbar), dcc-25 (provider-level dev-tool smoke test replaces throw-wording tests). Breaking: yes. Consumers: argo `walking-pad/session-history.tsx` (server pagination) plus 8 other call sites.
2. Markdown and content. Ids: dcc-04 (required `contentTrust`, or lint if Wave 3 rule lands first), dcc-05 (named `missingLayer` throw when rehype plugins exist without sanitizer; dev-warn swallowed imports), dcc-06 (`markdown` option on ThreadFeed/Row; widen `MarkdownComponents`; untrusted non-overridable), dcc-17 (chat UI may import content: list transitive peers in `surfaces.ts`, lazy-load motion, delete false claim), dcc-18 (`renderValue`/`redact` on ToolChip), dcc-19 (`labels`, `measure`, router-context default link, shared `defaultRenderLink`), dcc-20 (`levels` union, body union, export `headingSlug`/`GuideDrawer` or drop), dcc-21 (one props idiom, bundled pipeline options). Consumers: argo (delete ~60 lines `markdown-part.tsx`), obsidian (ArticleLayout, Markdown callers), rb (TableOfContents), linewatch (GuideLink).
3. Chat/run state. Ids: dcc-15 (Composer `status` union; `ThreadFeedRow live?: {status, parts}`; drop `allowSubmitWhileStreaming`), dcc-16 (export `isLiveRun`/`StreamStatus`; `liveIds` from `useAgentThreadRuns`; update rule), dcc-22 (ThreadsStore: ship reference only if argo adopts its 400-line store in the same cycle). Consumers: argo `hermes-row.tsx`, `chat-page.tsx`, `run-liveness.ts`.
4. Commands/notifications UX. Ids: dcc-09 (one `Tone` vocabulary and token map), dcc-12 (click-only bell, real buttons), dcc-13 (built-in `help:shortcuts` + `Mod+/`, reactive list), dcc-26 (dev dock semantics, z-index token), dcc-07 re-audit result (component-type registry or delete `defineOverlays` `[after #285]`). Consumers: argo (7 intents, shortcuts overlay).
5. Forms/controls remnants. Ids: cf-09 (measure `inputProps`/`fieldKey` on argo auth-gate vs issues-section; drop `fieldKey` and its lint rule or delete subpath), cf-10 (`validate` overlays schema results; named async-schema error), cf-13 (BarActionItem `kind` union, array-only `SlotActions`, drop `isBarActionList`), cf-11 (delete `useTrackFits`; decide by option count + label budget), cf-12 (FilterSet width cache keyed by id; migrate onto `useMeasuredWidths` only with layout test), cf-15 (internal non-exported `FilterShell` only if PR shows net deletion), guards-09 (point `raw-selection-control` at existing `externalField`/Panel idiom; export `PanelRow` only with weatherorb named and offset budget). Breaking: cf-13, cf-09. Consumers: argo (PageBar/Section actions), rb, linewatch (ViewTabs), weatherorb (5 raw-selection waivers).

### Wave 10: Docs, tests, sunset

Goal: remove history from source, make drift checks cover everything, retire 1.x residue.

1. Doc and comment truth. Ids: provider-20, cf-16, dcc-14, dcc-22 (stale paths), tokens-theme-17/18, charts-23, cli-18 (llms.txt full signatures, test fails on `...`; one doc per audience; shrink packaged AGENTS.md; README/playground pointers). Extend `check-agent-doc-drift.ts` to resolve identifiers/paths/file:line cites in src JSDoc and cap JSDoc length. Move `AsyncState`/`assertNever`/`StandardSchemaV1` out of `register.ts`; common/ Tier type (cf-17).
2. MIGRATING diet. Ids: cli-06 (trim intro and 50-column matrix, per-minor index, line budget; keep `release-migrating.ts`). Move 1.x section to `docs/archive` only at the sunset gate in step 3.
3. 1.x sunset (gate: weatherorb W37-45 finished; record date in MAINTAINING.md). Ids: cli-13 (empty `RETIRED_FIX`/`DROPPED_FIXES`, delete skill section), cli-12 leftovers. Remove deprecated `placeholderHeight`, `matchHeight`, `BREAKPOINTS` alias, `--only core` alias, struct-wrapper re-exports left from Waves 1 and 7.
4. Test hygiene. Ids: provider-22 leftovers, cf-26, shell-24, cli-21, tokens-theme-19, charts-24, consumer-19 (document supported chart test approach; ship helper only inside an existing subpath/budget), guards-20 follow-up (in-process visitor harness).
5. Final dogfood audit. Verify `/.oxlintrc.json` equals `configs/oxlint-basalt.json` levels, re-run all consumers to zero waivers beyond `basalt.maxWaivers`, `basalt-ui check` green in each, update STATUS.md and MATURATION-LEDGER.

Net-negative expectation: Waves 1, 5, 6, 7, 9, 10 delete more than they add; Waves 3 and 4 are neutral (typed sources + generated tables replace 4203 hand-synced lines); Wave 8 adds BasaltPage, CenteredScreen, ContentGrid, StatusDot, and must be paid for by Wave 5 plus consumer-side deletions (linewatch shell CSS, argo `chartStateOf`, `CrashFallback` wiring).

## 4. What NOT to do (deferred, with reason)

- Public `basaltRoot`/root-route helper (provider-03): types from routeTree after #286 are enough; add only if a consumer asks.
- Router-carried registries (provider-17), single `defineBasalt` (dcc-11): wait for #285 and a proven weatherorb SSR failure.
- Shipping OTel mapping as a runtime export (provider-08), HttpError/onError option (provider-11 beyond 4xx retry; consumer-11 `ApiError` only if rb also adopts): budget, one real consumer (argo).
- Splitting `provider/index.tsx` (provider-16), restructuring search-store suites (provider-22): no payoff yet.
- `useIsCompact()` (shell-09), `Field` component (cf-09), Panel title/actions primitive (consumer-09), range preset grammar (consumer-15 beyond double computation), `DateRangePicker` bounds (cf-21), Section views/compact/open-on-hash (consumer-20): no second named consumer.
- Wrapping all 40 CSS modules in `@layer` (tokens-theme-09), converting units (tokens-theme-23), promoting `CTL_*` to tokens (tokens-theme-16), NEUTRAL to CHROME rename (tokens-theme-13): no consumer need or churn without gain.
- No-raw-Intl lint rule (cf-06): wait until locale story is adopted.
- Merging the regex and AST guard engines wholesale and removing `WAIVER_ID_ALIASES` (guards-01/04): separate decision after Wave 3 measures; keep retired-id and grace ledgers (guards-14).
- Writing CLAUDE.md by default (cli-24): AGENTS.md-only is the repo's own rule.
- Moving placement for package-scoped installs (cli-15) before nested discovery is verified.
- ThreadsStore reference implementation (dcc-22), `SafeSvg` (dcc-23) unless argo adopts in the same cycle.
- Any major version bump or `feat!:` (repo law); every break above is a plain `feat:` with MIGRATING entry and opt-out.

## 5. Consumer feedback loop

Each wave: ship minor, run `release`, then the named validator upgrades, runs `basalt-ui check` and its own `make check`, and files friction rows in `docs/waves/argo-friction.md` before the next wave starts. Fixes needed by a validator go in a patch before the next wave.

- Wave 1: weatherorb (Start `getRouter()`, SSR hydration), argo (HyperDX attributes, nav focus), rb (test harness).
- Wave 2: argo (formatters, walking-pad), rb and linewatch (`lib/format.ts` deletion).
- Wave 3: rb, argo, linewatch lint runs (new errors from alias provenance and warn tier), obsidian (banned-import).
- Wave 4: linewatch and obsidian (rules load via `roots`), rollhook (tokens-only rule), all five (hook install, `check`). Fresh `init` into a scratch app doubles as the test for new consumers.
- Wave 5: playground first, then argo (explorer-page, notifications), grep-gate for all six.
- Wave 6: argo and rb (series, visual diff), rollhook (`--tailwind`), weatherorb (exemptRules).
- Wave 7: linewatch first (viewport gate, BandStrip, Heatmaps, MirroredBars), then argo (74 ChartCards, 14+ inline-prop charts), rb for ChartCard `query`.
- Wave 8: linewatch (BasaltPage replaces shell CSS), argo (full-bleed pages, error screen, grids), rb (lock-screen, nav icons), obsidian (nav/spotlight).
- Wave 9: argo (data table, chat, notifications), obsidian (ArticleLayout, Markdown), weatherorb (panel controls), rb (TableOfContents, library search).
- Wave 10: all six; weatherorb completion gates the 1.x sunset.

Order within a wave: argo is the broadest fleet validator, linewatch the charts/page-frame validator, rb the test/harness and code-routed validator, obsidian the content/nav validator, rollhook the tokens-only validator, weatherorb the Start/SSR validator.
