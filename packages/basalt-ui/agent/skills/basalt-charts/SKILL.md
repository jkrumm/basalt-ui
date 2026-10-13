---
name: basalt-charts
description: Add or extend a chart in a basalt-ui app — the procedure: pick a shipped kind vs extract one vs stay bespoke (Rule of Three), register the consumer series with defineSeries/groupTokens, compose CartesianChart (or the Lines/Bars kinds on it), then verify against the guards. Use when adding a chart, a new metric/series color, or extracting a repeated chart shape.
when_to_use: User wants to add a chart, restyle one structurally, introduce a new metric/series and its color, extract a recurring chart shape into a reusable kind, or asks where chart series colors live and how to register them. The how-to companion to /basalt-design, which owns the aesthetic law.
---

`/basalt-charts` is the HOW. `.claude/rules/basalt-charts.md` is the contract everything below
assumes, and `/basalt-design` owns the aesthetic law — read both before writing chart code. The
props themselves are in the shipped types and `llms.txt` at the install directory.

## 1. Pick the path (Rule of Three)

1. **A shipped kind fits** → use it: `Lines`, `Bars`, `StackedArea`, `DualPanel`, `MirroredBars`,
   `BandStrip`, `Donut`, `Heatmap`, `Sparkline`. Read their props before assuming a gap: dual axis,
   zones, x-zones, thresholds, refLines, per-point markers, per-series formatting and `state` are all
   declarative already.
2. **This is the SECOND instance of a shape with no kind** → extract a kind and migrate both call
   sites. Not on the first, not past the third.
3. **Genuinely unique** → stay bespoke in the page's own chart file, composing the primitive
   directly. Not in a shared kinds directory.

**Extracting a kind? Prove it by porting.** Move real call sites onto it and ship the list of what
it could NOT express. A demo page is written against the API that already exists, so it proves
nothing.

## 2. Register the series (this is consumer data)

`VX.series` does not exist in the framework — which metric owns which hue is domain data, declared
in ONE guard-exempt file per app:

```ts
// src/lib/series.ts — the one file exempt from check-theme, because it IS the palette source
import { buildPaletteCss, defineSeries, groupTokens, seriesTokens } from 'basalt-ui/tokens'

const HEALTH = defineSeries({ hrv: { light: '…', dark: '…' } }) // lighter on dark, deeper on light
export const SERIES = { ...seriesTokens(HEALTH), walking: groupTokens('walking', WALKING) }
export const PALETTE_CSS = buildPaletteCss({ groups: { '': HEALTH, 'walking-': WALKING } })
```

`seriesTokens`/`groupTokens` are exact-keyed, so a stale or typo'd key fails `tsc`. Feed the SAME
maps to `buildPaletteCss` (or `BasaltProvider`'s `paletteOptions.groups`, keyed by var PREFIX — the
trailing dash matters) or the refs point at variables nothing declares.

## 3. Compose the primitive

A cartesian chart composes `CartesianChart` and returns only marks from `marks` — margins, scales,
axes, grid, the shared cursor, crosshair, keyboard focus, legend and tooltip are already done:

```tsx
import { lineY } from '@tanstack/charts/line'

;<CartesianChart
  ariaLabel="HRV"
  data={data}
  x={(d) => d.date}
  series={HRV}
  marks={(plot) =>
    plot.visible.map((s) =>
      lineY(plot.rows(s.key), { x: (row) => row.x, y: 'y', z: 'series', stroke: s.color }),
    )
  }
/>
```

- **Draw `plot.rows(key)` / `plot.visible`, never the `series` prop** — otherwise a legend toggle
  hides nothing.
- **Dual axis is `y2`**, not a flag; a series opts in with `axis: 'right'`.
- **`x` returns a `Date`, `number` or `string`** and that picks the scale; a `Date` is a proportional
  time axis.
- **Size is `height`** (a number, or per container class). The host measures the width.
- Import marks from the allowed `@tanstack/charts/*` subpaths only (`basalt/chart-engine-boundary`),
  never the bare root and never `@visx/*`. No `rgba()` fill, no hex.

## 4. Verify

- `oxlint .` green — no `basalt/chart-engine-boundary`, no `basalt/chart-in-raw-surface`.
- `basalt-ui check-theme` green — no raw hex, no raw color function. `ariaLabel` is a required prop,
  so `tsc` catches a missing one.
- Every new color is a `{ light, dark }` pair in the series file and wired into the palette CSS.
- Tooltip rows and the legend are DERIVED from `series`; the plot draws `plot.visible`.
- Checked in both schemes, and with a pending query (`state={{ pending }}`, not `data ?? []`).
