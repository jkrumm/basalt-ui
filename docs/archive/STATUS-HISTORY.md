# Basalt UI — status history (archived 2026-08-22)

Per-release narratives lifted verbatim out of `docs/STATUS.md` so that file stays a statement of
what is true now. Provenance only — every section below describes shipped work, and the
"remaining"/"branch" language in them is historical.

Release mapping, verified with `git tag --contains`:

| Section                                 | Shipped in                                          |
| --------------------------------------- | --------------------------------------------------- |
| Chart-API round three                   | 1.18.0                                              |
| Chart-API round two                     | 1.17.0                                              |
| Chart-API consumer gaps                 | 1.16.0                                              |
| X-bands, dual-axis margin, legend note  | 1.15.0                                              |
| Chart-layer batch (2026-08-02)          | 1.9.0 (not re-verified per commit)                  |
| Derive engine, stages 1–3               | 1.2.0 (all four `createBasaltTheme` dimensions)     |
| "Built (verified as-built, 2026-07-07)" | pre-1.0 inventory; superseded by the package README |

## Chart-API round three — `feat/follower-tooltips-and-doc-guard` (2026-08-19)

Round three is smaller and differently shaped: two filed issues, two small gaps, and one piece of
process criticism that turned out to be the most valuable item in the batch.

1. **Follower tooltips (`tooltip.onFollow`, issue #51).** A page sharing one cursor gave every
   follower a crosshair and its own series dots but a tooltip only on the SOURCE — so hovering a
   spike moved a bare vertical line across every sibling and showed numbers on none of them. The
   reader got the position and not the reading. It was a capability REGRESSION: a consumer carried a
   hand-written synced value chip and deleted it in the 1.15.0 migration, with no supported way to
   restore it, because `CartesianChart` has no seam for a tooltip no pointer event produced. Default
   `false`; a follower always anchors to its own crosshair (there is no pointer to track), and only
   the SOURCE's tooltip is `aria-live` — N followers announcing per pointer move would be strictly
   worse than the silence being fixed.
2. **Managed-doc drift, for the second time — so this time it got a gate.** `sync` was still placing
   `basalt-design/SKILL.md` naming `ChartTooltip`, a component deleted in 1.15.0, in a file
   consumers are told not to hand-edit. 1.16.0 had fixed exactly this class in the CLAUDE.md block;
   this was the same miss one file further down, found by a human reading rather than by any gate.
   `scripts/check-agent-doc-drift.ts` now runs in CI with two complementary checks: bolded-backtick
   identifiers (the "compose this primitive" form) must exist in the export surface, and an explicit
   removed-API denylist is banned outright in any form — with a self-check that fails if a
   denylisted name ever reappears as a real export, so the list cannot silently ban a live API. Both
   historical misses were verified to fail it, each caught by the check designed for its form.
3. **`strokeOpacity` silently no-ops on bar/area swatches** — it is a stroke property, and a bar
   swatch has no stroke. Documented, with `fillOpacity` named as the equivalent. It bites the
   zone/reference-legend idiom (`mark: 'bar'`, `getValue: () => null`) specifically, where reaching
   for it looks right and does nothing.
4. **The x axis is categorical, and the docs never said so (issue #52).** `scalePoint<string>` means
   N points are N evenly spaced positions whatever the values behind the keys. Now stated
   prominently in both `CHARTS-SPEC.md` and the consumer-facing rule, with both silent consequences:
   geometry that lies about spacing for event-shaped series, and a repeated key dropping a point.
   The scale itself is NOT built — it reaches the cursor's `xScale` inversion, `XZoneRects` (bounds
   are domain keys today), the bar kinds' band width and `smartTicks`, so it is a design pass, not a
   prop. The design direction is recorded on the issue: the root problem is that `getX` serves as
   cursor key, scale domain value AND tick-label source at once; `formatX` split off the third in
   1.17.0, and `PlotContext.xPos` would split off position, after which a linear scale is an
   internal change rather than a fork of the render-prop contract.

**The process finding, which outranks all four.** A consumer observed that `autoMaxFloor`'s clamp
order had moved twice in five minors while `AxisConfig.nice` was defaulted `false` specifically to
avoid moving anything — an inconsistency in how much rendering movement a minor is allowed. Checking
the history made it worse and clearer: 1.13 was clamp-then-pad (`MultiLine.tsx:200`), the 1.15
`CartesianChart` rebuild reimplemented it as pad-then-clamp, and **nobody noticed**, because the
ordering had no test — only the padding's sign-safety did. It shipped as a silent behaviour
regression, survived a full release, and was found only when a consumer proved the divergence
numerically. So it was not policy churn; it was one unnoticed regression and one restoration. The
cost to a consumer is identical either way.

Two rules came out of it, both now in `packages/basalt-ui/CLAUDE.md` under "Shipping a rendering
change": what blast radius a minor may move (every chart → opt-in prop defaulted to the old
behaviour; only opt-in-prop users AND restoring a documented law → plain `feat:` with measured
before/after and a named opt-out), and the one that would actually have prevented this —
**a rewrite that reimplements an existing law must pin that law with a test BEFORE the rewrite.**
`padAutoLower` came through the same rebuild unchanged precisely because its law was pinned.

## Chart-API round two — `feat/chart-consumer-round-two` (2026-08-19)

1.16.0 went out and **both** consumers upgraded within a day: argo took all four reversals (chart
source 7206 → 5717 lines, −1489 total, up from −1019 at 1.15.0; the four charts forced out of the
`Bars` kind collapsed back from +77/+91/+93/+116 to +2/−16/+6/+7), and linewatch took one item and
correctly rejected the rest as not applying to it.

The value of a two-consumer round is visible in the shape of the reports. argo's is a migration
ledger — what collapsed, by how much. linewatch's is an audit against 1.16.0's SOURCE rather than
against the handover, and it found four things the handover had not mentioned because nobody had
looked. Every item below was verified in source here before being worked on; two turned out to be
worse than reported.

1. **`autoMaxFloor` was applied on the wrong side of the pad** — the one BEHAVIOUR CHANGE in this
   batch. `resolveAxisDomain` padded and then clamped the floor, while the lower bound had always
   clamped `autoMinCeil` and then padded. Two laws in one function, and argo proved the divergence
   numerically: dataMax 3.2, pad 1.1, floor 6 → 6.0 before, 6.6 now. The old law landed a winning
   floor exactly on the axis top with zero headroom, so a target line pinned to that floor sat glued
   to the plot edge — something the lower bound never did. Now `padAutoUpper(max(dataMax, floor))`,
   the exact mirror of `padAutoLower`. A consumer depending on the old ordering will see their axis
   top move.
2. **`TooltipHeader` had no formatter seam** — the highest-value find, because it is a wrong date on
   screen rather than a missing convenience. `fmtTooltipDate` regexes `YYYY-MM-DD` out of the domain
   key and builds a LOCAL `Date`, so a UTC ISO key made the header name a different day than
   `formatX`, the badge, and every sibling chart. The only workaround was carrying a local-offset ISO
   key. Now `tooltip.formatHeader`, defaulting to today's behaviour.
3. **No kind forwarded `formatX` — all six, not the one reported.** `CartesianChart` always took it;
   `Bars`/`MultiLine`/`StackedArea`/`ZonedLine`/`DualPanel` did not expose it, so the only route to a
   custom x label was pre-formatting it into the domain key — making one string serve as display
   value, scale identity and cursor key at once. This repo's own rules already warn that a truncating
   formatter then collapses two points onto one domain value and silently stops drawing one of them.
   `Heatmap` stays excluded: `colLabel`/`rowLabel` already ARE that seam.
4. **Cursor resolution was nearest-only, never containing.** For a chart whose keys are bucket
   leading edges, a hover in the back half of a bucket resolved to the FOLLOWING bucket — the shared
   crosshair one column right of the data being pointed at, reproducibly, for every back-half hover.
   Now an opt-in `cursorResolution: 'leading'` on every cartesian kind and `useChartCursor`.
5. **`getMarker` could not express a plain filled dot.** Both kinds rendered it with a punched-out
   ring, so argo's previous `fillOpacity: 0.7` circles were unreproducible after moving onto the
   kind. Return type widened with `ring` and `fillOpacity`.
6. **`role="img"` was erasing the chart's own keyboard slider.** `ChartFrame` labelled itself
   `role="img"`, and every descendant of `role="img"` is presentational per ARIA — so `HoverOverlay`'s
   `role="slider"`, the entire keyboard-scrubbing story 1.15.0 shipped, never reached the
   accessibility tree. The label announced; the control silently unreachable. Now `role="group"`.
   Worth recording how it hid: **jsdom does not implement that pruning**, so a `getByRole('slider')`
   test passes under the bug. The regression guard had to be structural, and no role-based test
   could ever have caught it.

7. **`DualPanel`'s keyboard slider was unnamed and reported no position** — found by writing the
   regression tests for item 6, not by either consumer. Its `ariaLabel` reached only `ChartFrame`'s
   outer container, never its own focusable `HoverOverlay`, and neither overlay ever received
   `valueNow`/`valueMax`/`valueText`. So a consumer passing `ariaLabel` got a labelled chart
   containing an unnamed control reporting nothing — the same class of defect as item 6, one layer
   down. It survived because every prior `DualPanel` test rendered a single chart and never needed a
   named or value-texted slider. Now at parity with `CartesianChart`; the bottom overlay stays
   pointer-only by design, and a test pins that there is exactly ONE focusable slider per chart.

Not built, deliberately: a **two-bar-pane kind with independent scales** (linewatch's throughput
chart, whose two strips genuinely have no y dimension). One consumer, one chart — this repo extracts
a kind on the third repeat, so the `theme-allow` exemption stands until a second appears.

Also corrected here: the 1.16.0 handover told argo to re-enable legend toggling on the four charts
carrying `legend={{ toggle: false }}`. linewatch pushed back correctly — `toggle: false` is a
legitimate choice when a legend is a key rather than a control, and the reversal only applies where
it was adopted BECAUSE `prependRows` could not see the hidden set.

## Chart-API consumer gaps — `feat/chart-api-consumer-gaps` (2026-08-18)

argo migrated all 38 of its charts and 7 routes onto 1.15.0's `CartesianChart` in one pass: 12
`basalt/hand-rolled-plot` violations to zero, 105 tsc errors to zero, chart source 7206 → 6187
lines, `ChartHoverSync` deleted from every route with no `ChartCursorScope` needed (page-wide
sharing is exactly what those wrappers had meant). Eleven charts collapsed by 79–263 lines each.
No margin override survived anywhere — every hand-tuned nudge was deleted and none was needed
back, which is the measured-margin claim holding up in the field.

What it also produced is the useful part: **nine places the new API could not express something,
and four charts that had to leave a shipped kind because of one of them.** Every item below is a
gap a real migration hit, not a hypothetical.

1. **`BarsBar`/`BarsLine` could not carry `tooltip: false`** — the highest-cost one. `series.ts`
   documents `SeriesStyle.tooltip` as the replacement for the removed per-kind
   `hideBarTooltipRows`, but `Bars` gave no way to thread it, so a chart wanting one bar drawn and
   legended without a tooltip row had to leave the kind and hand-draw its rects. Four argo charts
   did, at roughly +95 lines each — the kind's whole value, lost to one missing boolean.
2. **`ChartSeries.formatValue` never saw the datum.** `(v: number) => string` cannot produce
   `97.5 kg (92.5 × 3)` or `0.123%/d · +0.4σ`, so four more charts fell back to hand-authored
   `prependRows` — reopening exactly the seam derived rows exist to close. Now `(v, d) => string`.
3. **`prependRows`/`extraRows` never saw legend state**, so a hand-authored row structurally
   desynced from toggling and the only honest repair was `legend={{ toggle: false }}` (used on four
   charts). Both now receive `(d, { visible, hidden })` — the same sets the plot draws from.
4. **No `AxisConfig.nice`.** The rebuild `nice()`s no scale and exposed no seam, so six charts
   restored rounding inside a custom `domain` function. Added, default `false`: flipping the
   default would move the domain of every already-migrated chart.
5. **No `SeriesStyle.strokeOpacity`.** A faint MA companion could only be built by baking `alpha()`
   into the color, which also dimmed the tooltip swatch and the crosshair dot. It is a MARK
   property: the plotted stroke and the legend swatch honor it (parity with `fillOpacity`), the
   12px tooltip chip and the crosshair dot deliberately do not.
6. **`DualPanel` ignored `ChartSeries.getMarker`** where `MultiLine` honors it — one chart silently
   lost its per-session dots.
7. **`DualPanel` had no `formatBar`**: `formatBottom` drove the ticks AND the histogram tooltip
   row, so a velocity reading lost a decimal and its unit. `formatBar` now owns the row only.
8. **`DualPanel`'s bottom pane had no domain config** — a lost `max(…, 0.1)` floor meant a plateau
   amplified to fill the pane. `bottomYDomain` + `bottomMaxAbsFloor`.
