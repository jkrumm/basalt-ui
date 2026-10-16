# v2 audit — charts (src/charts/**)

State: the chart layer works and is well-tested (6.6k test lines), but it has accreted. Rows 61-112 of the friction ledger are
mostly linewatch-shaped prop growth (absentState, fold, getMarker/cursorValue, plot.data, xDomain, end labels), landed as
per-kind special cases. Four kinds (Heatmap, Donut, Sparkline, and the CartesianRung kinds) each own a separate chrome;
three composed kinds (BandStrip, MirroredBars, DualPanel) bend the rung with hacks. The most valuable change is a
state/height/stability contract that the framework owns instead of every consumer chart file (findings 1-4).

Evidence conventions: paths relative to packages/basalt-ui/src/charts unless prefixed. Consumer counts exclude apps/playground.

## 1. ChartState is a 2^n bag; `data=[]` fabricates (major, api, breaking)

- types.ts:221-228 `{pending?, error?: unknown, empty?: boolean|string}` with precedence in state.tsx:14-20. The house shape is
  `AsyncState` (register.ts:~80, "N valid states, not 2^n"). `error` is `unknown`, truthy-tested (`error: 0`/`''` is silently "no error").
- Nothing derives empty from `data.length === 0`; a chart given `data=[]` draws empty axes. Evidence it bites: linewatch
  availability-heatmap.tsx:130-145 ("`isPending` guards the same fabrication ... every tooltip reading '0 of 30 expected cycles'"),
  throughput-chart + pending.render.test.tsx. argo hand-writes `chartStateOf(query, label)` (argo lib/chart-state.ts) in 40+ chart files.
- Proposal: `state?: {status:'pending'} | {status:'error', error: Error|string} | {status:'empty', label?: string}`; auto-`empty` when
  `data.length === 0` and no explicit state (opt-out `state={{status:'ready'}}`); ship `chartStateOf(query)` from `basalt-ui/state`
  (it already owns query wiring). Add oxlint `basalt/chart-data-fallback` for `data={x ?? []}` on a chart tag (the rule file
  basalt-charts.md says "never data ?? []" but its coverage header says "not guarded: —").
- Consumers: argo (chart-state.ts), linewatch (8 hand `state={{pending}}`), weatherorb (PENDING_PORT).

## 2. Inline literal props recompile the whole definition every render; no guard, one-line doc (major, perf, no)

- CartesianChart.tsx:51-60 `useShallowStable` is `Object.is` per top-level prop, so an inline `y={{...}}`, `zones={[...]}`, `refLines`,
  `tooltip={{...}}`, `series` or `x={(d)=>d.day}` is a new key every parent render. argo acwr-chart.tsx:96-125 passes all of them inline
  (and fitness-trends-chart.tsx:153-205). Every kind adds its own dep list (Lines.tsx:102, Bars.tsx:100/138, BandStrip.tsx:305/391,
  Heatmap.tsx:290-312 with 20 deps) so a fresh `getRow`/`formatValue` rebuilds an O(rows x cols) grid.
- `highlighted` is a `ShellContext` input (CartesianChart.tsx:113): a legend hover recompiles the definition (domains, row arrays,
  underlay) for every datum. `rowsOf` (compile.ts:752-773) returns a fresh `data.map` per call and `Lines` calls `plot.rows(key)` ~4x
  per series (Lines.tsx:49,79,96, labels.ts:71).
- Documentation: only two JSDoc "Memoize it" lines (BandStrip.tsx:89, Heatmap.tsx:73); basalt-charts.md and the skill say nothing.
- Proposal: (a) function props read through a latest-ref (compile once, call `ref.current.x`), plain-data props compared structurally
  (zones/refLines/y/tooltip config) - this removes the memo burden; (b) memoize `rows(key)` per compile; (c) move `highlighted`
  out of the definition (dim via CSS class/state on the host) so hover never rebuilds; (d) until then document the rule and add a
  dev-only counter warning when a chart recompiles >N times per second.
- Consumers: all (argo 14+ files inline, linewatch memoizes by hand: latency-band-chart.tsx:316-355).

## 3. Height is stated three times; no `fill` outside Heatmap (major, api, yes)

- argo passes `placeholderHeight={CHART_HEIGHT}` + `height={CHART_HEIGHT}` (+ a `const CHART_HEIGHT` in 11 files): 74 `placeholderHeight`
  hits. ChartCard.tsx:112-115 documents it ("pass the chart's own height"). ChartCard `state` and the kind's `state` are two owners
  (basalt-charts.md says the card owns it inside a card).
