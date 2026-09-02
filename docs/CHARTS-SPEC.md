# The chart layer

Ground truth for how charts are built and enforced. visx stays; what basalt puts on top of it is
this document. Composing `CartesianChart` (single-plot) or `ChartFrame` directly (multi-pane /
radial / matrix) is **mandatory**, not an option — the result of a one-time, dated rebuild
(2026-08-18) that broke the kind APIs rather than shimming them (greenfield, one consumer,
upgraded in lockstep; shipped as `feat:` on the 1.x line, no majors). Why it looks like this: the
pre-rebuild two-tier layer's static margins, opt-in cursor sharing and two responsive paths —
`docs/archive/STATUS-HISTORY.md`.

## The shape

```
CartesianChart            ← the missing rung: owns margin, scales, axes, grid, cursor, tooltip
  └─ ChartFrame           ← measures the box, reserves the legend band, owns legend state
       └─ ChartLegend
  └─ children(ctx)        ← the kind (or a bespoke chart) draws ONLY marks
```

A kind becomes a mark renderer plus its own domain logic. Nothing else.

**Five exceptions, by shape:** `DualPanel` (two line/bar panes over one x scale), the
non-cartesian `Heatmap`/`Donut`, and the two band kinds `BandStrip` (no y dimension) /
`MirroredBars` (two bar panes, two domains) compose `ChartFrame` + `useChartCursor` + `autoMargin`
directly rather than `CartesianChart`, whose contract is a single plot rect with one or two numeric
y axes. They share the same cursor, tooltip and margin machinery — just not the single-plot
assembly. Three of the five carry a `theme-allow-file hand-rolled-plot` declaration — `DualPanel`,
`BandStrip`, `MirroredBars`. `Donut` and `Heatmap` render no assembly primitive at all, so the rule
never fires on them and there is nothing to waive.