9. **`XZoneSpec` was centre-aligned only**, so a band was always one `step()` narrow and a
   single-sample band rendered nothing at all. `align: 'edge'` widens by half a step at each
   present bound; `'center'` stays the default.

Plus one documentation defect worth more than its size: **`basalt-ui sync` was still placing a
managed CLAUDE.md block naming "the `ChartTooltip` family, `AxisLeftNumeric`/`AxisBottomDate`" as
the primitives to compose** — pre-1.15 doctrine, in a block consumers are told not to hand-edit,
describing a component that no longer exists and a composition pattern that is now a lint error.
The rebuild updated the rules and skills and missed the template that ships beside them.

Two things argo reported that are NOT treated as gaps, recorded so they don't come back: the
pace-trend domain blowup (a zone bound of `to: 60` used as a pre-1.15 "top of axis" sentinel got
folded into the auto domain) is already answered by `resolveAxisDomain`'s documented handling —
non-finite `extraBounds` are skipped, so `Infinity` IS the sentinel; and `AxisConfig.format`
feeding both the ticks and the per-series tooltip fallback is deliberate, since a right-axis value
must never be formatted with left-axis rules — with `formatValue` now able to cite the datum, that
is the correct seam.

Every addition is optional and every default reproduces 1.15.0's rendering exactly.

## Chart-layer batch — `feat/linewatch-chart-gaps` (2026-08-02)

The same consumer (LineWatch) that prompted the adoption-gap work came back with a second field
report, this time from four rounds of UI overhaul rather than one lint run. Every item below cost
them real time or shipped a real defect. The through-line is different from last time and worth
naming: **the adoption gap was things the framework never told them; this is things the framework
could not express, or expressed in a way that silently did nothing.**

Three of them are traps rather than gaps — code that typechecks, lints, passes `check-theme`, and
renders, while being wrong:

1. **`ChartTooltip` was a `<div>` that no-opped inside `<svg>`.** Authored in an SVG tree, React
   creates it in the SVG namespace: it mounts, accepts every prop, throws nothing, and is never
   painted. One of their charts carried eight authored tooltip rows no human had ever seen. No gate
   on either side could catch it. It now portals to `document.body` (SSR-guarded), which removes the
   trap instead of warning about it — and un-breaks `position: fixed` under a transformed ancestor
   as a side effect.
2. **Cross-chart hover synced on exact string match.** A chart that folds its domain to fit a narrow
   viewport stops owning most of the keys its unfolded siblings broadcast, so the shared crosshair
   appeared on roughly one hover in three with no rule a reader could infer — worse than no shared
   cursor. `useHoverSync` now takes an optional `resolveKey`.
3. **`AxisBottomDate` hardcoded `DD.MM`,** so a 24h window printed the same label a dozen times —
   and `raw-visx-axis` makes a raw `<AxisBottom>` a build failure, so there was no supported exit.
   They pre-formatted upstream instead, which forced those labels to double as unique scale domain
   values and cascaded into the fold-key coupling in (2). One missing prop, three layers of
   consequence. It now takes a `tickFormat`.

Plus three plain gaps: `useHoverSync` rebuilt its point map on every render (the accessors now sit
in refs, matching the pattern the file already used for `ctx` and explained in a comment before
failing to apply it here); hover capture was mouse-only, so every chart was inert on touch, for a
framework that ships a `MobileNav`; and `charts/` had no Mantine-free layout primitive, so centering
anything cost a `theme-allow` inside the directory the guard exists to protect.

### `isPending` — "nothing to draw" is three states, not two

The item they rated highest-value, and the one that generalizes furthest. A chart has three empty
states: **measured and empty**, **measured and absent** (a real coverage gap), and **not asked yet**.
The `data ?? []` idiom collapses the third into the second, densifying an in-flight query into a
fully-hatched "not measured" window — a positive claim that the line was watched and carried
nothing — on every cold load and every range change. They found and fixed this class of bug in four
separate places across four review rounds and still had six chart instances without it.

`ChartPending` (+ the minimal `ChartCenter` it needed) now ships from `./charts`, with `isPending`
on `ChartFrame` and all seven kinds. It reserves the footprint and draws nothing that could be read
as a measurement — no axes, no gridlines, no hatching, no marks — and no animation, since the motion
doctrine bans idle pulsing. `ChartFrame` also drops the legend entirely while pending: a legend
naming a series with nothing yet to point at is its own small lie. This is the third data point for
the lesson the 1.7.0/1.8.0 `tone` work established — **what a shipped composite cannot express gets
routed around by compliant-looking code the guard has no way to recognize**, so the gap stays
invisible until a consumer describes it.

### Two self-inflicted findings

- **The guard told chart files to use Mantine.** `inline-display`/`raw-html-layout` name
  `Box`/`Flex`/`Grid`/`Group` as the remedy, all `@mantine/*`, all banned in the Mantine-free chart
  layer — so inside a chart file the finding was unactionable, not merely inconvenient. basalt never
  felt it because `package.json`'s `exemptRules` carried a private `primitives` self-exemption. Both
  kinds now skip chart files and **the self-exemption is deleted**, so basalt passes for the same
  reason a consumer does. This is a relaxation, so the grace-minor doctrine (which governs the guard
  getting _stricter_) does not apply and no `GRACE_PERIOD_KINDS` entry belongs with it. Same shape
  as the dogfood blind spot that let the 1.4.0 regression reach a consumer — worth watching for.
- **`init`/`sync` seeded repo-root files into a subdirectory package.** Their app is
  `repo-root/web/`; `lefthook.yml`, `.github/workflows/check.yml` and `src/query-client.ts` all
  landed where nothing reads them, and because seeds are recreated-when-missing, every upgrade put
  them back after the consumer relocated them. The `query-client.ts` seed was the harmful one — it
  shadowed a real client carrying `staleTime` and `refetchOnWindowFocus: false`, so one wrong import
  silently reinstated a refetch loop. The CLI now walks up for `.git` and skips those units with a
  printed note when the package is not the repo root. Notice, never an error.

### Held, not done

- **The horizontal stat strip** they proposed as a component: one consumer, one instance. Under this
  repo's own rule of three that is not an extraction yet.
- Their report reached us with item 4 missing and item 1's closing paragraph truncated — neither is
  addressed here.

### Footgun found doing this work

`bun run check-theme` — and therefore `bun run pre` — runs `bin/basalt-ui.mjs`, which imports
`../dist/cli/index.js`. It validates the last **built** dist, not the working tree. A change under
`src/guard/**` is invisible to it until `bun run build` runs, and a stale dist can report green over
source it never read. That is how the guard change above first appeared to be a no-op. Build before
trusting `check-theme` after touching `src/guard/` or `src/cli/`.

## Built (verified as-built, 2026-07-07)

- **Spine** — `surfaces.ts` (the SSOT registry), `register.ts` (`BasaltRegister`/`Slot`/`SeriesKey`/
  `AsyncState`), `state.ts` (`createPersistedState`), `guard/` (incl. the `basalt guard-hook`
  PreToolUse adapter; `GUARD_RULES` drives `checkSource`), provider freeze (`BasaltErrorBoundary` +
  `onError` + CSP nonce).
- **Seven batteries** ship as runtime subpaths: `./query`, `./router-tanstack`, `./agent`,
  `./commands`, `./forms`, `./notifications`, `./data` (split into `./data/table` +
  `./data/virtual`) — plus `./guard`, `./state`, `./connectivity`, `./llms.txt`. All 19 subpaths
  (incl. `./connectivity` and `./content`) resolve in the pack-test.
- **Charts / tokens** — config-driven chart system (legend/tooltip/crosshair), `ResponsiveChart` +
  `useChartSize`, the semantic-tier `--vx-*` token keystone, the modern-zinc palette (see
  `docs/DESIGN-SPEC.md`), motion discipline (oxlint + `check-theme` enforced).
- **Design overhaul (2026-07-11)** — the shell, charts, components (`data-table`, notifications
  bell/center), and agent-chat surfaces were restyled to `docs/DESIGN-SPEC.md`: cool zinc surfaces,
  a single saturated sky accent, split by role (SEED values ink `#0077bd`/`#8ec5ff`, fill `#0077bd`
  both schemes, white label — the derive engine now EMITS different tokens from these seeds, see the
  post-derive-engine note in `DESIGN-SPEC.md`), whisper-shadow-plus-ring depth
  (no plain hairline) — `shadow-card` for panels, `shadow-raised` for interactive controls since the
  2026-07-31 control-depth pass — 7px card radius (6px controls, after the 2026-07-15 density pass), and the
  three-font system (Nunito Sans / Hubot Sans /
  JetBrains Mono, shipped via exact-pinned `@fontsource-variable/*` deps). `DESIGN-SPEC.md` is the
  ground truth for all visual doctrine going forward; older doctrine comments describing warm-neutral
  zinc-charcoal, a muted slate-blue accent, flat/no-shadow cards, or 8px radii are superseded — see
  its "Doctrine inversions" section.
- **Enforcement** — `SURFACES` projects `gen-oxlint` + `gen-llms`; `check-coverage` (8 assertions);
  Mantine-free boundary enforced on headless surfaces; `@visx/*`-only-in-`charts` boundary.
- **Release gates** (`scripts/pack-test.sh`) — `publint --strict` + `attw` (esm-only) +
  `check-dist-layering.mjs` (7 Mantine-free subpaths + root-barrel) + 19-subpath resolution +
  tarball parity (every CLI-read source ships) + export-surface snapshot (named-export completeness).
- **CLI** — `init` · `sync` (+ `--check` drift gate) · `check-theme` · `check-coverage` · `info`
  (+ `--json`) · `doctor` (+ a 4th, warn-only check for `basaltAppPlugin`'s icon files under
  `public/`) · `guard-hook`.
- **App bootstrap** (`./vite`) — `basaltAppPlugin` joins `basaltViteConfig`: dual `theme-color` +
  anti-FOUC background derived from `SURFACE.bg`, bring-your-own icon links, `site.webmanifest`
  (served in dev too), site-wide OG/Twitter defaults, and an opt-in `serviceWorker` that lazily
  composes the optional peer `vite-plugin-pwa` and degrades to a warning when it's absent. New
  `agent/rules/basalt-app.md` covers vite-config composition and plugin ordering.
- **Agent-DX** — `llms.txt`, `AGENTS.md`, `basalt-ui info --json`, `basalt-ui doctor`; rules +
  skills + CLAUDE block placed by `basalt-ui init`/`sync` (plugin/marketplace retired in 1.0.1).
- **Resolved owner decisions** — `@visx/*` bumped alpha.11 → **4.0.0 stable** (+ `@visx/responsive`);
  `@tanstack/react-hotkeys@0.10.0` optional peer (live keybinding) shipped; `createForm` →
  `useBasaltForm` rename.
- **Maturation review executed** (see `docs/archive/MATURATION-REVIEW.md`) — the `./data` split (`./data/table`
  - `./data/virtual`), `./connectivity` registered in `SURFACES`, an accessibility wave (keyboard-
    operable chart legend, `DataTable` sort, mobile-nav `aria-current`, streaming `aria-live`), agent
    `retry(threadId)` + orphaned-in-flight-thread reconcile, and a documentation cleanup (10 planning
    docs archived to `docs/archive/`, 7 marketing orphans deleted).
- **Sidebar account** — `SidebarAccount` (a presentational footer row) + a provider-agnostic
  account contract (`BasaltAccountProps`/`State`/`Actions`) threaded optionally through
  `AppSidebar`/`BasaltShell`'s `account` prop. No better-auth dependency, no `./auth` subpath — the
  Better-Auth mapping recipe ships as JSDoc only.
- **Content surface** (`./content`, `docs/CONTENT-SPEC.md`) — complete: `Prose`/`CodeBlock`/
  `Callout`/`TableOfContents`/`ReadingProgress`/`Markdown`/`MermaidDiagram`/`mdxComponents` (stages
  1+2) plus the docs-framing layer (stage 3) — `ArticleLayout` (meta header + sticky TOC rail +
  prev/next footer), `ArticleCard`/`ArticleGrid` (overview cards), `GuideLink`/`GuideDrawer`
  (contextual help drawer), and the content-collections + TanStack Start recipe in
  `agent/rules/basalt-content.md`.

## X-bands, dual-axis margin, legend note — `feat/chart-x-bands-margin-legend-note` (2026-08-15)

Another field report, three chart-API gaps and one doc gap:

1. **Vertical time-window bands.** `ZoneRects`/`ZoneSpec` cover horizontal value bands only — a
   consumer marking a time window (not a value range) had no primitive. New `XZoneRects` +
   `type XZoneSpec` (`./charts`), wired as `xZones?: XZoneSpec[]` on `MultiLine` and `ZonedLine`
   only. Bounds are `getX` **domain keys**, not dates/timestamps (the kinds run a
   `scalePoint<string>` over the label strings) — an omitted bound is the plot edge, a key absent
   from the domain skips the band rather than clamping to one.
