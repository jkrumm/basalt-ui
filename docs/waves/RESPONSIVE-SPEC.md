# Responsive, touch and plot-first law — working spec

Transient working spec for the wave chain in `PLAN.md`. The last wave distills it into its homes
(`DESIGN-CORE.md` §responsive, `CHARTS-SPEC.md`, the shipped `basalt-*` rules) and deletes this file.
Evidence: `.claude/mobile/` (untracked) — `capture-summary.md`, `measurements.json`, `shots/`, and one
`audit-<area>.md` per area (shell, charts-space, charts-touch, dashboard, data, controls,
content-chat, foundations). Every wave reads the audit file for its area before briefing workers.

**Target platforms:** web, installed PWA, and later an Expo shell that hosts basalt screens as DOM
components (weatherorb ADR 0016/0017). basalt-ui stays a web library; it does not grow a React Native
renderer.

**The consumer contract:** the consumer passes data, series and content. The framework decides
layout, legend, axes, height, hit areas, sheet or popover. A consumer cannot hand-roll a breakpoint
(guard-enforced). New props are a last resort. Every new export needs a named consumer (weatherorb or
argo) and fits the budgets (below).

## 1. Three axes, never mixed

| Axis                            | Decides                                                         | Mechanism                                                                                                  | Who may use it                        |
| ------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Size class** (viewport)       | shell chrome only: bottom bar / rail / sidebar, aside docking   | `@media` with `SIZE_CLASSES` literals; JS `useSizeClass()`                                                 | `shell/**`, overlays (sheet vs modal) |
| **Container class** (own width) | every component's internal layout: cards, charts, tables, forms | `@container basalt-card\|basalt-form\|basalt-main\|basalt-grid`; JS `resolveContainerClass(px)`            | every component                       |
| **Pointer tier**                | hit areas, hover affordances, tooltip mode                      | `(pointer: coarse)` / `(hover: none)` via `--vx-hit` and `[data-basalt-hit]`; JS reads `event.pointerType` | CSS only, plus pointer events         |

The old single `sm` breakpoint currently carries all three axes: 25 hard-coded `47.99375em` literals
and about 27 width `@media` rules. The foundations audit has a 39-row migration table; that table is
the worklist.

### Size classes (viewport)

| Class      | Width      | Shell                                                                                     |
| ---------- | ---------- | ----------------------------------------------------------------------------------------- |
| `compact`  | < 840px    | bottom tab bar, no sidebar; aside = bottom sheet                                          |
| `medium`   | 840–1199px | **rail** sidebar (icon-only, expandable as overlay); aside = overlay sheet from the right |
| `expanded` | ≥ 1200px   | full sidebar; aside docks **only while main keeps ≥ 720px**, else it folds                |

- `SIZE_CLASSES` lives in tokens. `theme.breakpoints` is **derived** from it and consumers cannot
  override it.
- A `breakpoint-literals.test.ts` pins every CSS literal to the table.
- Default before the user has chosen anything: persisted state must distinguish _unset_ from
  _explicitly false_. The size-class default applies only while the state is unset.
- `useSizeClass()` uses `useSyncExternalStore` with one MediaQueryList per class. Its server
  snapshot comes from `<BasaltProvider sizeClassHint>` (default `'compact'`).
- `useSizeClass()` replaces `useBreakpoint`, `useMediaQueryMatches` and Mantine `useMediaQuery`
  inside the package. `useBreakpoint` goes on-notice in `MIGRATING.md`.

### Container classes (component width)

| Class     | Width     | Card chrome                                                             | Chart                                                                    |
| --------- | --------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `micro`   | < 240px   | title only; value + delta on one line; subtitle → info glyph; no legend | sparkline-grade: no y axis, 2 x terminals                                |
| `compact` | 240–479px | subtitle folds into info glyph; value + delta inline; tight insets      | y labels inside the plot, compact number format, legend in header (dots) |
| `regular` | 480–799px | standard                                                                | standard; legend chips in header                                         |
| `wide`    | ≥ 800px   | value/delta move onto the title row                                     | end-of-line labels allowed (≤ 3 series)                                  |

- One table (`CONTAINER_CLASSES` in tokens), read by CSS `@container` and by the chart layout
  resolver, so card chrome and plot always agree.
- Replaces the chart "phone tier" (`resolveChartTier` / `ChartTierMetrics`), which today fires on
  desktop 2-column grids.
- Before first measurement (SSR, first paint), components derive the class from the viewport size
  class: a `compact` viewport implies a `compact` container. That removes the first-frame desktop
  flash on phones.

### Pointer tier

