# The chart layer

Ground truth for how charts are built and enforced. visx stays; what basalt puts on top of it is
this document. Composing `CartesianChart` (single-plot) or `ChartFrame` directly (multi-pane /
radial / matrix) is **mandatory**, not an option — see "Migration note" below for the one-time,
dated rebuild this document reflects, and `docs/STATUS.md` § "Chart-layer rebuild — one mandatory
cartesian primitive (2026-08-18)" for the changelog entry.

## Why the layer looks like this

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
layering a compatible shim over them. It shipped as `feat:` on the 1.x line (no majors — see
CLAUDE.md).

## The shape

```
CartesianChart            ← the missing rung: owns margin, scales, axes, grid, cursor, tooltip
  └─ ChartFrame           ← measures the box, reserves the legend band, owns legend state
       └─ ChartLegend
  └─ children(ctx)        ← the kind (or a bespoke chart) draws ONLY marks
```

A kind becomes a mark renderer plus its own domain logic. Nothing else.

**One exception, by shape:** `DualPanel` (two panes over one x scale) and the non-cartesian
`Heatmap`/`Donut` compose `ChartFrame` + `useChartCursor` + `autoMargin` directly rather than
`CartesianChart`, whose contract is a single plot rect with one or two numeric y axes. They share
the same cursor, tooltip and margin machinery — just not the single-plot assembly.

## The contract, in force today

Every non-sparkline single-plot cartesian chart **MUST** compose `CartesianChart`. It owns the
measured margins, both y scales and their domains, the axes, the grid, the shared cursor, the
crosshair + dots, the hover/keyboard overlay, and the derived tooltip; the caller supplies `series`
and draws only marks. A non-single-plot shape — multi-pane (`DualPanel`), radial (`Donut`), matrix
(`Heatmap`) — composes `ChartFrame` + `useChartCursor` + `autoMargin` + `ChartTooltipFloat`
directly instead, and must declare that with a `theme-allow` comment (see "Mechanical enforcement"
below).

## Mechanical enforcement (oxlint)

Two `basalt` oxlint plugin rules (`packages/basalt-ui/configs/oxlint-plugin.js`) make the contract
above a build failure, not just a convention:

- **`basalt/hand-rolled-plot`** — rendering a chart-assembly primitive (`AxisLeftNumeric`,
  `AxisRightNumeric`, `AxisBottomDate`, `HoverOverlay`, `Crosshair`) in a file that does not
  compose `CartesianChart` is a lint failure. Escape: a `theme-allow` comment on the first such
  site — that is how a genuinely non-single-plot shape declares itself (`DualPanel` carries one).
  The file that DEFINES `CartesianChart` is exempt definitionally, not by path.
- **`basalt/chart-legend-literal`** — passing a hand-written array literal to `ChartLegend`'s
  `items` prop is a lint failure; the legend must be derived from the same `series` array the chart
  draws (`deriveLegend`, or just let `ChartFrame`/`CartesianChart` do it), so it cannot go stale and
  keep naming a series the plot no longer draws.

Both ship at `warn` in the consumer preset (`configs/oxlint.json`) for one minor and `error`
repo-local, per the "Shipping a stricter guard — the grace minor" doctrine in
`packages/basalt-ui/CLAUDE.md`. They promote to `error` in the next minor.

## 1. Auto-measured margins

`measureText` (`utils/measure-text.ts`) — canvas 2D `measureText`, memoized per `font|text`, with a
deterministic `0.6em`-per-char fallback when there is no DOM (SSR, `renderToStaticMarkup` tests).
No layout thrash: the canvas is offscreen and never attached.

`autoMargin` (`layout/auto-margin.ts`) resolves the plot rect from the labels that will actually be
painted:

| Side     | Law                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `left`   | `max(VX.margin.left, widest left tick label + TICK_GAP)`                                                                                                     |
| `right`  | right axis present → `max(VX.margin.right, widest right tick label + TICK_GAP)`; else `max(VX.margin.right, ½ last x label)` so the final x tick cannot clip |
| `bottom` | `max(VX.margin.bottom, x label height + TICK_GAP)`, plus rotation bound when rotated                                                                         |
| `top`    | `VX.margin.top` (unchanged — nothing measures into it)                                                                                                       |