2. **Dual-axis margin.** `Bars` computed its right inset with an inline `Math.max`; nothing else
   could reuse it, so a dual-axis `MultiLine`/`ZonedLine` consumer hand-picked a number. New
   `chartMargin(opts?)` + `type ChartMargin` (`./tokens`, also from `./charts`) — bare call equals
   `VX.margin`, `{ rightAxis: true }` widens `right` to fit `AxisRightNumeric`'s tick labels.
   Returns a new object per call (memoize it). `Bars` now calls it internally.
3. **Muted legend qualifier.** A series invisible in the plot (flat at the domain floor, e.g. "Low
   cloud — 0% all night") had no way to say why. New `note?: string` on `SeriesStyle` (and so
   `LegendEntry`, via `deriveLegend`) — `ChartLegend` renders it, muted, after the label.
4. **Maps ambiguity, doc-only.** `@visx/geo` isn't among the 9 pinned `@visx/*` peers and
   `basalt/visx-boundary` never says maps are out of bounds — a consumer burned 20 minutes there.
   `agent/rules/basalt-charts.md` gained a "Maps are not charts" section: maps are consumer
   territory, the visx boundary constrains `@visx/*` imports only (a map library is unaffected),
   and `check-theme`'s `inline-spacing` guard is a per-line regex that still flags a map's pixel
   geometry (`fitBounds({ padding })`) even after hoisting it to a const — use `theme-allow`.

## Derive engine — "one accent in, calculated palette out" (stages 1-3, done)

The shipped palette is GENERATED, not hand-authored. `tokens/derive.ts` (a ported, calibration-
checked HCT derivation) computes the accent family, the 12 categorical fills, the surface stops,
the ink ramp, and the status solids from one seed hex + five bounded knobs; `tokens/palette.ts`
builds `ACCENT`/`FILL`/`SURFACE`/`INK`/the status hues from `deriveTokens(DEFAULT_DERIVE_CONFIG)`
once at module load (seed `#0077bd`, `neutral: 'zinc'`, all level knobs at 0; vibrancy centers on
`x0.72` chroma — one step above the original muted `x0.6` center). Shipped:

- **Generator** — `tokens/{derive,hct}.ts`: the HCT math (zero-dependency sRGB↔HCT + a 16-iteration
  gamut-mapping chroma search) and the derivation laws (the Y=0.165 fill-luminance band, the
  3.0:1 `onAccent` contrast floor, the vibrancy/brightness/surface-level knob mappings).
- **Generated palette** — `tokens/palette.ts` computes `ACCENT`/`FILL`/`SURFACE`/`INK`/status from
  the generator at the new baseline (e.g. `ACCENT.accentFill` = `#4374a6`, `SURFACE.bg` =
  `#f2f2f5`/`#27272a`) instead of hand-picked hexes; the chart-chrome opacity ramps
  (`NEUTRAL.axis`/`grid`/`tooltip*`) now key off the derived ink hex too, not a frozen pre-
  derivation approximation.
- **Consumer API** — `createBasaltTheme(overrides?, { derive: { accent, neutral, lightLevel,
darkLevel, vibrancy, accentBrightness } })`. Omitted knobs fall back to the shipped default per-
  knob; the default (or a `derive` that resolves back to it) stays on the pre-baked static
  `baseTheme` — zero extra derivation work.
- **`DeriveControls`** (`theme-lab`) — the DEV-tool live-tuning panel for the same six knobs,
  persisted to its own localStorage key. Not the production path — that's `createBasaltTheme`'s
  `derive` option — but a faithful one: it applies a config through BOTH halves of the theme (a
  cascade-winning `<style>` tag for the `--vx-*` vars, plus a real rebuilt theme object; see
  "Honest theme lab" below).
- **Non-color dimensions (step 2)** — the same options object (never a second config surface)
  gained `fonts: { sans?, head?, mono? }` (pure pass-through to the `--basalt-font-*` vars,
  enforced by the new `raw-font-family` guard kind) and `radius` (integer −5..+5; law: card =
  7 + level, ctrl = 6 + level, clamped ≥ 0, offset tiers + anchored Mantine scale stops follow —
  `deriveRadius(level)`, level 0 byte-identical to the pre-knob values, locked by
  `theme/radius.test.ts`). Every theme/component/CSS-module radius literal was tokenized onto
  `--vx-radius-{card,ctrl,tight,fine,floating}` first (no-visual-change refactor), then the knob
  landed; `basalt.rawRadius` guard is ON. `legendText`'s light value now derives from the ink hex
  like the sibling chart-chrome ramps. `DeriveControls` gained a Radius slider (persisted-state
  v2).
- **Density dimension (step 3)** — a fourth theme dimension (the third non-color one) joins the
  options object:
  `createBasaltTheme(overrides?, { derive, fonts, radius, density })`. `density` is an integer
  −3..+3 (level 0 = today's values, byte-identical, with ONE deliberate exception — see below) —
  narrower than `radius`'s −5..+5 on purpose: it retunes every density-TRACKING spacing token
  together (the `SPACE_FIXED` structurals below are exempt by design) via
  `deriveSpacing(level)`, a multiplier law (`1 + 0.1 * level`, rounded, floored at 1) for
  anchors/scale-stops/one-offs, plus an independent, gentler additive law — its OWN hand-picked
  coefficient (`ROW_LINE_HEIGHT_STEP`), not derived from the multiplier's own coefficient, which a
  prior version of this law incorrectly claimed — for the NavLink row line-height, which would
  overshoot the readable range under the multiplier. The ±3/0.1 range reproduces the exact same
  `0.7..1.30` multiplier envelope as an earlier ±5/0.06 shape at fewer, more meaningful notches — the
  wider range left 41-43 of the 108 spacing values byte-identical to level 0 at one notch of movement
  (uniform over-quantization, not a single dead zone), which the narrower range corrects; see
  `deriveSpacing`'s JSDoc (`tokens/palette.ts`) and the "Fix 7" relation tests in
  `theme/density-relations.test.ts`. Landed in
  two prep commits first (no-visual-change refactors, byte-identical, locked by
  `theme/spacing.test.ts`): `tokens/palette.ts` gained `SPACE` (semantic anchors — the `6px 10px`
  row inset, the 4px vertical rhythm, input height), `SPACE_SCALE` (the Mantine `xs`/`sm`/`md`/
  `lg`/`xl` spacing scale, kept independent of `SPACE` even where a level-0 number coincides — an
  anchor is one component's inset, a scale stop is the app-wide generic rhythm), `SPACE_STEP`
  (named one-offs, including six chart-chrome constants — legend gap, the four plot-area margins,
  dot radius — that track density; stroke weights don't), and `SPACE_FIXED` (density-EXEMPT
  structurals — hairlines, the reading-progress bar height — deliberately never emitted as a
  `--vx-*` var). A CSS-module sweep then routed 114 hardcoded spacing declarations across 15 files
  (prose and the app sidebar accounting for nearly half) onto `--vx-space-*`, one named token per
  site, byte-identical. `DeriveControls` gained a Density slider (persisted-state v4 — bumped from
  v3 when `deriveSpacing`'s accepted range narrowed to `[-3, 3]`, so a stale out-of-range `density`
  from an earlier session falls back to the default state instead of reaching `deriveSpacing` and
  throwing at render). **The one level-0 exception**: `SPACE_STEP.stickyHeaderClearance` is
  RESPONSIVE, not a single value — a desktop (`>= sm`) value (`appShellHeaderHeight + stackMd`, 60
  at level 0) and a mobile (`< sm`) `stickyHeaderClearanceMobile` sibling
  (`appShellHeaderMobileHeight + stackMd`, 108 at level 0), each clearing only its own AppShell
  header instead of one value tuned against either the wrong header or an over-cleared common
  (desktop) path — see `deriveSpacing`'s JSDoc (third bullet) and `docs/CONTENT-SPEC.md` §5 for the
  full rationale and the `./content` ↔ `BasaltShell` coupling this creates.
- **Theme-lab prune** — `COLOR_GROUPS` used to expose a swatch for every derived color, which is
  dead weight now the palette is generated: hand-tuning a hex the derive engine owns and
  regenerates on the next config change. Classified against `buildPaletteData` rather than by group
  name: Accent/Fills/Ink/Semantic (wholly derived) were dropped; Status/Neutral/Surface keep only
  their hand-authored members (status `excellent`/`neutral`, `line`/`line2`/`dotStroke`, surface
  `overlay`). `COLOR_GROUPS` is now a six-token structural inspector, not an identity tuner —
  identity/color tuning lives in `DeriveControls` alone. Export surface unchanged (same name, same
  subpath); the playground's Theme-lab panel copy was updated to match.
- **Enforcement** — `basalt-ui check-theme` wired into the repo's own `bun run pre` (root
  `package.json`) and into `lefthook.yml`'s staged pre-commit (`packages/basalt-ui/src/**` glob);
  `tokens/derive.ts` + `tokens/hct.ts` are in the package's `basalt.exempt` list (they ARE the
  generator/calibrated-constant source, alongside `palette.ts`/`theme/index.ts`) so the `raw-hex`
  guard rule doesn't fire on their calibrated literals.
- **Guard dogfooding wave (rides with the density PR)** — the package now runs five guard kinds it
  previously exempted itself from: `raw-surface`, `raw-spacing`, `inline-spacing`, and the
  `inline-display`/`raw-html-layout` layout-primitive pair (two kinds, one category — they share an
  `exemptRules` opt-out below). No new rule kinds — these already
  shipped; what changed is that basalt-ui itself is now scanned by them, which surfaced and cleared
  the last raw literals in its own source. Two things fell out of it: **`exemptRules`**
  (`Partial<Record<GuardKind, string[]>>` on `GuardConfig`) — the missing seam between whole-file
  `exempt` (skips every rule) and hardcoded `appliesTo` (per-kind path scoping in the registry),
  applied as one post-filter so it covers the inline-handled kinds too, empty by default; and **15
  new tokens** — 14 `--vx-space-*` one-offs (agent rail/code/error/message/transcript insets, badge
  inset, stat-card gap, virtual-list row inset), each seeded into `SPACE_STEP_BASE` at its shipped
  px so level 0 is byte-identical and the value now tracks density instead of freezing, plus a fixed
  `--vx-radius-pill` (9999px, level-invariant). The headless layers (`agent/`, `charts/`) declare
  themselves exempt from the layout-primitive rules via `exemptRules` — their remedy points at a
  Mantine `<Flex>`/`<Center>` they cannot import under the Mantine-free contract. A handful of
  irreducible sites (sub-scale opticals below the token floor, a Badge `styles.label` part, two
  `motion.span` glyph wrappers) keep a documented `theme-allow`.
- **Honest theme lab (rides with the density PR)** — `DeriveControls` applied a config through an
  injected `<style>` tag alone, which can only reach CSS custom properties. The Radius/Density knobs
  also control plain numbers baked into the theme OBJECT by `buildTheme`: `theme.radius` and
  `theme.spacing` (the generic Mantine `xs`..`xl` scales — every `p="md"`/`gap="sm"` in an app) plus
  `defaultProps.radius` on Badge/SegmentedControl/Progress/Tooltip/Popover/Modal/Notification,
  `Progress.size` and `Timeline.bulletSize`. A `<style>` tag cannot reach a number inside a JS object,
  so the sliders moved the CSS-var surfaces (the CSS-module-heavy app sidebar most of all) and left
  plain Mantine layout at level 0 — the tool under-reported its own knobs UNEVENLY across surfaces,
  which is exactly the reading a retune is judged by, so any by-eye measurement taken through it was
  half blind (a `-2` radius read on the sidebar alone, a sidebar-wants-`-1`/rest-wants-`+1` density
  split that may be the instrument rather than the design). `BasaltProvider` now reads the same
  persisted store and rebuilds a real theme via `createBasaltTheme(undefined, { derive, radius,
density })`. Three pieces: the state moved to `theme-lab/derive-state.ts` (deliberately Mantine-free
  — the root layer must not pull the panel UI into every consumer's chunk for six lines of state, and
  one store instance means the CSS half and the object half can never disagree);
  `provider/lab-theme.ts` merges only the config's DELTA against the shipped base
  (`themeOverrideDelta`), because `BasaltProvider`'s contract is consumer-overrides-win-last and the
  documented mount hands it a COMPLETE `createBasaltTheme()` carrying every level-0 number — a
  whole-theme merge would clobber the lab back to level 0 in one direction and eat the consumer's own
  overrides in the other; function-valued fields are skipped (`buildTheme` allocates fresh
  `vars`/`classNames` closures per call and none of them closes over a radius/spacing value). The
  delta also carries `other.basaltDerive`/`basaltRadius`/`basaltDensity`, so `BasaltBridge`'s existing
  injection emits the matching `--vx-*` CSS off the running theme. **No shipped default moved, and the
  production path pays nothing**: the store subscription is gated to DEV builds at module scope
  (`process.env.NODE_ENV !== 'production'` picking one of two `use*` implementations — a per-render
  ternary would be a `react/rules-of-hooks` error), since `BasaltProvider` is the mandatory `.` entry
  and must not cost every consumer a localStorage read plus a permanent `storage` listener to answer a
  question that is always "no" there; a bundler drops the dev implementation and its
  `theme-lab/derive-state` import outright. Even in a dev build, with the "Apply" switch off — or in
  any app that never mounts the panel, since nothing else writes that key — the provider returns
  `createBasaltTheme(theme)` verbatim, and an active override at level 0 yields an empty delta. The
  cost of the gate: the sliders are inert in a production BUILD of a dev app (`vite build && vite
preview`) — run the playground through its dev server. Two things previously documented as part of the gap never were: Card/Paper resolve their
  radius through `var(--vx-radius-card)` in `styles.root`, and the Input/Button/ActionIcon `size="md"`
  heights read `--vx-space-*-height` via each component's `vars` — the CSS half always covered both.
  Pinned by `provider/lab-theme.test.ts` (16 tests) + `theme-lab/derive-state.test.ts` (6, for the
  store-to-override projection both halves share — the `applied` gate the "production untouched" claim
  rests on, and that no state-only key leaks into `theme.other.basaltDerive`).