- `:root { --vx-hit: 24px }` and `@media (pointer: coarse) { :root { --vx-hit: 44px } }`
  (WCAG 2.5.8 = 24px, 2.5.5 = 44px). This is **density-exempt**.
- One shared `[data-basalt-hit]::after` rule expands the hit area invisibly, without changing
  layout. Every basalt interactive primitive sets the attribute, through theme `defaultProps`
  where possible.
- Collapse `spaceTouchTarget`, `touchControlHeight` and the width-keyed floors (30/36/40/44) into
  `--vx-hit`. Set `mobileNavRowHeight` to 44.
- Hover-revealed affordances (code copy, heading permalinks, row actions) are gated on
  `(hover: hover) and (pointer: fine)`; otherwise they are always visible.

### Host

`BasaltProvider` sets `data-basalt-host="web|pwa|native"` on `<html>`: `pwa` via
`display-mode: standalone`, and the Expo shell can force `native`. Host-specific CSS (safe-area
padding, overscroll, pull-to-refresh suppression) keys on the attribute, not on `display-mode`.

## 2. Shell

- The three size classes above. Today the 768–991px band opens the 256px sidebar and the 300px aside
  together, which leaves a 172px main column and 163px of document overflow (measured). That's a P0.
- PageBar row 1 folds by **measured width** (reuse the `useTrackFits` / FilterSet observer), not by
  a fixed action count. Icon-less secondary actions fold too (first-grapheme fallback).
- `--app-shell-footer-offset` becomes a documented, stable CSS var ("shell bottom inset"). Toasts,
  the chat composer and any bottom-anchored overlay sit above it and above
  `env(safe-area-inset-bottom)`. Toasts overlap the mobile tab bar today (P0).
- Landscape phone (`max-height: 480px` and landscape): the header and bottom bar use their compact row.

## 3. Card chrome

- ChartCard, StatCard, Section and WidgetHeader roots get `container: basalt-card / inline-size`.
  Header rules move from viewport `@media` to `@container` (the container-class table above).