- Fill: box.tsx:12 already has `'fill'`, but only `Heatmap.matchHeight` (Heatmap.tsx:103, 0 consumer uses) exposes it, and it is a boolean that
  overrides `height` (invalid pair). argo time-of-day-chart.tsx:20-47 instead JS-measures the left column and subtracts a hard-coded
  `CARD_CHROME = 82` px.
- Proposal: `height` on every kind accepts `'fill'` (drop `matchHeight`); `ChartCard` takes the body height once (`height`, same type) and
  provides it by context (card-context.ts already exists) so the placeholder and the kind agree; `ChartCard fill` makes the card a flex
  item that grows. Delete `placeholderHeight`. A kind inside a card with no own `state` reads the card's.
- Consumers: argo (74), linewatch, weatherorb.

## 4. Follower tooltips need a viewport gate five consumers hand-copy (major, wiring, no)

- tooltip.onFollow (types.ts:197-199) renders a follower tooltip clamped into view over the real one. linewatch charts/use-in-viewport.ts
  (36-line docblock) is used by latency-band-chart.tsx:340, availability-strip.tsx:264, bufferbloat-chart.tsx:87, speed-chart.tsx:104,
  throughput-chart.tsx:194; each wraps its chart in an extra `<div ref>` and memoizes a tooltip object keyed on `inView`.
- Proposal: the host owns the gate (IntersectionObserver on the chart root in ChartShell, already has `ref`); `onFollow: true` means
  "when visible". Delete the hook from linewatch. Keep a `'always'` escape only if a consumer names one.

## 5. Legend-only fake series and visibility switches (major, api, no)

- A zone/state/key with no data is modelled as a series with `getValue: () => null` (21 consumer hits; argo acwr-chart.tsx:30-46;
  linewatch latency-band-chart.tsx:300-318) and consumer marks read `plot.visible.some(s => s.key === 'absent')` as a boolean switch
  (latency-band-chart.tsx:~395-402). The kinds do the same internally: BandStrip.tsx:327-335 fabricates `getValue` 1/null to conjure tooltip rows,
  Heatmap.tsx:317-330 and StackedArea.tsx:46-49 forge `mark: 'bar'`; RefLine got a proper `legend` (types.ts:162) but ZoneSpec/XZoneSpec/Threshold did not.
- Proposal: `legendItems?: readonly {key,label,color,mark,note?}[]` (or `legend` on ZoneSpec/XZoneSpec/Threshold like RefLine), and
  `plot.isVisible(key)` for consumer marks. Then `getValue` can be non-null by type, and BandStrip stops faking series.

## 6. Four chrome implementations (major, layering, no)

- ChartShell (CartesianChart.tsx:95-174) serves the rung + panel kinds. Heatmap.tsx:154-395, Donut.tsx and Sparkline.tsx:244-285 each
  re-implement root div/`data-basalt-chart`, `useId`, `useCoarsePointer`, state placeholder, legend wiring, and differ in vocabulary:
  `legend?: false|{label}` (Heatmap) vs `ChartLegendConfig|false`; `tooltip.rows(d)` (Heatmap) vs `rows(d, ctx)`; Donut has neither
  legend nor tooltip config; Donut default `height` 240 vs the law; Sparkline has no empty state for all-null data (Sparkline.tsx:263 returns
  `definition === null` -> blank div).
- Proposal: one `ChartShell` taking a `compile` for every kind (Heatmap/Donut compile to a definition already); shared `LegendConfig`,
  `TooltipConfig`, `ChartHeight`, `ChartState` types for all props. Delete the three private roots.

## 7. Kind vocabularies diverge (major, api, yes - greenfield)

- Same concept, different names: pane share `topFraction` (DualPanel) vs `upFraction` (MirroredBars); axis floor `autoMaxFloor`
  (AxisConfig, MirroredBarPane) vs `maxAbsFloor` (DualPanelBar); per-datum opacity `barOpacity(d,key)` (Bars) vs `getBarOpacity(d)` (MirroredBars);
  absent share `getAbsentFraction(d)` (MirroredBars) vs `BandSpan.absentFraction` (BandStrip); fold is a named type `BandFold` (BandStrip.tsx:~73)
  vs an inline duplicate (MirroredBars.tsx:95); heatmap `rows`/`cols` (band order) collides with `tooltip.rows` (tooltip rows); Donut
  `colorForKey/seriesLabel/formatValue` vs series `color/label/formatValue`; DualPanel `tooltipFormat`/`format` vs series `formatValue`.