`VX.margin` becomes a **floor**, never a ceiling. An explicit `margin` prop still wins last, so the
escape hatch survives; `chartMargin()` stays for charts outside `CartesianChart`.

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

`AxisConfig` (`y`, `y2`) collapses the previous prop soup (`yDomain` / `yAutoMaxFloor` / `yAutoMinCeil` /
`yAutoPad` / `numTicksY` / `formatYTick`) into one object per axis. Passing `y2` is what turns on
the right axis — the widened margin follows from measurement, not from a `rightAxis` flag.

`PlotContext` handed to `children`: `{ data, visible, hidden, xScale, yScale, y2Scale, xMax, yMax,
margin, cursorPoint, highlighted }`. Draw `visible` — never the `series` prop — so a legend toggle
actually removes the mark.

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

## 4. Tooltip

- **Derived, never assembled.** `CartesianChart` builds rows from `series` + the hovered datum via
  `deriveTooltipRows`. A chart cannot show a row it does not draw. `tooltip.extraRows` /
  `tooltip.label` stay as additive hooks.
- **rAF-coalesced position.** Pointer moves write through a frame scheduler instead of a
  `setState` per event.
- **Anchorable.** `tooltip.follow` defaults to true (the tooltip tracks the pointer, as before).
  `follow: false` anchors it to the crosshair at the plot's top edge instead, so a column of charts
  sharing one cursor lines every tooltip up on the same x. Following is the default because
  anchoring costs a `getBoundingClientRect` per hovered frame. Viewport collision handling (flip +
  clamp, measure-before-show) is handled once in `ChartTooltipFloat` for both modes.
- **Keyboard.** The hover overlay is focusable; ←/→ scrub the cursor, Escape clears it. The tooltip
  is `aria-live="polite"`.

## 5. Legend

- The measured-band reservation from the previous layer stays (it was already right).
- **Interactive by default at ≥2 entries**: click toggles a series. A single-entry legend stays
  static — hiding the only series a chart draws is never useful. `legend={{ toggle: false }}` opts
  out explicitly. Hidden keys live in `ChartFrame` state and reach the marks through
  `PlotContext.visible` / `.hidden`, so hiding a series removes it from the plot, the tooltip, and
  the auto y-domain together.
- Hover-dim stays; `legend={false}` remains the sparkline escape.

## 6. One responsive path

`ResponsiveChart` is deleted. `ChartFrame` is the only measurer; `Heatmap` composes it like every
other kind. `fill` / `aspectRatio` / fixed `height` are the three sizing modes, resolved in that
order.

## Invariants (unchanged)

- Mantine-free: `charts/**` and `tokens/**` import no `@mantine/*`; `@visx/*` only inside
  `charts/**`. `./charts` and `./tokens` still resolve and render with no Mantine installed.
- Color only via `--vx-*` refs (`VX.*` / `alpha()`), never a raw hex.
- `series` remains the single source of truth for mark, legend entry, and tooltip row.

## Migration note (one-time, 2026-08-18)

Package-internal plus the playground. argo is the only external consumer and upgrades in lockstep;
its charts move to `CartesianChart` there, not here.

| Removed                                                                                 | Use instead                                                         |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `ResponsiveChart`                                                                       | `ChartFrame` (or `CartesianChart`)                                  |
| `ChartHoverSync` (opt **in** to sharing)                                                | nothing (shared by default); `ChartCursorScope` to opt **out**      |
| `useHoverSync` + `useChartTooltip` in a kind                                            | `CartesianChart`                                                    |
| `yDomain` / `yAutoMaxFloor` / `yAutoMinCeil` / `yAutoPad` / `numTicksY` / `formatYTick` | `y={{ domain, autoMaxFloor, autoMinCeil, autoPad, ticks, format }}` |
| `chartMargin({ rightAxis: true })`                                                      | pass `y2`; margins measure themselves                               |
| `resolveKey`                                                                            | nothing — resolution is domain-aware                                |