`DualPanel`'s top pane honors `ChartSeries.getMarker`, same as `CartesianChart` — `getMarker`
returns `{ color?, r?, fillOpacity?, ring? }`: `ring` defaults `true` (today's punched-out stroke, unchanged), `ring:
false` omits the stroke entirely, `fillOpacity` defaults `1`. The widened shape exists because a
consumer's plain `fillOpacity: 0.7` dots were unreproducible when they moved their chart onto the
kind — the old `{ color?, r? }` had no seam for opacity or a strokeless marker. `DualPanel`'s
bottom pane's tooltip row is `formatBar` (separate from `formatBottom`'s tick labels), and the
pane's own domain is configurable via `bottomYDomain`/`bottomMaxAbsFloor`.

`MirroredBars` (shipped 2026-08-22) is a sibling kind to `DualPanel`, not an extension of it —
`DualPanel`'s bottom pane is one signed magnitude over a symmetric domain, not two independent bar
panes. Why this wasn't obvious sooner (a decision recorded against the wrong blocker): see
`docs/archive/STATUS-HISTORY.md`.

## The contract, in force today

Every non-sparkline single-plot cartesian chart **MUST** compose `CartesianChart`. It owns the
measured margins, both y scales and their domains, the axes, the grid, the shared cursor, the
crosshair + dots, the hover/keyboard overlay, and the derived tooltip; the caller supplies `series`
and draws only marks. A non-single-plot shape — multi-pane (`DualPanel`, `MirroredBars`), radial
(`Donut`), matrix (`Heatmap`), or the y-less `BandStrip` — composes `ChartFrame` +
`useChartCursor` + `autoMargin` + `ChartTooltipFloat` directly instead, and declares that with a
`theme-allow-file hand-rolled-plot — <why>` comment wherever it renders an assembly primitive (see
"Mechanical enforcement" below).

**Accessibility fix (2026-08-19):** `ChartFrame`'s outer container carries `role="group"`, never
`role="img"`, when `ariaLabel` is set. Per the ARIA spec every descendant of a `role="img"` element
is presentational, which erased the hover overlay's `role="slider"` — the entire keyboard-scrubbing
story this layer ships — from the accessibility tree: the label announced, the control was
unreachable, silently, with no error anywhere. `role="group"` announces the same label while
keeping descendants exposed. jsdom does not implement ARIA's presentational-descendant pruning, so
no `getByRole` test could ever have caught the regression — this is a structural rule, not a
test-covered one. Do not "simplify" `ChartFrame`'s container role back to `img`.

## Mechanical enforcement (oxlint)

Two `basalt` oxlint plugin rules make the contract above a build failure, not just a convention:
`basalt/hand-rolled-plot` (a chart-assembly primitive rendered outside `CartesianChart`; escape via
`theme-allow`/`theme-allow-file hand-rolled-plot — <why>`, the declared route for the three
non-single-plot shapes) and `basalt/chart-legend-literal` (a hand-written array literal passed to
`ChartLegend`'s `items` instead of a `series`-derived one). Full AST pattern and rationale: each
rule's own JSDoc in `packages/basalt-ui/configs/oxlint-plugin.js` — that is the home, not restated
here. Grace/promotion mechanics: `packages/basalt-ui/CLAUDE.md` § grace period.

## 1. Auto-measured margins

`measureText` (`utils/measure-text.ts`) — canvas 2D `measureText`, memoized per `font|text`, with a
deterministic `0.6em`-per-char fallback when there is no DOM (SSR, `renderToStaticMarkup` tests).
No layout thrash: the canvas is offscreen and never attached.

`autoMargin` (`layout/auto-margin.ts`) resolves the plot rect from the labels that will actually be
painted:

| Side              | Law                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `left`            | `max(VX.margin.left, widest left tick label + TICK_GAP)`                                                                                                        |
| `left`, no y axis | `autoMargin` stops at `VX.margin.left`; `useBandPlot` then raises it to `max(that, ½ widest x label)` — a BAND axis puts its first tick on the plot's left edge |
| `right`           | right axis present → `max(VX.margin.right, widest right tick label + TICK_GAP)`; else `max(VX.margin.right, ½ widest x label)` so the final x tick cannot clip  |
| `bottom`          | `max(VX.margin.bottom, x label height + TICK_GAP)`, plus rotation bound when rotated                                                                            |
| `top`             | `VX.margin.top` (unchanged — nothing measures into it)                                                                                                          |

The **no-left-axis row is `BandStrip`'s whole shape** and did not exist before the band kinds. It
comes with a cap, also band-plot-only: a gutter that exists solely to keep a TERMINAL label from
clipping is capped at `max(VX.margin.<side>, 14% of width)` on the left and `12%` on the right.
Uncapped, half a `DD.MM HH:MM` label is 48px of a 338px chart — the label wins and the plot loses.
`MirroredBars` probes real tick labels from both panes, so it takes the plain measured `left` and
neither the floor nor the cap applies to it.

`VX.margin` becomes a **floor**, never a ceiling. An explicit `margin` prop still wins last, so the
escape hatch survives; `chartMargin()` stays for charts outside `CartesianChart`.

**X tick spacing measures the label it paints, not a constant.** `smartTicks(dates, xMax, labelPx?)`
takes the width one formatted x label actually needs (`maxTextWidth` on the formatted set, plus an
8px neighbour gap) and uses it as the per-tick floor whenever it exceeds `VX.minPxPerTick` — before
this, tick spacing came from `VX.minPxPerTick` alone regardless of what `formatX` painted, so a
formatter returning `Mar 08 14:00` overlapped at every width. `CartesianChart` measures this itself
(`xLabelPx`, from the same `xLabels` it already builds for the bottom margin); `useBandPlot` and
`DualPanel` compute the equivalent from their own formatted label set and thread it into their own
`smartTicks` call the same way. Omitting `labelPx` (or passing `undefined`) falls back to the old
constant-only behavior — this is what `xLabelRotate` does, since a rotated label no longer competes
for HORIZONTAL room with its neighbour.

**`xLabelRotate?: 0 | 45 | 90`** tilts the x tick labels counter-clockwise, anchored at their right
edge, and deepens the bottom gutter by the rotated label's projected height instead of its width
(`autoMargin`'s `rotate` input) — the same measured-not-assumed law, applied to the rotation case.
Reach for it on a phone-width chart whose `formatX` is unavoidably wide (a timestamp with a time
component, a long category name): rotating trades horizontal crowding for vertical gutter depth,
which is normally the cheaper axis to spend on a narrow viewport. `Bars`, `MultiLine`, `StackedArea`
and `ZonedLine` all forward it to `CartesianChart` the same way they already forward `formatX`.
**Left UNSET it is now the phone tier's default** (§8), and **`0` is the opt-out**.

**A rotated label also reaches into the LEFT gutter, and that half was missing.** The label is
anchored at its right edge and tilts counter-clockwise, so it runs down-AND-LEFT from its tick —
and the first tick sits at the plot's left edge. `autoMargin` therefore clears its leftward reach on
that side too: 0.71× the label at 45°, and exactly zero at 90°, where the string runs straight down
and costs no horizontal room. Before this, `/charts-stress` block (f2) rendered `Mar 01 14:00` as
`ar 01 14:00` — the bottom gutter grew for rotation and the left one did not. An explicit `margin`
override still wins last.

**Measured equals painted means measuring the label the axis PAINTS — offset and glyphs included.**
`width × cos θ` was not that. The axis nudges every rotated label by a `dx`/`dy` (`−6/+2` at 45°,
`−4/+4` at 90°) and hangs it from a baseline `tickLength + max(10, fontPx)` below the axis line,
and the glyphs reach back over that anchor by their ascent and below it by their descent. The
measure counted none of it, so the first label crossed the SVG's left edge by 3.2px at 390 and
5.7px at 320, and every rotated label's box bottom landed EXACTLY on the SVG's own height — a
descender row sitting on the clip. `rotatedLabelExtents` (`layout/auto-margin.ts`) resolves both
sides from that anchor instead:

| Side     | Rotated law                                                               |
| -------- | ------------------------------------------------------------------------- |
| `left`   | `cos θ · (widest x label + ascent) − dx + 2`                              |
| `bottom` | `tickLength + max(10, fontPx) + dy + sin θ · width + cos θ · descent + 2` |

The `dx`/`dy` pair is exported as `ROTATED_LABEL_OFFSET` and **imported by `primitives/Axes.tsx`**,
never re-declared there — a second copy is precisely how the paint and the measure came apart. The
1.35em line box is split 1.05em ascent / 0.30em descent, so nothing moves for an unrotated axis, and
the trailing 2px is clearance: a box touching the clip line reads as clipped.

**Rotation is a trade, so it is checked before it is taken.** `autoXLabelRotate` used to fire
whenever fewer than three labels fit horizontally, without asking whether the rotated layout fit
either — and rotating BUYS bottom-gutter depth by SPENDING plot width on that deeper left gutter.
At block (f1) the deal went negative: three clean horizontal labels at 390, and at 320 a rotation
that reached off the left edge and bought nothing for it. `CartesianChart` now resolves BOTH
margins (`autoMargin()` and `autoMargin({ rotate: 45 })`) before deciding and hands the rotated
plot width to `autoXLabelRotate`, which takes the rotation only when the rotated axis paints MORE
labels than the flat one at its projected pitch (`labelPx · cos 45°`), and at least two of them.
Otherwise the axis stays flat and `smartTicks` thins further — two readable horizontal labels beat
two tilted ones in a narrower plot. An explicit `xLabelRotate` skips the check outright.

**A kind that paints its own labels is not exempt from any of this.** `Heatmap` renders its row and
column categories as plain `<text>` rather than through the `Axis*` primitives, and was therefore
the one kind still printing every label: 12 columns at 390px, ten adjacent overlaps, `19:00` past
the SVG's right edge. It now runs the same law through `thinLabels(labels, bandPx, labelPx)` — one
label every `ceil(labelPx / bandPx)` bands, first and last always kept, and the grid label before a
colliding final one dropped rather than printed underneath, exactly as `smartTicks` does with its
appended tick. Columns thin by the widest measured label, rows by the line box whenever the row
band is shorter than it, and the right gutter reserves half the widest column label for the same
reason the `right` row of the table above does.

**The appended final x tick no longer prints on top of its neighbour.** `smartTicks` appends the
last key unconditionally (below), which lands it a PARTIAL step from the last tick on the grid — so
at wide-enough labels the pair overlaps at every tick count and every width, not at an unlucky one
(measured at 1440px on `/charts-stress` block (f1)). When that gap is narrower than one label,
the grid tick before it is dropped instead. Index 0 is never the one dropped: the left edge is the
label a reader orients from. `smartTicksEvery` takes an exact count and no width, so it cannot
measure this and is unchanged.

## 2. `CartesianChart`

One primitive, config-driven, render-prop only for the marks.

```tsx
<CartesianChart
  data={data} chartId="sessions" getX={(d) => d.date} series={SERIES}
  y={{ domain: 'auto', format: fmtInt }}
  y2={{ domain: 'auto', format: (v) => `$${v.toFixed(1)}k` }}
  height={260}
>
  {({ xScale, yScale, y2Scale, xMax, visible }) => /* marks only */}
</CartesianChart>
```

It renders, in order: measuring frame → derived legend → `<svg>` → `<Group>` → grid → zones/x-zones
→ **marks** → reference lines → crosshair + synced dots → axes → hover overlay → tooltip. The
caller supplies the marks; every other layer is default-on and identical across charts. That
identity IS the consistency guarantee.

An x-zone (`XZoneSpec`, drawn by `XZoneRects`) bounds default `align: 'center'` — a present `from`/
`to` resolves to the point's own center. `align: 'edge'` widens by half a step at each present
bound instead (clamped into the plot range at the first/last sample), so a band covers both
terminal slots in full and `from === to` renders one step wide rather than being skipped as
degenerate.

`AxisConfig` (`y`, `y2`) collapses the previous prop soup (`yDomain` / `yAutoMaxFloor` / `yAutoMinCeil` /
`yAutoPad` / `numTicksY` / `formatYTick`) into one object per axis. Passing `y2` is what turns on
the right axis — the widened margin follows from measurement, not from a `rightAxis` flag.
`AxisConfig.nice?: boolean` (default `false`) opts into d3's `scale.nice()` rounding — off by
default because flipping it would move the domain of every already-migrated chart.

**Log axis.** `y.scale: 'log'` (and `y2`) builds a `scaleLog`; the domain floor is the smallest
positive visible value (`autoMinCeil` is ignored, a log axis has no zero), `nice` snaps to decade
bounds, and ticks are the 1-2-5 mantissa set from `charts/layout/log-ticks.ts` — the SAME helper
`probeAxisLabels` measures from, so §1's measured-equals-painted law holds on a log axis too.
`format` receives real values; a consumer never expresses a log scale in the data any more (the
CBBI page did, and paid for it with `$31,623` gridlines).

`scale` is honoured by every kind whose axis domain the CALLER controls — `CartesianChart`'s own
axes, `MultiLine`, `ZonedLine`, and `Bars` in `barLayout: 'grouped'`. `Bars` in the default
`barLayout: 'stacked'` computes its own summed domain from `0` (§2's stacked-domain memo) — a
stacked total has a real zero baseline, and a log axis has none, so `barLayout: 'stacked'` with
`y.scale: 'log'` throws in dev (`isDev()`, the house gate — see `BandStrip`'s own throw for the
same pattern) rather than silently rendering a broken stack; use `barLayout: 'grouped'` for a log
axis instead.

**Null is an absence, not a zero — and it is contagious across a stack.** `ChartSeries.getValue`
documents `null` as a measurement GAP, never a zero: every line-shaped kind (`MultiLine`,
`ZonedLine`, the line overlays in `Bars`) BREAKS at a null point instead of interpolating across
it, via a `defined` guard on the underlying `@visx/shape` primitive (`LinePath`/`AreaClosed`/
`Threshold`) rather than dropping the row — dropping it would let the shape draw straight through
the hole, which is a measurement that was never taken. `StackedArea` extends the same rule to the
whole stack: a row where ANY visible band is `null` has no cumulative total, so every band gaps
there together (`rowIsDense`) — legend-toggling the sparse band off closes the gap, because density
is measured against the visible set only. A `defined` guard combines both absences in one
expression on a log axis, since a non-positive value has no logarithm either:
`d.__y !== null && Number.isFinite(scale(d.__y))` — `scale(0)`/`scale(negative)` on a `scaleLog`
resolves to `NaN`, which reads exactly like the null case and gets the same treatment: a gap, never
a value silently clamped to the axis floor.

**Behavior change (2026-08-19) — the one item here that can move an existing chart's rendering:**
`autoMaxFloor` now clamps the raw upper bound BEFORE padding, mirroring `autoMinCeil`, which has
always clamped its bound first and padded second — two different laws used to live in one function.
`resolveAxisDomain` previously padded the raw max first and applied the floor last, so when the
floor won it landed exactly on the axis top with zero headroom: a target line sitting at precisely
the floor value was glued to the plot edge. Measured case: dataMax 3.2, pad 1.1, floor 6 → axis top
was 6.0, is now 6.6. A consumer relying on the old ordering will see their axis top move; lower the
floor or pin `domain` explicitly to opt back out.

`formatX?: (key) => string` (default `fmtAxisDate`, `DD.MM`) used to be `CartesianChart`-only —
every cartesian kind (`Bars`/`MultiLine`/`StackedArea`/`ZonedLine`/`DualPanel`) now forwards its
own. Without it, the only route to a custom x label was pre-formatting it into the domain key
itself, making one string serve as display value, scale identity, AND cursor key simultaneously —
a truncating formatter then collapses two points onto one domain value, silently dropping one from
the plot. `Heatmap` is deliberately excluded: its existing `colLabel`/`rowLabel` already are that
seam, and a second prop over one concern would fork them.

`xTickValues?: (keys: readonly string[], xMax: number) => readonly string[]` picks the x ticks
outright, resolving AHEAD of `xTicks`. Order: explicit VALUES → explicit COUNT → as many as fit
(`smartTicks`). `xTicks` is unchanged and still works; omit both and nothing moves. Forwarded by
`Bars`, `MultiLine`, `StackedArea`, `ZonedLine` and both band kinds — the band kinds never had
`xTicks`, so for them it is values-or-`smartTicks`.

**A count cannot express a legible dense time axis.** `smartTicks`/`smartTicksEvery` append the
final key unconditionally, so a count that does not land exactly on the last index paints two
labels on top of each other at the right edge — at every count, not at an unlucky one. Measured on
the consumer that reported it: linewatch's `lib/axis.ts` goes 200 → 160 lines. It shrinks, it does
not die; the surviving 160 are domain formatters basalt has no business owning.

`xLabelRotate?: 0 | 45 | 90` is the phone answer to a `formatX` too wide to keep spacing ticks
horizontally — see §1 for the mechanics and the measured-gutter law it follows.

**`SeriesStyle.curve?: 'monotone' | 'linear' | 'step' | 'stepAfter' | 'stepBefore'`** picks the
interpolation between two plotted points. Default `'monotone'` — today's behaviour everywhere, so an
omitted `curve` moves nothing. Honoured by `MultiLine` (per series), `ZonedLine` (the primary series'
curve governs its line, its area fill AND its threshold bands — they are one measurement drawn three
ways), `StackedArea` (ONE curve for the whole stack, taken from the first visible series that
declares one: the bands share their boundaries, so two curves would leave gaps between them) and the
`Bars` line overlays (`BarsLine.curve`). Reach for a step curve when the quantity is
piecewise-constant — a price tier, a config value, a discrete state — because a smoothed curve
through those draws intermediate values that never existed. `curveFor` is exported for a
hand-composed plot drawing its own `LinePath` from the same `series` array.

`PlotContext` handed to `children`: `{ data, visible, hidden, xScale, yScale, y2Scale, xMax, yMax,
margin, cursorPoint, highlighted }`. Draw `visible` — never the `series` prop — so a legend toggle
actually removes the mark.

### The x axis is CATEGORICAL — a documented constraint, not an oversight

`CartesianChart` builds its x scale as `scalePoint<string>({ domain: keys })`, and every kind
composes it. **N points are N evenly spaced positions, whatever the values behind the keys.** There
is no linear or time x scale, opt-in or otherwise.

This is invisible and correct for a domain that is already a regular grid — 288 five-minute buckets
are evenly spaced because they ARE evenly spaced. It is wrong the moment a series is event-shaped:
speed-test runs, deploys, sessions, anything that happens when it happens. Two consequences, both
silent:

- **Geometry lies about spacing.** Event points draw at equal intervals, so on a page sharing one
  cursor the crosshair lands on the correct point at a different screen x than a regularly-sampled
  sibling. The correlation stays legible in the numbers and not in the geometry.
- **A repeated key drops a point.** The domain value must be unique, so two events at the same
  instant collapse onto one position and one stops being drawn. On a proportional axis they would
  simply overplot.

It is written down here because it is not inferable from the API: `getX` returning a date string
reads like a time axis and is not one. A chart whose x is a measured quantity (a distance, an
azimuth, an instant that must be positioned proportionally) currently cannot use `CartesianChart`
at all and must take a `basalt/hand-rolled-plot` exemption — which is worth noting is a DIFFERENT
kind of exemption from the sanctioned ones: `DualPanel` (two panes) and `Heatmap` (a matrix) are
exempt by SHAPE, whereas this one is a single cartesian plot with one y axis that is excluded only
by scale type. An escape hatch absorbing that is a sign the primitive's scope is drawn slightly
wrong, and it is tracked as issue #52 rather than resolved here: the change reaches the cursor's
`xScale` inversion, `XZoneRects` (whose bounds are domain KEYS today), the bar kinds' band width and
`smartTicks`, so it is a design pass, not a prop.

## 3. Cursor: shared by default

The cursor moves from a React context that must be mounted to a **module-level external store**
read via `useSyncExternalStore`:

- **No provider needed.** Every chart on the page shares a cursor out of the box. Charts whose
  domains do not overlap simply never resolve a foreign key, so nothing paints — false sync is not
  possible, and the common case (charts over one calendar) works with zero wiring.
- `<ChartCursorScope>` **isolates** a subtree instead of enabling sharing. Inverted from the
  previous layer's `ChartHoverSync`, which is deleted.
- `useSyncExternalStore` over context: a cursor move re-renders only subscribed charts, not the
  whole provider subtree.

**The failure direction is inverted, deliberately.** The previous layer failed closed — forget
`ChartHoverSync` and you simply got no sharing. This layer fails open — two unrelated chart trees
on one page share a cursor unless someone reaches for `ChartCursorScope`. That is the intended
trade (always-shared tooltips were the point), and domain-aware resolution bounds the blast radius
to charts whose domains actually overlap; but it is the one thing to remember when two independent
features first land on the same page.

**Resolution is domain-aware, not string-equal.** A broadcast key resolves against a chart's own
points by, in order: exact match → parsed-numeric/date nearest within the chart's own step →
`null`. The folded-domain desync and the `resolveKey` escape hatch both disappear.

`CursorResolution = 'nearest' | 'leading'` (exported from `basalt-ui/charts`) picks WHICH of those
own points a broadcast key resolves to, reachable as `cursorResolution` on `CartesianChart`/every
cartesian kind/`DualPanel` and as `useChartCursor`'s `resolution` option. Default `'nearest'`
(unchanged) treats every own key as a POINT. `'leading'` treats every own key as the LEADING EDGE of
a bucket `[key, nextKey)` instead — reach for it when `getX` returns a bucket start (a weekly series
keyed by its Monday, a monthly series keyed by its 1st): under `'nearest'`, a hover landing in the
back half of a bucket resolves to the FOLLOWING bucket rather than the one it's actually inside, so
the shared crosshair sits one column right of the data being pointed at, reproducibly for every
back-half hover. The modes also bound differently at the domain edges: `'nearest'` tolerates one
step past each end, `'leading'` bounds strictly to `[first, last + step)` — outside it no bucket
CONTAINS the key, so answering at all would be a crosshair on a bucket that provably excludes it.

## 4. Tooltip

- **Derived, never assembled.** `CartesianChart` builds rows from `series` + the hovered datum via
  `deriveTooltipRows`. A chart cannot show a row it does not draw. `tooltip.extraRows` /
  `tooltip.label` stay as additive hooks. `prependRows`/`extraRows` also receive
  `(d, { visible, hidden })` — the same sets the plot itself draws from — so a hand-authored row
  tracks legend toggling instead of desyncing from it.
- A bar series can opt into "drawn and legended, never a tooltip row" via `BarsBar.tooltip: false`
  / `BarsLine.tooltip: false`, the same escape `SeriesStyle.tooltip` gives every other kind.
- **rAF-coalesced position.** Pointer moves write through a frame scheduler instead of a
  `setState` per event.
- **Anchorable.** `tooltip.follow` defaults to true (the tooltip tracks the pointer, as before).
  `follow: false` anchors it to the crosshair at the plot's top edge instead, so a column of charts
  sharing one cursor lines every tooltip up on the same x. Following is the default because
  anchoring costs a `getBoundingClientRect` per hovered frame. Viewport collision handling (flip +
  clamp, measure-before-show) is handled once in `ChartTooltipFloat` for both modes.
- **Keyboard.** The hover overlay is focusable; ←/→ scrub the cursor, Escape clears it. The tooltip
  is `aria-live="polite"`.
- **It renders nothing on the server.** `ChartTooltipFloat` was the ONE `renderToString` casualty in
  the whole package (`isomorphic-findings.md` F-SSR-1): `createPortal` throws outright in
  `react-dom/server`. The guard is a `useSyncExternalStore` server snapshot, not a `typeof document`
  check and not a `useEffect`-set flag — under a DOM-preloaded test runner `document` exists while
  `renderToString` still refuses portals, and an effect-set flag would cost a frame on the client,
  which on a hover that has already happened is a visible blink. The server snapshot is `false` and
  the client's FIRST render is already `true`, so nothing moves in the browser. The ledger entry in
  `tests/isomorphic/props.tsx` is now empty, and the test asserts that in both directions.
- **`formatHeader?: (key, d) => string`** on `tooltip` (also `TooltipHeader`'s own `format` prop,
  and the identical seam on `DualPanel`'s `tooltipLabel` sibling `formatHeader`, so the two stay in
  sync). Default: `fmtTooltipDate`, unchanged. The seam exists because `fmtTooltipDate` regexes
  `YYYY-MM-DD` out of the domain key and builds a LOCAL `Date` from it — a UTC ISO key then names a
  different day than `formatX`, the tooltip badge, and every sibling chart, all of which resolve
  locally; the only prior workaround was carrying a local-offset ISO key.

## 5. Legend

- The measured-band reservation from the previous layer stays (it was already right).
- **Interactive by default at ≥2 entries**: click toggles a series. A single-entry legend stays
  static — hiding the only series a chart draws is never useful. `legend={{ toggle: false }}` opts
  out explicitly. Hidden keys live in `ChartFrame` state and reach the marks through
  `PlotContext.visible` / `.hidden`, so hiding a series removes it from the plot, the tooltip, and
  the auto y-domain together.
- Hover-dim stays; `legend={false}` remains the sparkline escape.
- **Automatic single-series suppression**: a kind that threads its series count into
  `resolveLegend(config, hover, seriesCount)` (`ChartFrame.tsx`) drops the legend with no consumer
  opt-out when `seriesCount <= 1` AND `legend` was left `undefined` — an explicit `legend={{}}` (or
  any other config) still opts back in, and `config === false` still wins outright. A single-entry
  legend only restates the chart's own title and costs a row for a toggle that can blank the whole
  plot. A kind wired through `CartesianChart` gets this for free; one composing `ChartFrame`
  directly without threading `seriesCount` (`DualPanel`) keeps its prior always-shown behaviour.

## 6. One responsive path

`ResponsiveChart` is deleted. `ChartFrame` is the only measurer; `Heatmap` composes it like every
other kind. `fill` / `aspectRatio` / fixed `height` are the three sizing modes, resolved in that
order.

**Width tracks the container once measured, floored at 1px only.** `minWidth` (default 200) is a
first-frame guard for the unmeasured case (SSR, or before the observer's first callback) — once
`containerW` is real, the plot's width follows it exactly rather than staying floored at
`minWidth` forever, which used to draw an SVG wider than its own narrower grid cell
(`resolvePlotRect`, `ChartFrame.tsx`).

**The plot never collapses under a wrapping legend, floored at `VX.minPlotHeight`.** A legend band
that wraps to more rows than expected (eight entries at phone width) used to eat a fixed
`height={240}` toward zero, and the plot stopped rendering. Two different fixes for the two sizing
modes that can hit this: a fixed-height frame is a flex column with `height: auto`, so it simply
grows by whatever the legend needed — `VX.minPlotHeight` is the floor the plot itself never goes
below, and the frame's own box absorbs the difference. A `fill` frame is pinned to its cell and
cannot grow, so instead its legend rolls up: `legendEntryCap` measures how many entries actually
fit in the rows left over once `VX.minPlotHeight` is reserved (a real greedy-wrap measurement
against the legend's own labels, not an assumed one-entry-per-row count) and feeds that as
`ChartLegend`'s `maxRows` cap, unless the caller already passed an explicit `legend.maxRows` — an
explicit cap always wins as the upper bound.

## 7. Band plots — `BandStrip` and `MirroredBars`

Two shapes `CartesianChart` structurally cannot host. It renders `AxisLeftNumeric` unconditionally
and builds x as `scalePoint` — positions, no widths. A strip has no y dimension to axis; a mirrored
pair has two, and needs band widths.

- **`BandStrip<T>`** — one rect per slot over a shared x axis, no y dimension at all. Props:
  `data · chartId · getX · series: BandStripSeries<T>[] · getBand: (d) => BandSpan · height ·
fill · formatX · xTickValues · fold · cursorResolution · tooltip · legend · absentState ·
margin · ariaLabel · isPending`. `BandSpan = { state, fill?, absentFraction?, marker? }` — the three
  qualifications a state strip cannot do without: an intensity ramp inside one state (`fill`), the
  share of a folded slot nothing measured (`absentFraction`, drawn hatched), and a fact that must
  not be readable off the ramp (`marker`). `series` IS the state set: it drives the legend, each
  band's fill and the one derived tooltip row, so a strip cannot name a state it does not draw.
  `cursorResolution` defaults `'leading'` here, not `'nearest'` — a band IS a bucket.
- **`MirroredBars<T>`** — two bar panes over one x scale, mirrored around one baseline, each in its
  own domain. `up`/`down` are `MirroredBarPane = { key, max?: number | 'auto', autoMaxFloor?,
ticks?, format }` (`format` required, `ticks` default 3). Plus `upFraction` (default 0.35 — the
  up pane's share of the band height, which is where the shared baseline sits), `getAbsentFraction`
  and `getBarOpacity`.

Shared machinery lives in `hooks/useBandPlot.ts` — width-driven folding with a consumer merge, the
measured gutters, the band scale and its half-bandwidth cursor correction, and the source/follower
tooltip anchor arithmetic. The hook itself is **not exported**; what ships on `basalt-ui/charts` is
`foldBands` (so a consumer can test their merge against the grouping that will actually run), the
`BandFold` / `BandTooltipConfig` / `BandTooltipRowContext` types, and
`HatchPattern` / `hatchFill` / `hatchSizeFor` for the absence fill.

**Proven by porting, not by review**: built against linewatch's real charts (1884 → 957 lines
across three files, all 11 `hand-rolled-plot` waivers retired, two live NaN-rendering bugs caught).
Full evidence: `docs/archive/STATUS-HISTORY.md`. **The doctrine this proved: a new kind is proven
by porting a real consumer's call sites and reporting what it could NOT express** — a demo page
proves nothing.

### What the two kinds still cannot express

- **No `bandHeight` prop** — band height is derived and floored by `VX.margin`.
- **`getBand`/`getAbsentFraction` never see the fold's bookkeeping** — the consumer carries fold
  counts itself.
- **`BandStrip` derives exactly one tooltip row** — more stays hand-authored in `tooltip.extraRows`.

## 8. The phone tier — measured, never a media query

`src/charts/**` had no breakpoint literal anywhere in it: legend font, tick font, `VX.margin`,
`dotR` and the tooltip's `minWidth: 140` were identical at 1920px and at 320px (audit-c #12). It now
resolves **two tiers**, and it resolves them from the width `ChartFrame` already MEASURES.

A viewport breakpoint would answer the wrong question. A chart in a two-column grid cell on a 1440px
desktop is exactly as narrow as one filling a phone, and `@media` cannot see that; the
`ResizeObserver` can. It also keeps the layer Mantine-free — `theme.breakpoints` is on the coupled
side of the boundary.

- **`resolveChartTier(containerW)`** (`primitives/chart-frame-layout.ts`) returns `'phone'` below
  `VX.phoneChartWidth` (480) and `'desktop'` otherwise. An UNMEASURED box (`containerW <= 0` — SSR,
  or before the observer's first callback) is `'desktop'`: the first frame must not paint phone
  chrome it then undoes one frame later.
- **`ChartFrame` publishes it once**, through `ChartTierProvider`; the axes, the legend, the
  crosshair dots and the tooltip read it back with `useChartTierMetrics()`. Outside a `ChartFrame`
  the default is `'desktop'`, so a hand-composed plot keeps today's sizes.
- **`chartTierMetrics(tier)`** is the whole size set, in one frozen object per tier, so a new
  tier-sensitive size is added in one place and read by name rather than branched on at each site.

| Metric             | desktop                         | phone              |
| ------------------ | ------------------------------- | ------------------ |
| axis tick font     | `VX.axisFont` (`TEXT.micro`)    | `TEXT.nano`        |
| legend font        | `VX.legendFontSize` (`TEXT.sm`) | `TEXT.xs`          |
| crosshair `dotR`   | `VX.dotR`                       | one step in        |
| tooltip `minWidth` | 140                             | 110                |
| legend entry cap   | none                            | 2, then `+N more`  |
| margin FLOORS      | `VX.margin`                     | `VX.margin × 0.75` |

Two consequences worth stating, because both are places the tier could otherwise lie:

- **The tick font is threaded into the MEASUREMENT, not just the paint.** `autoMargin` takes the
  tier's `fontPx` and its tightened `floor`, and `xLabelPxFor` measures at the same size — §1's
  measured-equals-painted law holds per tier or it holds nowhere. The margin floors only ever
  tighten; the measured law above them is untouched. That includes `useBandPlot`, which measures the
  gutters for `BandStrip` and `MirroredBars`: those kinds paint through the same `AxisBottomDate`,
  so a hook that measured at the desktop font while the axis painted the phone one would break the
  law in the one place no `CartesianChart` call site could catch it. `Heatmap` reads the tier for
  its own row/column labels and gradient endpoints for the same reason, though it measures nothing.
- **`xLabelRotate` left unset auto-rotates to 45 at the phone tier** when the measured labels cannot
  fit three ticks side by side (`autoXLabelRotate`). Two ticks is a labelled left edge, a labelled
  right edge and nothing to read between them. Desktop never auto-rotates: rotating spends
  bottom-gutter depth, which is the cheap axis on a phone and the expensive one on a screen that had
  horizontal room all along. **`xLabelRotate: 0` is the opt-out.** And wanting to rotate is not the
  same as rotating fitting: the rotated margin is resolved too, and the rotation is refused unless
  it paints more labels than the flat axis would (§1 — block (f1) at 320 auto-rotated itself into a
  clip it did not have at 390).
- **The phone legend's `+N more` is a DISCLOSURE, not a caption.** A cap of two left six of eight
  plotted colours unnamed behind a `<span>`, which is a categorical encoding the chart draws and
  then refuses to decode — on the one viewport where there is no hover to fall back on. The chip is
  a `<button aria-expanded>`; expanded, every entry renders, the legend band grows, and
  `ChartFrame`'s observer re-flows the frame around it. The plot keeps `VX.minPlotHeight` either
  way — under `fill`, where the box cannot grow, that is what `legendEntryCap` is for.

## 9. Number formats, and the three "nothing to draw" states

`utils/format.ts` ships numbers, not only dates: `fmtCompact` (`1.2k`), `fmtPercent`
(`{ input: 'ratio' | 'percent' }`, declared not guessed), `fmtCurrency`, `fmtInt` — all
`Intl.NumberFormat`, explicit `locale` (tests pin `en-US`). **Every formatter returns `NON_FINITE`**
(an em dash) for `NaN`/`±Infinity`/`Invalid Date` — one law across the module, because
`Intl.NumberFormat` otherwise renders `NaN` as the literal string `NaN`. Guard is on
non-finiteness, never falsiness — a finite `0` formats normally.

`CartesianChart`/`ChartFrame` (and every kind) take `state?: { pending?, error?, empty? }`,
resolved by `resolveChartState`. **Precedence is fixed: pending → error → empty** — a refetch over
a stale error is pending, not failed. All three suppress the legend; only `pending` sets
`aria-busy`. `isPending` remains a working alias, not going away. `ChartError` is `role="alert"`;
`ChartPending`/`ChartEmpty` are `role="status"` (polite) — only the failure interrupts a screen
reader.

## 10. Shared component props

Every exported chart component takes **`BasaltProps`** (`className`/`style`, merged onto its ROOT
— never replacing the component's own). `ChartCard` additionally publishes
`SlotStylesProps<'root' | 'header' | 'body'>`. Every `memo(...)`-wrapped kind carries a
**`displayName`**; every kind opens with `assertRequiredProps('<Kind>', props, [...])`, so a
missing accessor throws a named error instead of an opaque visx crash `BasaltErrorBoundary`
swallows into a blank subtree.

## Invariants (unchanged)

- Mantine-free: `charts/**` and `tokens/**` import no `@mantine/*`; `@visx/*` only inside
  `charts/**`. `./charts` and `./tokens` still resolve and render with no Mantine installed.
- Color only via `--vx-*` refs (`VX.*` / `alpha()`), never a raw hex.
- `series` remains the single source of truth for mark, legend entry, and tooltip row.
- `SeriesStyle.strokeOpacity` is a MARK property: the plotted stroke and the legend swatch honor
  it (parity with `fillOpacity`); the tooltip-row swatch and the crosshair dot deliberately do
  not — a sub-1 opacity there would read as a rendering bug, not as data.
- `ChartSeries.formatValue` is `(v: number, d: T) => string` — a row can cite the hovered datum
  (e.g. `97.5 kg (92.5 × 3)`), not just the plotted number.
- Chart chrome sizes itself from the MEASURED container, never from a viewport media query (§8), and
  a size that is measured for a margin is measured at the font that gets painted.