- Proposal: extract `AbsentSpec`, `FoldSpec`, `NamedState` (band-fold.ts already half-does it) and one `AxisFloor` vocabulary; rename to
  one convention (`getX` for per-datum accessors, `xFraction` for shares, `rowOrder`/`colOrder` for heatmap); ledger the renames in MIGRATING.

## 8. BandStrip bends the rung with four hacks (major, layering, no)

- BandStrip.tsx:112 `ZX_ANCHOR = [{fill:'transparent'}]` passed as `xZones` only to force compile.ts:704 `zoneScale: under.length > 0` to
  create the `zx` scale; `y={STRIP_AXIS}` (:105) to hide a y axis; an invisible `barY` per slot for hit-testing (:~365); a tooltip wrapper that
  re-adds the primary row (:394-430) because `getValue` cannot see the legend. Implicit coupling: renaming the zone scale breaks BandStrip silently.
- Proposal: rung always registers the `[0,1]` fraction scale (cost: one scale), a first-class `plot.fractionX` rect helper and a `hit`
  mark option; move the visibility-aware tooltip rows into a kind-level `tooltipRows(ctx)` hook so the wrapper disappears.

## 9. Plot-size feedback loop scrapes engine DOM (major, wiring, no)

- host.tsx:107-118 reads `g.ts-chart__view`, `data-ts-key` and a `:marks:clip-defs` rect to size panes; plot-context.ts keeps a
  module `WeakMap` side channel with getter-registered reads, a microtask (host.tsx:60) and a second render. Covered only by panels.test.tsx:80-87.
  The engine is exact-pinned (package.json 1.1.0), so a bump is the failure mode, with no contract test pinning the markup.
- Proposal: confine all of it to one `engine-adapter.ts` with a contract test that fails on engine bump; offer `plot.pxToY(n)` /
  `plot.pxToX(n)` so pixel-pinned rails (skill example, linewatch rails) need no `plotHeight` read and no re-render; request an engine layout callback upstream.

## 10. ChartSeries is a 21-field union of unrelated shapes (major, api, yes)

- types.ts:18-83. Kinds Pick subsets (Bars.tsx:25-50, StackedArea.tsx:23, DualPanel.tsx:35-52, MirroredBars.tsx:60) = four different Picks of
  one bag. On CartesianChart illegal combos type-check: `getMarker` without `cursorValue` is ignored (types.ts:70-74), `parent` without
  `legend:false`, `area:'zones'` on a log axis throws at render (compile.ts:420-432), `mark:'area'` has no behaviour at all
  (legend.tsx:131-151 falls through to the bar chip), `curve`/`gaps` meaningless on bars.
- `mark` cannot say "dot": argo fitness-trends-chart.tsx:161-175 uses `mark:'bar'` to mean dot (14 `mark:'bar'` hits in argo).
- Proposal: discriminated union keyed by required `mark`: `LineSeries | BarSeries | DotSeries | LegendEntry`; `CartesianChart` default-renders
  each by `mark` and `marks` becomes optional extra marks (see 11); the Picks vanish.

## 11. CartesianChart consumers re-implement lineMark/emphasis (major, dx, no)

- argo fitness-trends-chart.tsx:153-205 hand-rolls the dim logic (local `DIMMED = 0.15`, line 18, vs basalt 0.25 theme.ts:65), ignores
  `parent`, re-imports `chartCurve('monotone')`. `lineMark`, `emphasis`, `loneDots` exist (marks.ts:18-110) but are not public.
- Proposal: with 10, `CartesianChart` draws lines/bars/dots per series by default and `marks` appends; Lines becomes a thin preset
  (thresholds, area, end labels). Net-negative: drop `chartCurve` from the public index if no consumer remains.

## 12. Four failure policies for the same class of mistake (minor, consistency, no)

- dev throw + prod console.error-once with a module flag: Bars.tsx:69-80, compile.ts:420-432 (copy-pasted `warned*` flag + disable comment);
  dev throw + prod silent degrade: band-fold.ts:46-58, BandStrip.tsx:206-228; ALWAYS throws (crashes prod render): compile.ts:761
  (`plot.rows('typo')`), MirroredBars.tsx:~124 `assertPaneKey`; dev-only throw for reserved keys compile.ts:846 vs `__bar` (DualPanel.tsx:30)
  and `__stack+` (compile.ts:463) with no guard.
