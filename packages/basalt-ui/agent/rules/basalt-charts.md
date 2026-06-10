---
source: basalt-ui
description: visx chart conventions — compose basalt-ui primitives/kinds, stay Mantine-free, and keep all color in `--vx-*` tokens. Enforced by the oxlint `@visx` ban.
paths:
  - 'src/**/charts/**'
  - 'apps/**/charts/**'
  - 'packages/**/charts/**'
---

# Basalt Charts — visx Conventions

basalt-ui owns the chart doctrine. Charts are built from low-level [visx](https://airbnb.io/visx)
primitives so we can build exactly the chart we want; the trade-off is that every chart duplicates
structure unless we compose shared building blocks. **The primitives + a small kind set are the
contract, not optional polish.**

## The boundary (lint-enforced)

The shipped oxlint preset (`basalt-ui/configs/oxlint.json`) enforces two hard rules — they hold in
downstream apps too:

- **`@visx/*` may only be imported inside a `**/charts/**` directory.** Everywhere else, compose
  basalt-ui chart primitives/kinds. If you need a raw visx primitive for a bespoke chart, import it
  from `basalt-ui/charts` (it re-exports `Group`, `LinePath`, `Bar`, `AreaClosed`, `scaleLinear`,
  `curveMonotoneX`, …) — keep the dependency declared in one place.
- **`@visx/tooltip` is banned everywhere.** Use `ChartTooltip` + `TooltipHeader`/`TooltipRow`/
  `TooltipBody` from `basalt-ui/charts`.
- **`charts/**`must be Mantine-free** — no`@mantine/\*`imports. Bridge the Mantine color scheme to
charts in exactly one file (see basalt-mantine.md, the VxBridge pattern); route components import
chart primitives directly from`basalt-ui/charts`, never from the bridge file.

## Every chart has

1. **ChartCard** wrapper — gives title + info-tooltip + extra slot, consistent margin.
2. **ChartLegend** — never hand-rolled legend markup. Supports `line | bar | split | splitLine`
   shapes and optional highlight state.
3. **ChartTooltip** + `TooltipHeader` + `TooltipRow` + `TooltipBody` — never `@visx/tooltip` directly.
4. **AxisLeftNumeric** / **AxisRightNumeric** + **AxisBottomDate** — never raw `<AxisLeft>`/`<AxisBottom>`
   (they miss theme tokens + smart ticks).
5. **HoverOverlay** for mouse capture, **HoverContext** for cross-chart crosshair sync,
   **useChartTooltip** for tip state, **useHoverSync** for the shared cursor.
6. **Theme-aware colors** via `VX.*` tokens + `alpha()`. **Never** a raw hex literal in a chart file.
   **Never** `localStorage.getItem('theme')` — the scheme resolves via CSS vars (see Dark/light below).

**Exemption:** sparklines (`LineSparkline`, `BarSparkline` — tiny inline charts with no legend/tooltip)
don't have to compose ChartCard/ChartLegend/ChartTooltip — but still use `VX.*` tokens.

## Kinds — the recurring shapes

basalt-ui ships these kinds (declarative props, generic over your point type via `getX`/`getY`):

- **`ZonedLine`** — a line with zone bands, thresholds, and reference lines.
- **`Bars`** — bars with optional overlaid line, zones, ref lines, dual-axis config.
- **`StackedArea`** — opaque stacked bands.
- **`Donut`** — proportional donut.

How to add a chart:

1. **Fits an existing kind?** Use it. Pass `data`, `width`, `height`, `chartId`, accessors, and the
   declarative zones/thresholds/refLines arrays.
2. **Second instance of a new recurring shape?** Extract a kind and migrate both call sites
   (Rule of Three: don't extract on the first, don't wait past the third). Bespoke escape hatches
   (`renderExtraTooltipRows`, etc.) are fine but must not grow into god-object configs.
3. **Genuinely unique (e.g. a dual-panel MACD)?** Stay bespoke — compose the primitives + the raw
   visx re-exports directly. Keep it in the page's chart file, not in a shared kind.

**Anti-pattern:** a single `<Chart type="..." config={...} />` that switches by kind. Prefer N small kinds.

## Series color

App-specific series colors are _your_ domain data, not framework data. Declare them once:

```ts
import { defineSeries, groupTokens } from 'basalt-ui/tokens'

const SERIES = defineSeries({
  load: { light: '#…', dark: '#…' },
  recovery: { light: '#…', dark: '#…' },
})
const tokens = groupTokens('series', SERIES) // → { load: 'var(--vx-series-load)', ... }
```

Emit the CSS via `buildPaletteCss({ groups: { 'series-': SERIES } })`. A hue keeps its identity but
shifts shade across schemes — that's why each entry is a `{ light, dark }` pair, not a single value.
**Adding a new color** means adding a pair to your series map and rebuilding the palette CSS — never
inline a hex in a chart.

## Dark/light mode

Theme reactivity is **pure CSS**: the `--vx-*` variables are redeclared under the light/dark color
scheme, so toggling the scheme restyles every chart with no React re-render. Charts read `VX.*` (var
refs) directly. Don't branch on color scheme in JS; never read `localStorage.getItem('theme')`.

## Area gradients

Use the `AreaGradient` primitive (a vertical `<linearGradient>` of `color-mix` stops over a `--vx-*`
color) with the global strength knobs (`--vx-area-top` / `--vx-area-bottom`). Default the fill **on**
for plain metric lines, **off** when the chart already carries zone/threshold fills (avoid double-fill
clutter). Keep stacked-area bands opaque — fading them leaks lower bands.

## Rule of thumb

> If the new chart doesn't fit the primitives, add a kind — don't loosen the primitives.