- **Level-0 spacing retune (rides with the density PR)** — the first retune taken with a trustworthy
  instrument, applied to the BASE tables so level 0 stays the shipped identity and the knob keeps its
  full ±3 travel around it. No default level, no second knob — the knob's zero IS the identity.
  Components roomier: `SPACE_SCALE_BASE` 10/12/16/18/24 → **11/13/18/20/26** (~+10%), the app-wide
  rhythm every `p=`/`m=`/`gap=` resolves through, including the Card/Paper `p="xs"`/`p="sm"` inset
  idiom. Sidebar tighter (~−15%) across 13 gap/inset one-offs (`sidebarRegionGap` 12→10,
  `sidebarSectionGap` 15→12, `sidebarChildListIndent` 17→15, …). Three deliberate exclusions: sidebar
  SIZES are not spacing (`sidebarAvatarSize`, `sidebarSearchTriggerHeight`, the two Menu widths stay —
  shrinking them is a dimension change); the 4px stack rhythm stays 4/8/12/16/24, being the grid the
  scale sits on (moving it reshapes every Prose/Callout/ArticleCard margin); and `SPACE.rowInsetX`/
  `rowInsetY` stay 10/6, since that anchor is shared by the sidebar NavLink AND every Menu item, so
  tightening it for the sidebar tightens menus app-wide — the opposite direction from the rest. If the
  sidebar still reads loose, that anchor is the next lever, and the honest conclusion then is that the
  NavLink row inset is wrong everywhere rather than that the sidebar needs a private copy. Two
  consequences, both recorded at the source rather than papered over. `SPACE_SCALE` no longer coincides
  with the anchor group at level 0 (`xs`/`sm`/`md`/`xl` used to equal `rowInsetX`/`stackMd`/`stackLg`/
  `stackXl`) — always a coincidence, never a law, and this is what proves the two groups move
  independently, so the doc comments and `tokens/density.test.ts`'s independence assertion are updated
  to the stronger form. And `appShellHeaderMobileHeight` went 96 → **97**: it is documented as a SUM
  (row 1 + `SPACE_SCALE.sm` + `appHeaderMobileActionsHeight`), so raising the `sm` addend without
  raising the total took the pixel out of row 1 instead — surfacing as row 1's WCAG 2.5.8 target-size
  budget at density −3 going flush against its 22px floor. Restoring the sum restores the 1px margin
  (budgets 23/26/28/32/36/38/41 across the range). Both that constant's JSDoc and the assertion that
  measures it now name the real fix: compute the header from its addends the way
  `stickyHeaderClearance*` already is, so the drift becomes impossible rather than re-tuned — a
  follow-up only because it moves every non-zero level's value. `theme/spacing.test.ts`'s doc header
  was rewritten to match its actual job: it locks the CURRENT identity, updating it is how a deliberate
  retune lands AND how a regression would hide, so a diff to it must be a decision taken on purpose in
  the same commit as the base-table edit.

**Known limitations:**

- `accentHover`'s dark-mode hue drifts from the legacy hand-tuned value by ΔE≈5.9 (perceptible but
  minor) — a calibration gap, not a regression, tracked for a future re-tune.
- A handful of structural tokens stay non-derived by design: `SHADOW.*`, `SURFACE.overlay`/
  `divider`, the raw `BP` hue ramps, and `STATUS.excellent`/`neutral`.
- Mantine's `theme.colors.dark` tuple is generator-derived (`buildDarkTuple`, `theme/index.ts`) for
  every config, including the shipped default — the previous pinned `basaltDark` literal (hand-
  tuned, pre-derive-engine) is gone; a small visible dark-mode shift is expected and accepted.
- The accent fill's page-contrast floor (3.0:1 against BOTH derived page backgrounds) is now a
  clamped law: `derive.ts`'s `clampFillTone` steps the `accentBrightness`-shifted fill tone back
  toward the band centre until it clears the floor on both schemes, so the knob saturates rather
  than violating 3.0:1 at the extremes.
- `stone`/`slate`/`neutral` are spec'd `NEUTRAL_PRESETS` entries (hue/chroma pairs) but have no
  calibration data behind them — only `zinc` is calibrated against the framework's original
  hand-tuned identity.