- Proposal: one `devInvariant(message, fallback)` in common/errors; production always degrades; reserved key namespace `__basalt:` checked once.

## 13. Duplicated tooltip/cursor pipeline; datum duck-typing (minor, dead-code/bug, no)

- `rowsOf` twice (compile.ts:752 closure vs panel.tsx:132); tooltip header derivation three times (compile.ts:740, panel.tsx:206,
  `format` in DualPanel.tsx:185 / MirroredBars.tsx:194); focus/cursor/tooltip assembly twice (compile.ts:912-928 vs panel.tsx:211-238).
- Identification of a plot row is `'datum' in d && 'series' in d` (compile.ts:816-820, panel.tsx:164): a consumer datum with fields
  named `datum` and `series` is mis-read, and a consumer `marks` datum shaped like that gets the wrong row. Tag plot rows (WeakSet or Symbol).
- Proposal: `panel.tsx` calls a shared `tooltipContent(...)`; one `rowsOf`.

## 14. Axis config: flat `auto*` knobs valid only in one mode (minor, api, yes)

- types.ts:86-114: `autoMaxFloor/autoMinCeil/autoPad` coexist with a tuple domain (ignored), `nice` default false "a fixed domain stays fixed",
  `scale:'log'` ignores autoMinCeil. Tuple/function domains are unvalidated (reversed, NaN) while `xDomain` validates and warns (types.ts:299-303).
  Usage: autoMaxFloor 16, autoMinCeil 5, nice 5, autoPad 2 consumer hits.
- Proposal: `domain: readonly [number,number] | {floor?, ceil?, pad?} | ((data, visible) => ...)` (auto is the object form, default `{}`); delete `autoPad`
  and fold `nice` into the object form; validate tuple like xDomain.

## 15. Annotation shapes and names (minor, api, yes)

- axis selector spelled `axisSide` (ZoneSpec, types.ts:130), `axis` (RefLine :155, ChartSeries :50); dash spelled `dashed: boolean` (RefLine,
  ZoneEdge) vs `dash: 'solid'|'dashed'` (series); `thresholds` is Lines-only and string-x excluded by a conditional type (Lines.tsx:38) while
  basalt-charts.md lists thresholds among CartesianChart data; thresholds bind to the FIRST VISIBLE series, so toggling it retargets silently
  (Lines.tsx:49-54); refLine legend toggle is keyed by array index (types.ts:156-161, compile.ts:203), documented as a footgun.
- Proposal: one `axis: 'left'|'right'` and one `dash` spelling; thresholds take `series: key`; ref-line legend key = optional `key` (default index).

## 16. Typing: stringly series keys/colors, registered `SeriesKey` unused (minor, guard, no)

- `key: string`, `color: string` (types.ts:19-22); `SeriesKey`/`Series` slot exist (register.ts:64-73) but nothing in charts reads them; "never a
  literal" is a comment. `plot.rows(key: string)` typo is a runtime throw (compile.ts:761). BandStrip/MirroredBars already carry a `K` generic.
- Proposal: `ChartSeries<T, K extends string = string>`, `plot.rows(key: K)`; `color: SeriesRef | VXRef` (template literal `var(--${string})`) so
  `'red'` or a hex fails tsc, backing the check-theme regexes.

## 17. Guard gaps (minor, guard, no)

- oxlint-plugin.js:642-652 `CHART_TAGS` is a hard-coded set: omits `CartesianChart` and has no test/sync against index.ts, so a chart composed
  by hand in a raw Card passes. basalt-charts.md coverage header says "not guarded: —" yet: `data ?? []`, inline-unstable props, `mark:'bar'`
  forging, and `getValue: () => null` are all unguarded. surfaces.ts:316 still describes `./charts` as "Lines and Bars kinds" (9 kinds ship).
- Proposal: derive CHART_TAGS from the charts index at build (gen step) + test; add the rules from 1 and 2; fix the surface text.

## 18. Unadopted / dead surface (minor, dead-code, no)

Counts are consumer hits excluding playground (argo, linewatch, rb, obsidian, rollhook, weatherorb branch).