- The KPI value **never ellipsizes** (it's sized with a `cqi` clamp); the delta wraps first. Today at
  a narrow width the value truncates to `$`.
- StatGroup: 1 column below 260px container width.
- ChartCard is a flex column with `body { flex: 1 }`. Inside a card, the chart treats its computed
  height as a **minimum** and grows into stretched grid rows, which removes the dead band.
- ChartCard exposes an internal **legend slot** in its header via context, not an export. The chart
  portals its legend into it, so a card has one chrome band, not two.

## 4. Charts: the plot-first space law

Measured today: the median data rect is 0.44 of the card (tablet 0.33). Chrome tax: axis gutters
0.15–0.47 > header 0.18–0.35 > legend 0.07–0.20 > padding 0.05–0.10. Every layer is sized by a
constant or a consumer literal, never by what the data has left.

**`resolveChartLayout(input): ChartLayout`**: pure, DOM-free, in `charts/primitives/`, and exported
for tests only. It is the single decision point, and every kind consumes its result.

```ts
type ChartLayout = {
  containerClass: 'micro' | 'compact' | 'regular' | 'wide'
  height: number
  legend:
    | { mode: 'none' }
    | { mode: 'dots' | 'chips'; where: 'header' | 'band'; visible: number; overflow: number }
    | { mode: 'side'; width: number }
  yAxis: { mode: 'outside' | 'inside' | 'none'; ticks: number; compact: boolean }
  xAxis: { anchorTerminals: true; wrap: boolean; rotate: 0 | 45; thinTo: number }
}
resolveChartLayout({
  frameW,
  slotW,
  viewportH,
  legendItems,
  yLabels,
  xLabels,
  categorical,
  override,
})
```

**Ladder**: apply the steps in order until data rect ≥ max(0.55 × card, `VX.minPlotHeight` floor):

1. compact number format for y labels longer than 4 chars
2. tick count = clamp(round(yMax / 44), 2, 6)
3. anchor terminal x labels inward
4. categorical x labels wrap before they rotate; rotate only when keys > 2× what fits;
   band/categorical per-tick width = label px
5. y labels inside the plot (compact/micro)
6. legend moves to the header slot (dots)
7. legend overflow → "All N" disclosure chip: a popover on a fine pointer, a bottom sheet on a coarse
   one. The band never grows, and every entry keeps its toggle.

- **Height** is derived from measured width × container class and clamped to 0.45 × `dvh` on
  coarse pointers. The consumer's `height` literal stays an override, with a dev warning when it
  pushes the plot below the floor. `ResponsiveChartHeight` keys become `base/regular/wide`; the old
  `sm/md/lg` keys stay as dev-warned aliases (MIGRATING.md).
- **Legend fit** is width-measured every time (reuse `entriesWithinRows`). A legend never rolls up
  fewer than 2 entries, and rolled entries are ranked by visual weight. `legend.maxRows` is
  deprecated: dev-warn now, removed next minor, with a MIGRATING.md entry. Row gap 4–6px,
  left-aligned.
- **Donut**: when W/H > 1.5, side legend with value and %; ring = min(h, 0.55w). At compact, the
  full list goes under the ring and is never rolled up. 7 or more slices fold into "Other".
- **Dual axis**: when y2 is present and each axis carries one visible series, tint that axis's tick
  labels with the series colour (VX ref, faint alpha). Delete the "(left axis)" legend prose.
- **End labels** (wide, ≤ 3 line series): direct labels in the right gutter with greedy collision
  nudging, falling back to header chips when labels collide. This is last in the order.

**Success metric:** median data rect ≥ 0.55 of card area at phone, tablet and desktop in the capture
harness, and no chart below 0.40.

## 5. Chart touch model (all kinds)

Today a tap does nothing on every chart kind, and a scrub leaves the tooltip stuck after lift, stacked
across linked charts (both P0).

- **Fine pointer**: hover tooltip, as today.
- **Coarse pointer**: `pointerdown` shows the readout immediately (reuse the existing
  resolve + `store.set` path). Drag scrubs horizontally while `touch-action: pan-y` keeps vertical
  page scroll working. On lift the readout **stays pinned** until the user taps elsewhere in the
  chart (moves the pin), taps outside it (dismisses), or presses Escape. `tooltip.follow`
  defaults to `false` on touch, so the readout anchors to the crosshair and never sits under the
  finger.
- `useDiscreteCursor(targets)` gives Donut and Heatmap the same keyboard, focus and tap parity that
  `HoverOverlay` gives cartesian kinds.
- Legend toggles get `[data-basalt-hit]`; today they're 20.9px tall.
- Linked charts (a shared cursor store): a pin on one chart shows the same x on the others, and a
  dismiss clears all of them.

## 6. Data, content, overlays

- **DataTable**: `meta.priority` on the existing ColumnMeta augmentation. Below the measured fit,
  low-priority columns collapse into a per-row disclosure instead of silent horizontal scroll. With
  no priority set, columns fold in declared order. Pagination and the footer go into `CtlSlot`
  (touch floor); the selection checkbox's hit area is the whole cell.
- **VirtualList**: dev warning when a row measures below `--vx-hit` on a coarse pointer.
- **Modal / `overlays.confirm`**: at the `compact` size class it renders as a bottom sheet with
  full-width action buttons at `--vx-hit` height. Select, Menu and Popover stay popovers (Mantine
  handles positioning); only the hit floor reaches their triggers.
- **Content**: code blocks get a trailing-edge fade mask when they overflow. Below 1200px the article
  TOC becomes a sticky "On this page" trigger that opens a sheet or popover (CONTENT-SPEC already
  promised this; today it just disappears).
- **Agent chat**: an internal `visualViewport` hook publishes `--vx-keyboard-inset`; the composer and
  thread sit above it. The hand-rolled `dvh` clamps in the playground reference pages go away.

## 7. Guards

- `basalt/raw-breakpoint` (oxlint) flags: responsive-object props (`{ base, sm, … }`) on Mantine
  components, `visibleFrom`/`hiddenFrom` outside shell homes, `useMediaQuery`/`useMatches`/
  `useViewportSize` imports, and `window.matchMedia`/`innerWidth`. Exempt: `use-size-class.ts`,
  ChartTooltip, and `basalt-allow` comments.
- CSS guard kind `raw-media-query` flags: width `@media` in consumer CSS modules, undeclared
  `@container` names or literals, and any pointer query other than `coarse`.
- `hit-floor.layout.test.ts`: every interactive element is ≥ 44×44 under `hasTouch`.
- `no-horizontal-overflow.layout.test.ts` is extended to 375, 768, 1024 and 1440.
- Playground: the 10 `SimpleGrid {base:1, md:2}` grids migrate to `WidgetGrid`.

## 8. Budgets (all at ceiling on 2026-09-25)

public symbols 396/400 · shipped rule lines 750/750 · spec prose 2479/2480 · playground routes 15/15.
Each wave stays net-negative or offsets what it adds in the same wave, and deprecations pay for the
new exports (`useBreakpoint`, `ChartTierMetrics`, `legend.maxRows`). This file and `PLAN.md` sit
under `docs/waves/`, outside the prose glob, and are deleted by the last wave. Never raise a ceiling
to make room.