- Chart constants (`VX.legendGap`/`margin`/`dotR`) are single-sourced off `SPACE_STEP`'s
  `chartLegendGap`/`chartMargin*`/`chartDotR` keys, but — unlike every other density-tracking
  one-off — deliberately have NO `--vx-space-*` CSS var (visx SVG props read plain JS numbers, not
  `var()` strings, so a declaration would have zero consumers). `VX` is built ONCE at module load
  from the frozen level-0 `SPACE_STEP` snapshot, so it never re-reads a `density` option at all —
  this is the one case that fails BOTH paths, including the PRODUCTION
  `createBasaltTheme(undefined, { density })` one, not merely the dev slider (see `deriveSpacing`'s JSDoc, `tokens/palette.ts`, for
  the full accounting of what tracks density end to end and what doesn't).

---

## Appended 2026-09-02 — rounds 6–11, controls waves, maturation round, adoption gap, chart-layer rebuild, native mobile nav, framework-free (lifted verbatim from STATUS.md)

Everything below was cut from `docs/STATUS.md` during the C4 docs-consolidation wave. It covers
rounds 6 through 11 (1.21.0 → 1.25.0), the controls waves (1.26.0), the 2026-09 maturation round,
and three sections that had drifted into duplicating `docs/CHARTS-SPEC.md`,
`agent/rules/basalt-mantine.md`/`docs/CONTROLS-SPEC.md` §2, and `docs/FRAMEWORK-FREE.md`
(Adoption gap, Chart-layer rebuild, Framework-free token consumption) plus the native-mobile-nav
narrative (doctrine now lives in `agent/rules/basalt-state.md`). Historical, not maintained —
"remaining"/"branch" language below is as-written at the time.

## Round-11 consumer sweep

Ran against 1.25.0, validating round-10's `manualPagination` contract. Not summarized here yet —
see `.claude/feedback/round-11/` per-repo reports directly.

## Maturation round (2026-09)

34 commits (`af51d41`..`9def67c`), executed against `docs/MATURATION-LEDGER.md` — the round's
checklist, one row per finding (`.claude/maturation/` holds the untracked per-session audit
evidence it cites). Four audits (packaging, components, charts, package surface) were benchmarked
against Blueprint (`~/scratch/blueprint`), turned into one ledger, then worked in waves with
fan-out across ledger ids rather than file-by-file. The playground combination-matrix wave ran a
screenshot/critic loop over three rounds (m0, m1, m2) at 1440 and 390/320px; the phone-width critic
round measured six rotated-tick-label failures, closed to zero by `5617c87`.

**Wave 1 — regressions and packaging defects (audit A).** Notable finds and fixes: null values in
`MultiLine`/`ZonedLine`/`StackedArea` were filtered and drawn across a gap instead of breaking the
line, and grouped bars scaled a `0` baseline to `NaN` on a log axis and vanished (`af51d41`); the
mobile nav bar dropped to 47px at density −3 after the region-seam commit moved a border onto
`AppShell.Footer` (`3c62f4a`); 396 of 1385 tarball entries were `*.test.ts` sources and their
declarations (`8e30445`); `basalt/raw-size-literal` shipped at error with zero test cases — never
added to its own fixture oxlintrc (`9e32f71`); a mistyped `DataTable` facet `columnId` rendered
nothing silently (`8f76f7c`); `BasaltOverlays`' lazy `ModalsProvider` deferred the first commit,
producing the `setState` "hasn't mounted yet" console error on every chart-heavy route — R1
(`0947e71`).

**Wave 2 — common primitives.** `src/common/**` (`1e7b314`): `BasaltProps`, `SlotStylesProps`,
`cx`, `mergeRefs`/`assignRef`, a prefixed `errors.ts` table, `useValidateProps` and
`assertRequiredProps`. Rolled out across controls/shell/dashboard/forms/notifications/commands/
connectivity/content/query/theme-lab/agent/agent-chat (`6506c9a`): the isomorphic
`NO_CLASSNAME` ledger went 98 → 37 (18 of the remainder real gaps, the rest providers/SVG marks/
portal targets), and required-prop misuse that used to surface as a raw `TypeError` swallowed by
`BasaltErrorBoundary` dropped from 54 named call sites to 22 (33 remedied with a named
`[basalt] <Component>: prop "<name>" is required` message). The isomorphic smoke harness itself
(`f5ab686`) walks every public barrel — 161 (subpath, component) pairs — rendering each with a
minimal prop map and asserting no throw/console error, `renderToString` where Mantine-free.

**Wave 4 — chart layer.** A measured phone tier (`resolveChartTier`, `VX.phoneChartWidth = 480`)
shrinks legend/tick fonts, tightens margin floors and caps the legend at two rows below that
container width, with no media query; `SeriesStyle.curve` (monotone/linear/step/stepAfter/
stepBefore); `utils/format` gained `fmtCompact`/`fmtPercent`/`fmtCurrency`/`fmtInt`, all returning
an em dash for non-finite input; `ChartEmpty`/`ChartError` joined `ChartPending` behind one `state`
prop (`b4284b9`). Log-axis guards stop every `LinePath`/`AreaClosed`/`Threshold` from emitting NaN
paths, and `smartTicks` now spaces x ticks by measured label width instead of a fixed 55px
(`af51d41`). The phone-width critic round's six measured tick-label failures — the rotated x-label
gutter not clearing the label's own leftward projection, Heatmap column/row labels never thinned,
auto-rotation firing without checking the rotated layout fits — went to zero: the rotated gutter is
now measured from the painted baseline, Heatmap thins by the same law the axes use, and
auto-rotation only fires when it paints more labels than the flat axis (`5617c87`). Duplicate
`refLine` keys now use the index instead of colliding (`af51d41`).

**Wave 6 — rules and toolchain.** Five oxlint rules shipped at `warn` under the grace mechanism:
`provider-above-router`, `duplicate-notifications-mount`, `query-dual-import`, `query-fn-unwrap`
and `deprecated-export` (reads a `DEPRECATED_EXPORTS` ledger, autofixes the import rename) — each
carries a `// Ships:` line a test holds against the shipped preset (`d50020d`). `bun run pre` now
ends in `bun test`, and `make verify` builds first, then runs `pre`, the layout suite and the
pack-test, because `check-theme` and the playground typecheck both grade `dist` (`cca609d`).
`packages/basalt-ui/tests/**` is now inside a tsconfig include and typechecked.

**Wave 3 — components.** `WidgetGrid`/`WidgetGrid.Item` and `StatGroup` own the dashboard column
law (`base 1 → sm min(cols,2) → lg cols` / `base 2 → sm min(cols,3) → lg cols`) so `lg` exists in
exactly one place in the package; `StatCard.query` renders through `QueryState` under its header
(`fa8c7e8`). `Section`, `BasaltDataTable` and `BasaltVirtualList` accept the same `QueryStateLike`
`QueryState` takes and render pending/error/empty in their body — the table gained its first error
branch; `BasaltDataTable` also gained `onRowActivate`, TanStack row-selection passthrough and a
`bulkActions` bar (`e2cb0e1`). `overlays.confirm`/`confirmDelete` resolve a `Promise<boolean>`
through the lazily-loaded modals layer and reject by name when no provider is live;
`notifyUndo`/`notifyUndoable` wrap an optimistic mutation in an undo-window toast (`79bc1b1`).
`PageAside` mounted its children twice on the phone path because `PageBar` published its row-2
claim from a layout effect one commit after the in-flow branch first rendered — fixed by deferring
that branch one commit and reading the breakpoint through `useSyncExternalStore` with a server
snapshot; `PageAside` is the documented law-C9 exception (two portal targets, two filter surfaces,
no CSS-only twin possible) (`fcc1e24`).

**Layout test harness.** Chrome's graceful close stopped resolving on the CI host — a 30s hook
budget expired on every green assertion, and a detached close leaks a Chrome process per file. The
harness now launches a `BrowserServer` and connects to it, so teardown kills the process directly
instead of relying on Bun's undeclared 5s afterAll cap (`bd01235`).

**Deferred, not built this round:** brush/range-select, point annotations, candlestick, waterfall,
bullet chart kinds (audit-c listed them; none landed — `SeriesStyle.curve` and the format/state law
did); the five-way status-vocab fork (`StatCardTone`/`SidebarBlockTone`/`CalloutKind`/
`AccountBadgeTone`/`NotificationIntent`) consolidated onto one shared `Tone` type that the forks now
alias, not a single union — the forks themselves still exist; `'use client'` directives (none ship;
a Next App Router consumer wraps the root in its own client file); a `useHotkeys` seam beyond the
commands/spotlight battery; the forms layer rebuild (rows/groups, async resolver, submit state,
array helper — `docs/MATURATION-LEDGER.md` C5, in progress under a separate worker as this section
was written).

**Wave 8 — the visual-feedback round (2026-09-02).** Nine defects the user called out from
screenshots, each traced to a measured cause before it was touched (ledger V1–V11). The one with a
blast radius: `BasaltShell` dropped `layout="alt"` — the header spans the full width with the brand
in its leading zone, `AppShell.Main` is the one scrollport (the document never scrolls, the
scrollbar sits between content and aside), PageBar row 2 is a shell-owned band under the header,
and every sticky offset in the package lost its header term (`scrollParentOf` is the consumer seam,
`MIGRATING.md` § The shell scrollport). Around it: StatCard headers top-aligned with actions flush
right; SegmentedControl equal split + a fit-checked track law (`useTrackFits`); the phone filter
sheet renders panel rows; sidebar active rows are accent-tinted so hover can't impersonate them;
the More sheet at 40px rows with a real gutter; and a horizontal-overflow guard in real Chrome at
390/360/320 that caught a bare `BasaltDataTable`, its toolbar, and `WidgetHeader.actions`. A
headless-Chrome finding worth keeping: the installed Chrome paints its first frame ~4s after a cold
launch on this host, so any screenshot taken earlier shows 200px charts — the m5 harness warms the
browser first.

## Controls waves — 1.26.0

Five `feat:` commits implementing `docs/CONTROLS-SPEC.md`, whose evidence ledger is
`docs/archive/CONTROLS-SYNTHESIS.md` (A1..D16, cited by id, never restated). The concept in one
sentence: **every interactive control has one home, one size tier and one persistence binding, and
basalt owns all three.** Cross-consumer, that replaced 5 range pickers, 4 tab switchers, 7 section
headers, 4 refresh idioms and 4 persistence lanes with one of each.

| Commit    | Waves  | Delivers                                                                                                                                                                                                                                                                                                                                             |
| --------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `b663322` | 1 + 2  | the four density-tracked control anchors + the `-ctl`/`-icon` var sets (with the coverage test that greps Mantine's own `getSize` callers), `CtlSlot`, Mantine-free `WidgetHeader` + `DeltaBadge`, `createSearchStore` over typed fields, `createLocalStore`, the `{ since, promote, why }` grace ledger and the eight stale `warn` entries promoted |
| `da6c4a9` | 3 + 4  | `PageBar` (row 1 portalled, row 2 in-flow sticky, `--basalt-page-bar-h`), `GlobalAction[]`, `Section`, the composers on `WidgetHeader`, and `./controls` + `./controls-dates` — every filter bound to a `FieldHandle`                                                                                                                                |
| `a00c65f` | 7a     | the playground migrated onto `PageBar` + the controls, plus the reference page that gates the promotions                                                                                                                                                                                                                                             |
| `08cca78` | 5 + 6a | `sidebarBlocks` (list / progress / custom) replacing the two `ReactNode` slots, `brand.menu`, `search.actions`, persisted folds, and the ten guards of §6 with `pluginRules` mapping every id to exactly one surface                                                                                                                                 |
| `5639be1` | 6a     | the playground dogfooding all three block kinds; `SettingsRow.control` settled as law C1's third home (Mantine `md`, raw inputs legal, no size rule)                                                                                                                                                                                                 |

**The agent layer went with it** (wave 6b, this pass): 13 rules / 4,177 lines → **6 rules / 938**,
each opening with a generated `<!-- basalt:coverage -->` block, `check-coverage --check` gating the
budgets and the claims. `basalt-router.md` merged into `basalt-state.md`; the eight unguarded battery
rules merged into `basalt-batteries.md`; the three skills dropped from 741 lines to 242 and hold
procedures only. `sync` now DELETES a rule file a newer basalt no longer ships — without that, the
nine retired files would have stayed in every consumer's `.claude/`, read forever, with every gate
green. Ledger dispositions: A1–A14 die with `basalt-router.md` and the root `CLAUDE.md` block;
B/C/D prose contradictions are corrected in the six rules, the package `CLAUDE.md` (972 → 399) and
the README; D4 became law C16; D13/D14 are this section and the `ARGO-MIGRATION-LEARNINGS.md` pass.
The three-round `CLAUDE-block.md.tpl` handoff (D2 — "names three chart exceptions where there are
five") is closed.

**Wave 7 — measured, and five of the six promoted at 1.27.0.** `control-size-literal`,
`in-body-page-title` (both lanes — the plugin rule and the guard kind share the id),
`responsive-twin`, `search-literal-link` and `use-search-from-literal` are `error` in the shipped
preset; their grace entries are deleted, which IS the promotion (C16). The gating consumer run
happened and left **9 warns in argo**, every one a control inside a modal/form module whose `<Modal>`
is rendered by the PARENT route — law C1's cross-file case, which no single-file scan can see. So
`basalt/control-outside-home` and the `raw-selection-control` guard kind did NOT promote: both are
re-dated to `promote: '1.30.0'`, and both lanes gained the overlay-basename exemption
(`isOverlayConventionFile`, in both the kebab `*-{modal,drawer,popover,panel,form}.tsx` and the
PascalCase `<Subject>{Modal,Drawer,Popover,Panel,Form}.tsx` dialect) that those nine already
satisfy. The argo (≈ −700 lines) and linewatch (≈ −300) migrations of §8 have not run.

## Round-10 batch — 1.25.0

One `feat:` commit (`d18e5f1`). Per-export detail in `packages/basalt-ui/MIGRATING.md` § `1.25.0`.

- **`manualPagination` imposes a contract** — argo found on 1.24.0 that `manualPagination` left
  sorting/filtering/the "of N" count armed against a single server page, and worked around it with
  an explicit `enableSorting={false}`. Adopting `manualPagination` now requires resolving each of
  `rowCount`/`pageCount`, sorting (`manualSorting` or `enableSorting={false}`), and filtering
  (`manualFiltering`) explicitly — unresolved, it throws in dev and degrades (no sort/filter
  controls, no "of N", one `console.error`) in production. A bare client-side table is unaffected.
- Sibling fix: the empty-state branch now keys off the rendered row model instead of `data.length`,
  so a search/page-index match of zero rows renders the empty message instead of a bare `<tbody>`.

## Round-9 consumer sweep (2026-08-22)

Seven repos on 1.23.1. **No finding forced a change in any of them; no waiver tally moved** — argo
8, linewatch 3, rb 5, `basalt-ui-obsidian` 1, rollhook 1, image-share 0, image-gen 3, all 0 dead and
0 unjudgeable. Every fix the release claimed was measured as delivered. What round 9 found is one
class: **a green that was reachable by standing in the wrong directory.** Full reports:
`.claude/feedback/round-9/`.

| Found                                                                                                                                                                                                                                                                                                                | By                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `check-theme` from a package with no `basalt` key **invented** `roots: ["src"]`, reported the invention as `basalt.roots`, and passed silently — the mirror of the `doctor` case 1.23.1 had just fixed. `--audit-allows` therefore reported **0 live waivers in a repo carrying 1**: 22 of 44 files, exit 0, no note | argo; obsidian sharpest; rb, image-gen reproduce |
| `tokens:css --check` excludes the WHOLE provenance line — which carries the invocation line 1 tells you to regenerate with. `--only core` rewritten to `--only all` passed clean                                                                                                                                     | rollhook                                         |
| The same success message asserts the file "still names an older basalt-ui" without parsing it: `0.0.1-nonsense` got the same sentence                                                                                                                                                                                | rollhook                                         |
| `doctor`'s icons check is unreachable from the only directory where `doctor` exits 0 — omitted from the root run with no `⊘ SKIPPED`                                                                                                                                                                                 | rb, argo                                         |
| `.astro`/`.jsx`/`.vue` are not scannable: rollhook's two `.astro` templates are its whole markup layer, unguarded, under a clean 4-file scan                                                                                                                                                                         | rollhook                                         |
| `README.md:783-786` prescribes `bunx basalt-ui sync --check` **under a comment claiming that is what `init` seeds** — three repos hand-fixed that exact line last round                                                                                                                                              | all seven                                        |

**Not fixed, filed:** `--audit-allows` has no verdict for plain `basalt.exempt`, the stronger of the
two waivers. argo's one `exempt` entry is byte-identical to the built-in default and nothing says
so. Suggested: `redundant — identical to the default`, `dead — matched no scanned file`.

## Round-9 batch — 1.24.0

Two `feat:` commits and two `fix:`. Per-export detail in `packages/basalt-ui/MIGRATING.md`
§ `1.24.0`.

- **`QueryState`, and the branches around it** (`91f612f`; playground routes `a299813`) — the
  app-layer ask image-share and argo ranked first for four rounds. Shipping `EmptyState` and nothing
  for the other three branches was a **correctness** gap: image-share's library rendered `No images`
  on a 500 and a share detail rendered `Share not found` on a dropped connection, until 204
  hand-rolled lines over 10 call sites stopped it. A component, not a hook — the product IS the
  precedence, and a hook returns the same four-way switch to every call site. It lives under
  `src/dashboard/` because `check-dist-layering.mjs` keeps `dist/query/index.js` Mantine-free, and
  types `query` as a five-field structural subset; that subset removes the compiler, so **the shape
  is asserted at runtime and a missing `isError` throws** — precisely the "500 renders _No images_"
  bug. `LoadingState`/`ErrorState` ship beside it, `toErrorMessage`/`errorStatus` land on `./query`
  with two live bugs fixed, and `EmptyState.description` becomes optional. **Port: image-share
  2467 → 2221 total, code-only 2056 → 1882 (−174), `query-state.tsx` 204 → 0 — all 10 sites plus a
  standalone `ErrorState` by changing one import line each, zero renames, prop changes or casts.**
- **`BasaltDataTable` body chrome — and the result that did not go the promised way** (`91f612f`) —
  `maxHeight`, `minWidth`, `stickyHeader`, `stickyHeaderOffset`, `meta.align`, `meta.numeral`, and the
  Mantine passthroughs. **argo's three tables came out 341 → 370–379 lines. 29–38 LONGER.** argo named these
  props as the reason the tables stayed hand-rolled; adding them shortened nothing, because column
  defs cost more than JSX rows when every cell is bespoke — eight accessor blocks at 4–6 lines each
  against an eight-`<Table.Td>` row at ~3. **The ask was mis-specified**, which is the counterexample
  to the band kinds and the reason the port-before-shipping rule earns its keep. What the port does
  buy is ownership — the `type="native"` footgun, the alignment duplication (`textAlign: 'right'` on
  both `th` and `td`, six times in one file), and sorting/filtering/pagination. `maxHeight` renders
  `Table.ScrollContainer type="native"`, and `agent/rules/basalt-data.md` now prescribes that same
  node for a bespoke table, so the two lanes are provably the same DOM and `type="scrollarea"` — which
  breaks a sticky `thead` — is unreachable through the props; `align` is a `ColumnMeta` augmentation, so a typo'd key is a tsc error and a wrong
  value throws. **Known, not shipped:** `emptyState` renders in a `<td colSpan>` so the header
  survives an empty table (no `replace` mode); no per-column `enableSorting` of basalt's own.
- **The four false greens** (`08c17df`) — `check-theme` ascends instead of fabricating a config and
  says so in descend's own sentence (obsidian's `apps/demo`: 22 of 44 files and a 0-waiver audit
  becomes 44 and the real 1); `tokens:css --check` neutralizes only the version TOKEN, so the
  regeneration command is gated again and the success message parses both versions instead of
  asserting one; `doctor` resolves the icons check off `basalt.roots` and reports `⊘ SKIPPED` rather
  than vanishing; `SCANNABLE_EXT` gains `.astro`/`.jsx`/`.vue`. **Behaviour change:** `sync` shares
  the resolver, so from a sub-package it relocates to the parent install and refreshes it rather than
  refusing — it still cannot scaffold a second consumer.
- **The two defects the widening exposed** (`859a5d3`) — `raw-hex` read `&#123;` as `#123`. The hole
  was in the KIND, not the extension (same string, same findings in `.html`/`.tsx`/`.css`/`.vue`);
  `.astro` only walked into it first. `HEX` now rejects a full character reference, so
  `color: red&#fff` still flags and nothing is exempted by file type; every neighbouring raw-text
  kind was probed and structurally cannot share the blind spot. `.astro`/`.vue` resolve as a fourth
  `sfc` syntax stripping BOTH regions while keeping the **full 25-kind set** — a `markup`
  classification would have dropped 22. Two limits asserted, both false-negative-only:
  `css-raw-surface` does not fire inside a `<style>` fence, and stripping is region-blind. **A known
  non-fix, deliberate:** an all-hex URL fragment or SVG ref (`href="#cafe"`) still reports — a fix
  would cost real findings.

**A `SCANNABLE_EXT` widening is outside the grace mechanism, by design.** `GRACE_PERIOD_KINDS` is
keyed per KIND; widening the file set widens all 25 at once. An entry for `raw-hex` would demote the
most load-bearing kind to `warn` across every `.tsx` and `.css` in all seven consumers to buy runway
on a file type one consumer has. Measured: no other consumer holds a single `.astro`/`.vue`/`.jsx`
file, so grace would have covered zero incumbent violations. Doctrine recorded in
`packages/basalt-ui/CLAUDE.md` § "Shipping a stricter guard".

**Handoff:** `--audit-allows` still has no verdict for `basalt.exempt` (above), and
`agent/templates/CLAUDE-block.md.tpl` still names three chart exceptions where there are five —
`templates/` was outside this pass too, second round running.

## Round-8 consumer sweep (2026-08-22)

Seven repos on 1.23.0. **No finding forced a change in any of them** — the only code that moved was
linewatch's deliberate band-kind port, below. Two waiver tallies moved and both are the consumer's
own doing: linewatch 14 → 3 through the port, rb 6 → 5 because the `icons` array let it delete the
hand-written `manifest.webmanifest` its sixth waiver lived on (expect 5 there now, not 6). Full
reports: `.claude/feedback/round-8/`.

| Found                                                                                                                                                                       | By                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `basalt-ui --version` did not exist — the one control introduced after round 7's stale-`bunx` incident, and six reports independently reached for it and fell back          | six of seven                          |
| An unrecognized FLAG was silently ignored and the command exited 0: `doctor --json` ran doctor and passed                                                                   | nobody — found while fixing the above |
| `doctor` from a non-install package prescribed `basalt-ui init` where `sync`, same directory, names the parent — following it scaffolds the second consumer 1.22.0 prevents | argo, image-gen, rb, obsidian         |
| `init`'s script and CI templates had seeded `bunx basalt-ui` into ten places across three consumers, one of them a `.claude` PreToolUse hook                                | argo, image-gen, rb                   |
| `chart-missing-aria-label` fired on a consumer's OWN 235-line `MirroredBars`, demanding a prop it does not accept, as a correctness finding                                 | linewatch                             |
| `doctor`'s icon check demanded six filenames from the app that adopted the `icons` array — the app the feature was written for                                              | rb                                    |
| `tokens:css --check` gates on a line carrying the emitting version, so every release forces a no-op commit in a tokens-only consumer                                        | rollhook                              |
| A `BandSpan.state` naming no `series` entry drew nothing, which on a measured/not-measured strip is a coverage claim                                                        | linewatch                             |

### The band-kind adoption result — and the ~150 lines it missed

linewatch put all six of its charts on shipped kinds. This is the first kind proven by porting a
real consumer rather than by demo, so the port's own promise is the thing to check.

| Source                              | Promised   | Actual          |
| ----------------------------------- | ---------- | --------------- |
| `availability-strip.tsx`            | 613 → 321  | 613 → **391**   |
| `link-speed-strip.tsx`              | 642 → 389  | 642 → **441**   |
| `throughput-chart.tsx`              | 532 → 247  | 532 → **276**   |
| `charts/follower-anchor.ts` (+test) | → 0        | deleted         |
| `charts/hatch.tsx`                  | unpromised | 49 → 0, deleted |
| **total**                           | 1884 → 957 | 1884 → **1108** |

**On code-only lines the port is 1148 → 649, −43% — larger than the raw-line −41%.** The whole miss
is comment prose, which a scratch port does not carry: linewatch keeps its arguments in docblocks by
house rule, and every rationale still true was preserved rather than trimmed to hit a number.
`lib/axis.ts` landed at 200 → 170 against a promised 160, the miss again a docblock, which GREW
because the helper stopped being a fallback and became the one seam six charts pass through.

**The claim that mattered held exactly.** All 11 `hand-rolled-plot` waivers retired, none replaced;
14 `theme-allow` → 3, and none of the three survivors is chart-related (two `inline-spacing` on a
prose verdict line, one `raw-surface` on a status dot).

One line worth keeping: **a scratch port is honest about structure and optimistic about totals.**
Read its file-by-file shape; discount its arithmetic.

**Known gaps — reported, not fixed.** No `bandHeight` prop, so band height is derived and floored
and linewatch hand-copies `AXIS_HEIGHT = 30` into three files — a restatement of `VX.margin.bottom`,
which is density-derived upstream, with no guard on the drift. `getBand`/`getAbsentFraction` never
see the fold's bookkeeping. **`ChartTooltipFloat` still has no viewport gate**: linewatch's 57-line
`use-in-viewport.ts` survives, now threaded into all six charts. `BandStrip` derives exactly one
tooltip row, so extras stay hand-authored in `extraRows`. No `init --tokens-only` to seed the three
scripts a tokens-only consumer's gates need. No `inline-spacing` exemption for `src/charts/**`,
where the rule's own remedy is a Mantine prop the boundary forbids — the same argument that already
exempts `inline-display` and `raw-html-layout` there.

## Round-8 batch — 1.23.1

Three `fix:` commits. Per-export detail in `packages/basalt-ui/MIGRATING.md` § `Unreleased`.

- **A typo'd band state stops asserting absence** (`c51b9a0`) — a `BandSpan.state` naming no
  `series` entry used to be skipped, drawing a coverage GAP on a strip whose whole vocabulary is
  measured/not-measured. It now **throws in dev** naming the key and the valid set, and in
  production draws a dashed neutral outline band — a treatment no legend entry and no state fill
  uses — plus an `Unknown state` tooltip row. The split is deliberate: `state` comes off the DATUM,
  so a feed growing a new state must degrade rather than take a dashboard down, while a typo, the
  same input, still fails loudly where it is written. `marker.state` follows it. `absentState` and
  `MirroredBars`' `up.key`/`down.key` are PROPS, so they throw everywhere — an unresolvable pane key
  hid the pane AND its axis, which reads as a measured zero. `BandStripSeries.formatValue` is now
  `(d) => string | null`; `null` renders an em dash, distinct from `''`.
- **The two chart tag rules gate on where the tag came from** (`ba2ea5f`) — a tag is skipped only
  when the file DEFINES a component of that name and does not also import it from `basalt-ui`.
  One-directional on purpose: a basalt import, a consumer barrel re-export and an unattributable tag
  all still fire, where a positive-import gate would have switched both rules off for every
  barrel-wrapping consumer and every file with no imports. Verified old-vs-new over **945 files
  across six repos: 0 findings lost, 0 gained.**
- **The CLI answers which version ran, and stops failing open** (`498b011`) — `--version` / `-v` /
  `version` print one bare line and exit 0, resolved before dispatch. The larger half: **every
  subcommand validates its flags** and exits 1 naming the one it does not accept. `doctor` reads
  `basaltAppPlugin({ icons })` instead of hardcoding six filenames; `doctor` and `sync` share
  `parentInstallAdvice()`; every seeded invocation goes through `basaltBinCommand()`/`BASALT_BIN`,
  so the ten `bunx` sites the seed produced become the local bin; `tokens:css --check` blanks the
  provenance line before comparing, so a version bump alone stops forcing a no-op commit.

**Corrections to the record.** Three, and all three are ours:

1. **All six reports said `--version` "exits 0 printing usage". It exited 1, to stderr** — the
   dispatcher's `default:` branch has always been `console.error(USAGE); return 1`. The real
   fail-open was an unknown FLAG, which no report tested, and the misdiagnosis was relayed verbatim
   into the fix brief. Report the symptom you measured, not the one you inferred from it.
2. **`cb4e5b7`'s message is wrong**, and it is on `master` where it cannot be rewritten. It claims
   it taught `unframed-chart` the two new kinds; it widened `CHART_ENTRY_POINT_TAG`, which only
   `chart-missing-aria-label` reads. `unframed-chart` keys on `<ChartLegend items={[` and has no
   kind list — there was never an asymmetric pair. Round 7's handoff below named the same wrong
   rule. The correction lives in `packages/basalt-ui/CLAUDE.md`, where the next reader of that
   commit will be.
3. **Open question, not a plan:** the import gate does not make `CHART_ENTRY_POINT_TAG` or the
   plugin's `CHART_TAGS` redundant — the list still answers _which_ tags owe an `ariaLabel`. The
   gate only turns a missed kind from a false positive into an under-report. Collapsing the two
   lists is a larger change and has not been made.

**Handoff:** `agent/templates/CLAUDE-block.md.tpl` still names `DualPanel`/`Donut`/`Heatmap` as the
declared non-single-plot exceptions; there are five. `templates/` was outside this pass.

## Round-7 consumer sweep (2026-08-22)

Seven repos on 1.22.0. **Zero code changes needed in any of them** — no `check-theme` finding, no
`basalt/*` oxlint finding, no waiver moved. Full reports: `.claude/feedback/round-7/`.

| Found                                                                                                                                                                                                              | By                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| A repo root with no `workspaces` field and the install one level down is invisible: `check-theme` printed "no off-palette colors" over **zero files**, `doctor` inferred `tokens-only` for a full Mantine consumer | linewatch, image-share |
| `sync` told a tokens-only consumer to run `basalt-ui init` — the advice `doctor` exists to prevent, same directory, same version                                                                                   | rollhook               |
| The fifth `theme-allow` shape hole: the `{/*` whose closer sits alone on its line, honoured by oxlint, ignored by the guard                                                                                        | linewatch              |
| `icons` still could not name a real icon file — six fixed filenames or nothing, and rb's icon is `favicon.svg`                                                                                                     | rb                     |
| `MIGRATING.md`'s newest heading named `1.21.1`, a version npm never served — **third round running**                                                                                                               | all seven              |

**Corrected findings.** _"`sync` scaffolds 19–20 files into a consumer root"_ did not reproduce —
those runs executed a stale `bunx` cache of 1.20.0. Third round in which a consumer diagnosis was
wrong on cause, and the second caused by the measuring harness rather than the code (round 6's was
`$?` after a pipe). **Check an upgrade against the local bin.**

## Round-7 batch — 1.23.0

The first batch this cycle that widens the framework rather than the guard.

- **Two banded chart kinds** (`c1da509`; playground routes `f72611a`, the non-finite-`absentFraction`
  fix `370b9be`, `chart-in-raw-surface` `cc4903d`) — `BandStrip`
  (1-D categorical bands, no y dimension) and `MirroredBars` (two bar panes, one x scale, one
  baseline, independent domains). Neither can compose `CartesianChart`, which renders
  `AxisLeftNumeric` unconditionally and builds x as `scalePoint`. Shared choreography in an internal
  `useBandPlot`; `foldBands` + `HatchPattern`/`hatchFill`/`hatchSizeFor` ship.
  **Proven by porting, not by demo:** linewatch's real charts — promised 1884 → 957 source lines,
  delivered 1108 (code-only 1148 → 649, −43%; the miss is docblock, see the round-8 sweep), and the
  waiver claim held exactly: all 11 `hand-rolled-plot` retired, 14 `theme-allow` → 3. The port caught two live bugs —
  a `NaN` series value painting `y="NaN" height="NaN"` bars and a non-finite `absentFraction`
  painting `width="NaN"` bands, both silently invisible. **Doctrine now: a kind is proven by porting
  a real consumer's call sites and reporting what it could NOT express.** `StatCard.tone` shipped in
  1.7.0 without that check and four consumers re-rolled the card anyway.
- **`xTickValues` on `CartesianChart`** (`cdb083a`) — resolves ahead of `xTicks`, forwarded by the
  four cartesian kinds and both band kinds. A tick COUNT cannot express a legible dense time axis:
  `smartTicks` appends the final key unconditionally, so any count missing the last index collides
  two labels at the right edge. The consumer's own helper went 200 → 160 lines — it shrinks, it does
  not die.
- **CLI resolution and reporting** (`791225b`) — `resolveProjectDir` falls back to a bounded
  two-level layout scan when nothing is declared; `BASALT_CWD` honoured by all three commands;
  `sync` is profile-aware (tokens-only → `n/a`, exit 0, so `sync --check` is CI-wirable); `sync`
  heals `DESIGN.md` openers that still name a version (the file is a seed, so the stamp was never a
  constant); new `shipped-versions.test.ts` fails any shipped asset naming a version `CHANGELOG.md`
  does not record.
- **The annotation grid is enumerated, not collected** (`28367af`) — the reported hole was three:
  the closer-alone shape, a `MAX_COMMENT_BLOCK_LINES = 8` budget truncating the walk inside a
  ~12-line docblock, and the plugin requiring the annotation to be the LAST comment above the node
  (so a reason wrapped onto a second `//` reported under oxlint while the guard waived it). Pinned
  now over four axes: guard 37 supported + 8 asserted-unsupported, plugin 32 + 8. **Zero
  disagreements, down from five, with no tally change in any of the seven consumers.** The previous
  round's "thirteen-shape matrix means the two parsers can no longer disagree" was false when
  written — a list of anecdotes cannot close a contract.
- **`basaltAppPlugin` icons can name a real file** (`ead3bac`) — `icons` also takes an array using
  the manifest's own field names plus an optional `rel`; every entry becomes a manifest icon, only a
  `rel` reaches the head, an empty array reads as `false`, `{ dir }` unchanged. rb can delete its
  hand-written `manifest.webmanifest` and the permanent `theme-allow-file` on it.

**Known gaps — reported, not fixed:** no `bandHeight` prop (band height is derived and floored by
`VX.margin`, so linewatch raised its axis height instead); `getBand`/`getAbsentFraction` never see
the fold's bookkeeping; `ChartTooltipFloat` still has no viewport gate; `BandStrip` derives exactly
one tooltip row, so extra rows stay hand-authored. **Handoff, and it named the wrong rule:** `CHART_ENTRY_POINT_TAG` (`src/guard/index.ts`) is read by
`chart-missing-aria-label`, not by `unframed-chart`, which keys on `<ChartLegend items={[` and
carries no kind list. `cb4e5b7` widened the regex and its own message repeats the error — see the
round-8 batch's corrections. Still open: `agent/templates/CLAUDE-block.md.tpl` says
`DualPanel`/`Donut`/`Heatmap` are the declared exceptions; there are five.

## Round-6 consumer sweep (2026-08-22)

Seven repos on 1.21.0. Every finding was **a toolchain reporting an answer it had not earned** — the
class the last two releases exist for, one layer in. All closed in the 1.22.0 batch below. Full
reports: `.claude/feedback/round-6/`.

| Found                                                                                                                                                                                 | By                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `sync` scaffolded a competing install from a sub-package — `0 updated, 20 recreated`, a second `basalt` key, 20+ files beside the real one. Neither run warned; both reverted by hand | argo, rb                   |
| `--audit-allows` could not judge a plugin-rule waiver, so the exit-1 gate covered an empty set: argo `0 live, 0 dead, 8 outside reach`, 11 of linewatch's 14 the same                 | argo, image-gen, linewatch |
| `doctor`'s `lefthook-preset` warned at a correctly configured repo and prescribed a change that would have broken it                                                                  | linewatch                  |
| `shadow-basalt-export` told a React-free package with no basalt-ui dependency to import from basalt-ui                                                                                | basalt-ui-obsidian         |
| `basaltAppPlugin({ icons: false })` shipped a manifest naming two 404s                                                                                                                | rb                         |
| Two `theme-allow` comment shapes waived nothing, one of them linewatch's chart-axis shape                                                                                             | linewatch                  |

**Corrected finding** — argo's _"`doctor` exits 0 on two hard failures"_ was a pipe artifact: `$?`
read after `| tail` returns tail's status. The real exit was 1; no code changed. `doctor`'s exit
status is now pinned per outcome rather than by printed text, which is what let 1.20.0 ship a
SKIPPED-exits-0 bug.

**Known gaps, still open:** `--audit-allows` says nothing about `basalt.exempt` (re-filed in round 9) and its `scoped to …` line does not distinguish `theme-allow` from `theme-allow-file`. The
profile-gated `check-theme` manifest hint sits CLI-side behind `PLAIN_JSON_HINT_PATH`; it belongs in
the guard as `guardWaiverHint(relPath, { profile })`.

## Round-6 batch — 1.22.0

Full per-export detail in `packages/basalt-ui/MIGRATING.md` § 1.22.0; the shape of it:

- **`sync` refuses instead of scaffolding** (`40d7fc6`) — resolves its project as
  `check-theme`/`doctor` do, then exits 1 when that project has no manifest, naming the install it
  found above. The refusal runs BEFORE the `basalt.roots` backfill, which was half the damage.
  `created` is its own counter now.
- **`--audit-allows` gains the oxlint half** (`cfb4d1a`, `40d7fc6`) — a plugin-rule annotation is
  probed by re-running oxlint over one neutralized sibling file (argo 8/8, linewatch 14/14, basalt
  23/23); unreachable oxlint is "cannot judge", never "dead". The reader ships as four runtime
  exports on `./guard`, so the audit stops carrying a mirrored regex one shape behind.
- **`doctor`'s `lefthook-preset` asks whether the gate EXISTS** (`40d7fc6`), via `lefthook dump`,
  which resolves `extends`, `include` and per-command `root:`. A broken `extends` target stays a
  hard fail, a provably absent gate is a warn, can't-tell is advisory.
- **Two `theme-allow` comment shapes fixed** (`cfb4d1a`) — **fourth hole in three rounds**; the
  thirteen-shape matrix shipped with it did not close the contract (see round 7).
- **`shadow-basalt-export` narrowed** (`314eae8`), **`icons: false` reaches the manifest**
  (`9d6fbe0`), **`check-theme`'s manifest hint is profile-gated** (`40d7fc6`) — leading with
  `basaltAppPlugin` is unreachable for a tokens-only consumer.

## Rounds 4 and 5 — compressed (1.20.0, 1.21.0)

Both batches shipped and are four releases behind; the full reports are `.claude/feedback/round-4/`
and `round-5/`, per-export detail in `MIGRATING.md` § 1.20.0 / § 1.21.0. What still governs:

- **Round 4's one bug in five shapes: every gate passed and nothing was enforced.** `doctor` gained
  `SKIPPED` as a third outcome that exits non-zero on its own, plus `basalt-resolves` / `guard-scan`
  / `oxlint-preset` hard checks; five guard kinds and two oxlint rules landed at `warn` for one
  minor; `init` started writing a real `basalt.roots`; `tokens:css`/`fonts:css` output became
  commit-clean. Consumers saw `doctor` go red where it had been green — that was the point.
- **The guard sees palette, not vocabulary.** ~15 independent re-rolls of shipped components, all
  green — `StatCard` alone re-rolled by 4 of 4 app consumers. `shadow-basalt-export` and
  `hand-rolled-shell` detect the two cheapest shapes; the **expressiveness** half is what actually
  closes the gap, one case at a time: the chart half landed in round 7 (`BandStrip`/`MirroredBars`),
  the query-branch half in round 9 (`QueryState`), the store half in the Unreleased minor
  (`createSearchStore` over typed fields — `createSearchSchemaStore` is struck, never built, and not
  needed: a Zod-object route composes `store.validateSearch(raw)`).
- **Round 5 found documentation making false load-bearing claims** — the failure `MIGRATING.md`
  exists to prevent. Four wrong rows, found by re-auditing every replacement against the built
  `.d.ts` rather than the commit it came from; a correction that landed only in this repo's
  `CLAUDE.md` and not in `agent/rules/*` had not shipped at all. **A doc claim is audited against
  source or it is a guess.**
- **The `theme-allow` grammar** (1.21.0) — both parsers did a bare substring search, so a comment
  merely _mentioning_ the token disarmed the line below, and a consumer disabled a file by
  documenting its own waivers. An annotation must START its comment, file scope is spelled
  `theme-allow-file`, and a bare one waives nothing. `--audit-allows` proves each waiver by
  re-running the guard with that one occurrence neutralized.
- **Two corrected findings, both reported and both wrong**: "no release notes for any minor" (minors
  are `#`, patches `##`) and "the chart rules are outside `GRACE_PERIOD_KINDS`" (true but not
  meaningful — they are plugin rules, and `PLUGIN_RULE_GRACE` is their ledger).
- **Known limit, deliberate:** a DOM-drawn chart is invisible to `hand-rolled-plot`, which keys on
  the visx assembly primitives. Every alternative detector tried flagged either basalt's own
  `Donut`/`Heatmap` or an icon in a card header, and a noisy shipped rule gets switched off.

## Adoption gap — closed in 1.7.0 (2026-08-02)

Prompted by the first outside-of-argo consumer (LineWatch), whose dashboard had grown seven
hand-rolled `<Card withBorder radius="md" padding="lg">` next to `StatCard`s — two card idioms,
visibly different on one screen. Three separate causes:

1. **basalt was installed as a component library and nothing else.** No `.oxlintrc.json`, no
   manifest, no lint script, no CI — `basalt-ui init` had never been run, so every enforcement
   mechanism the package ships was inert and nothing said so. `basaltViteConfig` now prints a
   one-time notice when no manifest is found at or above the cwd; it runs on every dev start, so it
   catches this while it is cheap. A notice, never an error (`enforcementNotice: false` opts out).
2. **Two real holes in the guard.** `size="10px"` passed (`no-raw-font-size` tested only a NUMERIC
   literal) → `raw-size-literal`; `c="yellow.7"` passed (no kind covered a shade-pinned Mantine
   colour) → `mantine-shade-index`, `warn` at 1.7.0 and **`error` at 1.11.0** — a grace that ran
   four minors instead of one, which is why `GRACE_PERIOD_KINDS` is a tracked list.
3. **An expressiveness failure no linter could have caught.** LineWatch wrote a 35-line
   `ThresholdRail` wrapper because `StatCard.value` is typed `string` and the number could not be
   tinted. `StatCard` took `tone`; 1.8.0 widened it to three values when the same consumer hit the
   same wall on a Downtime card where **zero is the earned state**, which two tones could render
   only as red (wrong) or untinted (indistinguishable from "nothing measured"). **The lesson, twice
   over: a composite that cannot express a common case gets routed around by compliant-looking code
   the guard cannot recognize, and the gap is found by the consumer, one case at a time.**

## Chart-layer rebuild — one mandatory cartesian primitive, shipped 1.15.0 (2026-08-18)

Design + rationale: **`docs/CHARTS-SPEC.md`** (ground truth). Prompted by the one consumer building
charts daily: tooltips, legends and responsive sizing all needed pushing around per chart. The
diagnosis was not visx — basalt's own layer had two tiers with no rung between them, so anything
that was not a shipped kind fell to ~130 lines of hand-rolled margin math, scales, axes, overlay and
tooltip assembly, and every cartesian kind repeated that preamble internally.

TanStack Charts (v0.14.0, same month) was evaluated as a replacement and **rejected** — pre-alpha,
its own README says not production-ready, no 1.0 date. Its architecture is the better one, and the
four ideas worth stealing were: measured guides, a cursor controller separate from crosshair
presentation, one responsive path, and tooltips/legends/axes as first-class parts of the chart
definition. Revisit the library if it reaches 1.0.

1. **`CartesianChart`** — the missing rung. Owns measured margins, both y scales + domains, the x
   scale and tick thinning, grid, zones, axes, the shared cursor, the crosshair and its per-series
   dots, the hover/keyboard overlay and the derived tooltip. A kind supplies `series` + a child that
   draws ONLY marks. Every single-plot cartesian kind was rewritten onto it; the bespoke dual-axis
   playground chart went ~145 → 29 lines.
2. **Margins are measured, not tokenized.** `autoMargin` sizes each gutter from the tick labels that
   will actually be painted (`measureText`, offscreen canvas, memoized, SSR fallback). `VX.margin`
   becomes a FLOOR, and passing `y2` is what makes a chart dual-axis.
3. **The cursor is shared by default** — a module-level external store read through
   `useSyncExternalStore`, not a context that had to be mounted. `ChartHoverSync` is deleted;
   `ChartCursorScope` ISOLATES a subtree instead. Resolution is domain-aware, which retired the
   `resolveKey` escape hatch and the folded-domain desync.
4. **Legends toggle** (on at ≥2 entries), hiding the series from plot, tooltip and auto domain
   together. **`ChartTooltipFloat`** does portal + flip + viewport clamp + measure-before-show once
   for every chart; the hover overlay is focusable and scrubs on ←/→.

**The contract is mechanically enforced, not advisory** — `basalt/hand-rolled-plot` and
`basalt/chart-legend-literal`. Both sat at `warn` for four minors with nothing tracking them, as did
`basalt/raw-size-literal` for twelve: `GRACE_PERIOD_KINDS` governs `GuardKind`s only, so there was
no map to empty. **1.20.0's `PLUGIN_RULE_GRACE` is that map** — read the current level there, not
from a doc, which is what drifted.

Deleted outright (greenfield, one lockstep consumer, no shims): `ResponsiveChart`, `ChartHoverSync`,
`HoverContext`, `useHoverSync`, `useChartTooltip`, the tip-based `ChartTooltip` + `useTooltipStyles`,
`BarsAxisConfig`, `ZonedLineTooltipLabel`, and the whole `yDomain`/`yAutoMaxFloor`/`yAutoMinCeil`/
`yAutoPad`/`numTicksY`/`formatYTick` prop family on every kind (now one `AxisConfig` per axis).
Ships as a plain `feat:` on the 1.x line — majors stay banned.

Two regressions were caught during migration and fixed in the primitive rather than per kind: a
stacked band's crosshair dot sat at its raw value instead of the cumulative band top (now the
`cursorValue` seam), and an `AxisConfig.domain` function could not see which series the legend had
hidden, so a stacked domain never shrank (it now receives `visible`).

## Native mobile nav + one typed nav definition — shipped 1.19.0 (2026-08-20)

Two changes that turned out to be one change. The mobile bottom bar stopped being a menu, and the
consumer's navigation stopped being five restatements of the same destination.

### The bar navigates

A slot is now a DESTINATION. Tapping it navigates through the consumer's router `Link` with no
overlay, no animation and nothing to dismiss — previously every tab raised a full-viewport
`Drawer`, so reaching a page took two taps and opened one overlay. The full-height mobile
`AppShell.Navbar` drawer is deleted outright (`collapsed: { mobile: true }`, permanently) and
everything it held — account, settings, theme switcher, the rest of the nav — moved into the
trailing More slot as flat rows.

Overlays now exist only where a slot genuinely holds more than one destination, and the surface is
INFERRED rather than configured: 0 rows drops the slot, 1 collapses to a plain link, ≤ 6 is a
`Menu` that pops out of the tab, more is a bottom sheet. Six is arithmetic (6 × 44px + 8px against
415px of headroom on the smallest supported viewport), which is why the menu runs `flip: false` and
can never render below the fold. Move a destination in or out of More and the surface changes
itself.

`projectMobileNav` (`src/shell/mobile-nav-model.ts`) is the pure projection that decides all of it —
no React, no Mantine, no DOM — so the whole interaction law is unit-testable with no renderer.
`MobileNav` only paints the result. Three behaviours that were bugs and are now rules:

- A **disabled** destination used to be dropped silently and shipped as a live row. It now appears
  in the overflow rendered disabled, and can never be a link slot.
- A slot's `active` now includes **nested children**, so a tab no longer goes dark when a child
  route is current. Consequence to know: re-tapping a parent tab while a child route is active
  scrolls to top (the Material/iOS pop-to-root idiom) rather than navigating to the parent.
- Every `:hover` moved behind `@media (hover: hover)`; ungated, the last-tapped row stayed lit.

Safe-area handling is the part most likely to be "fixed" back into a bug: Mantine's own
`AppShell.footer` rule already grows the footer box by `env(safe-area-inset-bottom)` AND pads its
content, so adding either to `.bar` double-counts. The one real gap is `--app-shell-footer-offset`,
set to the raw height, which leaves `AppShell.Main` short by exactly one inset — closed by
`.mainSafeArea`.

Two new density-tracked tokens (`mobileNavBarHeight` 56, `mobileNavRowHeight` 44) carry hard floors
at 48/44 in `deriveSpacing`, because the `1 + 0.1 * level` law would take them to 39/31 at level −3
and silently break the minimum touch target.

### One typed nav definition

`defineNav` / `navGroup` / `navTarget` / `flattenNav` / `useNav` (`basalt-ui/router-tanstack`)
replace the whole hand-wired nav layer. One `defineNav({ groups: [...] })` in a leaf module
produces the desktop sidebar AND the mobile bar; `useNav(NAV, { badges })` resolves active state
through `useMatchRoute` and builds each destination's anchor, returning `{ sections, mobileNav }`
to spread onto `BasaltShell`. In the reference consumer that is ~237 nav lines in `__root.tsx`
collapsing to 4 (plus a 95-line leaf), a destination stated once instead of five times, and zero
`as never` casts, zero render callbacks and zero hand-written `useMatchRoute` calls.

Route options ride inside a `link: linkOptions({...})` key rather than flat on the item. That is
not cosmetic: TanStack's `Constrain` is an ASSIGNABILITY check, and assignability does no
excess-property checking, so a flat `{ id, label, to, colour: 'red' }` compiles silently. A config
whose selling point is "typos are compile errors" cannot have a hole exactly where metadata typos
live. Compile-verified both ways.

**The risk that comes with it, stated plainly:** without the consumer's `Register` module
augmentation, `RegisteredRouter` degrades to `AnyRouter`, every `to` widens to `string`, and the
whole definition validates NOTHING while reporting zero errors. The API looks like it is working.
`agent/rules/basalt-router.md` says so, and the playground type-guard fixture is the only defence
inside this repo.

A compile-time cap on `mobile.tabs.length` was tried and **rejected**: both forms that make the
length check work silently degrade `NavTabId<G>` to `string`, killing the far more valuable id-union
validation. The cap is a runtime DEV warn in `projectMobileNav` instead.

### Migration (removed exports — no major, per the no-majors doctrine)

`renderNavLink`, `renderBreadcrumbLink` and `sidebarFooterExtra` are gone from `BasaltShellProps`,
along with the exported types `NavLinkRenderer`, `MobileNavLinkRenderer`, `BreadcrumbLinkRenderer`,
`MobileNavItem` and `MobileNavSection`. The replacement for all three callbacks is one component
seam — `SidebarItem.Anchor`, typed `NavAnchor` — and on the breadcrumb bar, `parentAnchor`.
`sidebarFooterExtra` rendered inside `mobileControls`, which was `hiddenFrom="sm"`: it was invisible
on desktop, a latent bug, and its only host is the drawer being removed. A consumer with no router
needs no migration at all — `href` + `onClick` still work.

`MobileNav`'s own props changed from `sections` to a `model` built by `projectMobileNav`; the shell
does that itself, so only a consumer composing the sub-components by hand is affected.

## Framework-free token consumption — shipped 1.3.0

`basalt-ui tokens:css`, the published `basalt-ui/tokens.css` subpath, the `scheme` /
`defaultScheme` / `mediaFallback` selector options, `only: 'core'`, and five peers turned
`optional` so a tokens-only install carries no React. Kebab-case name normalisation followed in
1.5.0. Ground truth for consuming it: **`docs/FRAMEWORK-FREE.md`**.

First real non-Mantine consumer: `rollhook`, round 4 — two Tailwind v4 apps, one on
`import 'basalt-ui/tokens.css'`, one on a committed `tokens:css` output.

**Three and a half of the four gaps that migration found are closed in 1.20.0** —
`--selector-class`, `fonts:css`, a declared tokens-only profile, and a `--check` drift gate. The
half: the emitter still writes `rgba(…, 0.10)`, which `format/prettier` rejects, and `--fix` puts
the file into `--check` drift. See `docs/FRAMEWORK-FREE.md`.

**Follow-ups the original work deliberately did NOT fold in:**

- **Expose `buildPaletteData` / `PaletteData`.** `deriveRadius` and `deriveSpacing` are public, but
  the color derivation runs through `createBasaltTheme` (React + Mantine), so a framework-free
  consumer can retune radius and density and **cannot retune the accent**. Real gap.
- **A plain-class `dist/content.css`.** The prose language is CSS-modules-scoped and reachable only
  through React components. Larger design question.
- **Reconcile the accent drift.** `docs/DESIGN-SPEC.md` states `#0077bd` / `#8ec5ff`; the emitter
  produces `#4374a6` / `#a2c3f0`, because chroma is scaled by `max(seedChroma, 40) × 0.72` at
  vibrancy 0. `theme/contrast.test.ts` pins the drifted values, so this is known rather than
  accidental — but a consumer reading the spec gets a different palette than one calling the
  emitter. Decide which is authoritative. This is the one item here that would visibly move existing
  consumers' pixels, which is why it stays separate.
- **`--basalt-font-head-stretch` as a `createBasaltTheme({ fonts })` option.** The knob exists in
  CSS; reaching it from the theme config would make it a real dimension like the rest.

---

## Appended 2026-09-02 — CHARTS-SPEC "Why the layer looks like this" + the MirroredBars decision-reversal narrative (lifted from docs/CHARTS-SPEC.md during the C4 docs-consolidation wave)

Historical rationale for the pre-2026-08-18 two-tier chart layer and why the 1.15.0 rebuild
happened, plus the 2026-08-22 `MirroredBars` decision-reversal writeup. Not maintained.

### Why the layer looked like this, before 2026-08-18

Before 2026-08-18 the chart layer had two tiers and no rung between them:

- **Kinds** (`ZonedLine`/`Bars`/`MultiLine`/…) wired legend + tooltip + crosshair + sizing
  correctly.
- **Anything else** fell to raw visx: ~130 lines of margin math, scales, `<svg>`, `<Group>`, grid,
  axes, `HoverOverlay`, tooltip assembly per chart (see the pre-rebuild `SessionsRevenueChart` in
  the playground, before it moved onto `CartesianChart`). Every cartesian kind repeated that same
  preamble internally, so the duplication was paid 7× inside the package and once more at every
  bespoke call site.

Three consequences, all reported from real use:

1. **Margins were static tokens.** `VX.margin` / `chartMargin({ rightAxis })` cannot know how wide
   a tick label is, so long labels either clipped or got hand-nudged per chart. That was the "I
   always push the charts around" complaint, exactly.
2. **Sharing was opt-in and brittle.** A shared cursor needed a `ChartHoverSync` ancestor, and
   resolved foreign keys by exact string match — a chart that folded its domain desynced, patched
   by a manual `resolveKey`.
3. **Two responsive paths.** `ChartFrame` (measures width + height, reserves the legend band) and
   the legacy `ResponsiveChart` (width only). Charts on the second path sized differently from
   charts on the first.

Greenfield, one consumer, upgraded in lockstep: the rebuild broke the kind APIs rather than
layering a compatible shim over them. It shipped as `feat:` on the 1.x line (no majors).

### `MirroredBars` ships — the decision it replaces was recorded against the wrong blocker (2026-08-22)

The old entry read _"no two-bar-pane kind with independent per-pane scales"_, with _"a second
consumer asks for the same shape"_ as its trigger. That trigger never fired. Round 4 framed the
blocker as **independent scales**, and linewatch corrected the framing: `DualPanel` already had
`topYDomain` and `bottomYDomain`, so per-pane domains were never what stood in the way.

What actually blocked it is structural, and neither half is a domain question. `DualPanel`'s top
pane is a **line** pane drawn with `LinePath`, and its bottom pane takes a single **signed**
`getBar` over a symmetric domain. Two independent magnitudes are not one signed quantity, and two
bar panes are not a line over a histogram — covering both from one kind means a mark switch, a
second accessor, and a per-pane domain law contradicting the symmetric one `DualPanel` documents.
`MirroredBars` is a sibling kind for that reason, not an extension.

The lesson is not "wait for a second consumer". **A decision recorded against the wrong blocker
outlives its own refutation**, because the stated trigger keeps pointing somewhere else. What
re-opens a shape decision is a corrected diagnosis.

---

## Appended 2026-09-02 — CHARTS-SPEC §7 band-plot porting evidence (lifted from docs/CHARTS-SPEC.md during the C4 docs-consolidation wave)

### The kinds were proven by porting, not by review

Built against linewatch's real charts in a scratch copy, and measured there:

| File                                      | Before   | After   |
| ----------------------------------------- | -------- | ------- |
| `availability-strip.tsx`                  | 613      | 321     |
| `link-speed-strip.tsx`                    | 642      | 389     |
| `throughput-chart.tsx`                    | 532      | 247     |
| `follower-anchor.ts` (+ its 70-line test) | 97       | 0       |
| **total**                                 | **1884** | **957** |

All 11 of linewatch's `hand-rolled-plot` waivers retire; its live `theme-allow` count goes 14 → 3,
none of the three chart-related. The port also caught two live bugs nothing else had: a `NaN`
series value painted `y="NaN" height="NaN"` bars, and a non-finite `absentFraction` painted
`width="NaN"` bands. Both fail silently — no error, no warning — and on a monitoring strip a
missing mark reads as missing coverage rather than as a bug.

**Doctrine, and the point of the exercise: a new kind is proven by porting a real consumer's call
sites and reporting what it could NOT express.** A demo page proves nothing, because a demo is
written against the API that exists. `StatCard.tone` shipped in 1.7.0 with no such check and four
consumers re-rolled the card anyway.

### What the two kinds still cannot express

Reported from that port, not deferred silently:

- **No `bandHeight` prop.** Band height is derived and floored by `VX.margin`, so linewatch had to
  raise its axis height rather than lower the band.
- **`getBand` / `getAbsentFraction` never see the fold's bookkeeping.** The accessor gets the
  merged datum; how many members were folded into it, and how many of those measured anything, are
  the consumer's own fields to carry.
- **`BandStrip` derives exactly one tooltip row.** Anything beyond it stays hand-authored in
  `tooltip.extraRows`.