- `foldBands` exported (index.ts:23) - 0 consumers; MirroredBars/BandStrip use the internal. `mark:'area'` - no behaviour. `Heatmap.matchHeight` 0,
  `Sparkline.emphasizeLast/emphasisColor` 0, `ChartCard.stateAction` 0, `ChartCard.deltaPeriod` 0, `cursorGroup` 1 (and docs say default is shared), `xZones` 1,
  `tooltip={false}` 1, `barOpacity` 2, `autoPad` 2, `cursorValue` 2. `CurveName` has 5 members, consumers use `monotone` only (chartCurve is
  imported by 2 apps solely to rebuild lines, see 11).
- Proposal (adopt-or-delete): delete `foldBands`, `mark:'area'`, `matchHeight`, `autoPad`, `deltaPeriod`; keep the rest on notice in MIGRATING.

## 19. ChartCard hacks around DOM and `exactOptionalPropertyTypes` (minor, perf/ssr, no)

- ChartCard.tsx:50-78 `useShortCard`: a state-held node, an extra render per card at mount (44 cards in argo), a `querySelector('[data-basalt-box]')`
  coupling to box.tsx:81, a hysteresis band to stop flip-flop, and an effect that cannot re-run when the body switches between a stated and a
  `fill` box (`[node]` deps). ChartCard props duplicate WidgetHeader's one by one, forwarded through `definedOnly` (:122), and `title ?? ''` (:160).
  `hasHeader` ignores `subtitle`/`delta` (:128) silently.
- Proposal: derive "short" from the context-provided height (finding 3); ChartCard takes `header?: WidgetHeaderProps` instead of mirroring fields.

## 20. exactOptionalPropertyTypes contagion (minor, dx, no)

- Every optional prop is `?: T | undefined` (enforced by optional-undefined.type-guard.test.tsx) and implementations are full of
  `...(x !== undefined && { x })` (40+ in src/charts: CartesianChart 6, Heatmap 6, BandStrip 5, marks 4, ChartCard 3).
- Proposal: a single `defined()`/`omitUndefined` helper in common/props; type helper `Opt<T>` to remove `| undefined` repetition.

## 21. Cursor resolution default is per kind and per consumer (minor, api, no)

- Default `'nearest'` (types.ts:323) but BandStrip and MirroredBars default `'leading'`; 21 consumer hits of `cursorResolution`, mostly
  `"leading"` on Lines/Bars of daily buckets (argo acwr-chart.tsx:100, fitness-trends-chart.tsx:156; linewatch). The chart knows the x kind.
- Proposal: default `'leading'` for band x (Bars) and bucketed Date x; make `'nearest'` the point-scale default; keep the prop.

## 22. Legend a11y and chrome (minor, a11y, no)

- legend.tsx:~190 `<fieldset aria-label="Legend">` is identical on every chart (44 on one argo page) and has no `<legend>`; non-toggle entries
  highlight on mouse only (:~205), `auto` mode renders both swatch sets (:104-113). Name it from `ariaLabel`; give non-toggle entries `tabIndex`
  highlight parity or drop hover-highlight on touch.

## 23. Docs / hygiene (minor, docs, no)

- Orphan docblocks: CartesianChart.tsx:48 ("`useId` output ... is not a safe SVG id fragment.") and Sparkline.tsx:242 describe nothing (the code
  lives in host.tsx:94). types.ts is advertised "React-free" yet exports the runtime `rowX` (:331). compile.ts:126-140 re-implements date
  formatting with an English-only MONTHS table next to src/format/date.ts (locale-aware, unused by charts); `defaultNumberFormat` also lives in
  compile.ts (:122) though format/number.ts owns `fmtCompact`. compile.ts is 931 lines holding guides, gradients, zones, tooltip and guards: split to
  guides.ts / underlay.ts / tooltip.ts.

## 24. Tests assert source text where no seam exists (minor, test, no)

- linewatch charts/tooltip-header.test.ts greps the component SOURCE (`toContain('formatHeader: (_x: Date, p: Point) => ...')`) because a tooltip
  mounts only under a live cursor and `renderToStaticMarkup` never shows one; follower-tooltip.test.ts the same. In-repo, kinds.test.tsx:48-52
  reads `scale.domain()` off the engine spec. Proposal: a tiny exported test seam (`compileCartesian` + `tooltipAt(definition, x)`) under
  a `testing` surface so consumers assert the contract, not their own source.

Priority order for the waves: 1, 3, 2, 4 (consumer-visible contract), then 10/11/5 (series model), 6/7/8 (shell + vocabularies), 9/12/13/17 (internals + guards), rest as net-negative cleanup.
