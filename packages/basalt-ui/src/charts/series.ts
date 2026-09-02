/**
 * The series descriptor — single source of truth for color + line-style + label + accessor.
 * Legend + tooltip rows are *derived* from it, never hand-authored in parallel. Mantine-free.
 *
 * Generalizes `MultiLineSeries<T>` (`kinds/MultiLine.tsx`) into the shared spine consumed by
 * every kind. `LegendPlacement` also lives here so `ChartLegend` and the future `ChartFrame`
 * share one definition.
 */

import {
  curveLinear,
  curveMonotoneX,
  curveStep,
  curveStepAfter,
  curveStepBefore,
} from '@visx/curve'
import type { LegendEntry } from './primitives/ChartLegend'

/**
 * Default stroke width for plotted line overlays in `DualPanel` / `MultiLine` / `ZonedLine` —
 * thinner than the generic `VX.lineWidth` per the 2026-07 modern-zinc redesign
 * (`docs/DESIGN-SPEC.md` §5, "tertiary/line overlay ... at 1.9px stroke"). `VX.lineWidth` itself
 * stays the "one width everywhere" default for `Bars`' line overlays, legend line swatches, and
 * `TooltipRow`'s generic fallback — this constant only overrides the three kinds it's imported by.
 */
export const LINE_OVERLAY_STROKE_WIDTH = 1.9

/** Governs BOTH the plotted mark and the legend swatch shape. */
export type SeriesMark = 'line' | 'bar' | 'area'

/** Only meaningful for `mark: 'line'`. */
export type SeriesDash = 'solid' | 'dashed'

/**
 * The interpolation between two plotted points. Named rather than a raw d3 `CurveFactory` so the
 * set is closed, serializable, and identical across every kind — a chart cannot pick a curve the
 * legend swatch and the sibling chart next to it do not also understand.
 *
 * - `monotone` (default, today's behaviour everywhere) — smoothed, overshoot-free.
 * - `linear` — straight segments. The honest choice when the points are samples, not a signal.
 * - `step` / `stepAfter` / `stepBefore` — the value HOLDS between samples and changes at one x.
 *   Reach for these when the quantity is piecewise-constant (a price tier, a config value, a
 *   discrete state): a smoothed curve through them draws intermediate values that never existed.
 *   `stepAfter` holds the value forward from its own x, `stepBefore` holds it back from the next,
 *   `step` changes at the midpoint.
 */
export type SeriesCurve = 'monotone' | 'linear' | 'step' | 'stepAfter' | 'stepBefore'

/** d3's curve-factory shape, taken from a curve we already import rather than from
 * `@visx/vendor/d3-shape` — that package is a transitive of `@visx/curve`, not one of the nine
 * exact-pinned peers, so naming it in an import would add an undeclared dependency. */
type CurveFactory = typeof curveMonotoneX

const CURVES: Record<SeriesCurve, CurveFactory> = {
  monotone: curveMonotoneX,
  linear: curveLinear,
  step: curveStep,
  stepAfter: curveStepAfter,
  stepBefore: curveStepBefore,
}

/**
 * The d3 curve factory for a {@link SeriesCurve}. `undefined` resolves to `curveMonotoneX` — the
 * value every kind hard-coded before this seam existed, so an omitted `curve` moves nothing.
 * Exported for a hand-composed plot that draws its own `LinePath` from the same `series` array.
 */
export function curveFor(curve?: SeriesCurve): CurveFactory {
  return curve === undefined ? curveMonotoneX : CURVES[curve]
}

/** Drives legend grouping/dividers. */
export type SeriesRole = 'series' | 'overlay' | 'reference'

/** Where the derived legend renders relative to the plot. */
export type LegendPlacement = 'top' | 'bottom' | 'left' | 'right'

/**
 * Consumer-facing legend config exposed by every kind's `legend` prop — the subset of
 * `ChartFrame`'s legend object a consumer may set directly. Deliberately excludes
 * `highlighted`/`onHighlight`, which the kind injects itself (its own hover-dim state).
 * `legend={false}` on a kind disables the legend entirely (the sparkline escape).
 */
export type ChartLegendConfig = {
  /** Default 'bottom'. */
  placement?: LegendPlacement
  /** Visually separate role: series | overlay | reference. */
  groups?: boolean
  /** Wrap cap → "+N more" rollup at high cardinality. */
  maxRows?: number
  /** Clicking an entry hides that series. Default: on whenever there is more than one entry. */
  toggle?: boolean
}

/** Visual identity of a series — everything the legend + tooltip swatch need. No accessors, no `T`. */
export type SeriesStyle = {
  key: string
  label: string
  /** A --vx-* ref (VX.series.*), never a raw hex. */
  color: string
  mark: SeriesMark
  /** Default 'solid'. */
  dash?: SeriesDash
  /**
   * Interpolation between points for the line/area shapes this series draws. Default `'monotone'`
   * — today's behaviour, unchanged, everywhere. See {@link SeriesCurve} for when a step curve is
   * the honest one. Silently no-ops on `mark: 'bar'`, which has nothing to interpolate.
   */
  curve?: SeriesCurve
  /** Default VX.lineWidth (one width, everywhere). */
  strokeWidth?: number
  /** bar/area: the swatch honors this so it cannot lie. */
  fillOpacity?: number
  /**
   * A MARK property — dims the plotted stroke, e.g. a faint moving-average companion line. The
   * legend swatch honors it too (parity with `fillOpacity`, which it already honors — a swatch
   * that lies is the thing the derived-legend rule exists to prevent). The TOOLTIP ROW swatch and
   * the CROSSHAIR DOT deliberately do NOT honor it: those are 12px value-readout chips where a
   * sub-1 opacity reads as a rendering bug, not as data.
   *
   * Applies to STROKES only, so it silently no-ops on a `mark: 'bar'`/`'area'` series — a bar
   * swatch has no stroke to dim. Dim those with `fillOpacity` instead. This bites the
   * zone/reference-legend idiom in particular (`mark: 'bar'`, `getValue: () => null`), where
   * reaching for `strokeOpacity` looks right and does nothing.
   */
  strokeOpacity?: number
  /** Which y-axis this series is measured against. Default 'left'. `'right'` is what makes a
   * chart dual-axis — `CartesianChart` reads it for the crosshair dots and the tooltip. */
  axis?: 'left' | 'right'
  /** Default 'series'. */
  role?: SeriesRole
  /** Default true; false = companion folded under `parent`. */
  legend?: boolean
  /**
   * Default true; false = drawn and legended, but NEVER listed as a tooltip row. The replacement
   * for the per-kind `hideBarTooltipRows` escape the old layer had: it belongs to the series, not to the kind, so
   * one series can opt out without the kind growing a prop for it.
   */
  tooltip?: boolean
  /** e.g. an MA line names its parent so hover-dimming keeps the pair. */
  parent?: string
  /** Short qualifier rendered after the label in muted text — e.g. a flat-at-zero series that is
   * invisible in the plot. */
  note?: string
}

/** Full descriptor = visual identity + data accessors. Generic over the point type. */
export type ChartSeries<T> = SeriesStyle & {
  /**
   * null = an ABSENCE, never a zero: a real gap in the line/area (`defined`, not a straight
   * interpolation across the hole) plus a skipped tooltip row and no crosshair dot. In a STACKED
   * kind the absence is contagious — a band with no value leaves no cumulative total, so the whole
   * stack gaps at that x (`StackedArea`'s JSDoc has the accounting).
   */
  getValue: (d: T) => number | null
  /** Per-series override of the shared tooltip/value formatter. Receives the hovered datum
   * alongside the value so a row can read fields beyond the plotted number (e.g. `97.5 kg (92.5 ×
   * 3)`). */
  formatValue?: (v: number, d: T) => string
  /** PR star / status dot. Return null for no marker at that point. `ring` defaults true (today's
   * punched-out stroke, unchanged); `false` omits the stroke entirely. `fillOpacity` defaults 1. */
  getMarker?: (d: T) => { color?: string; r?: number; fillOpacity?: number; ring?: boolean } | null
}

/** A single derived tooltip row, ready for `TooltipRow`. */
export type TooltipRowData = {
  key: string
  label: string
  color: string
  value: string
  shape: 'line' | 'bar'
  dashed: boolean
  strokeWidth?: number
}

const shapeFor = (mark: SeriesMark): 'line' | 'bar' => (mark === 'line' ? 'line' : 'bar')

function legendEntryFor(s: SeriesStyle): LegendEntry {
  return {
    key: s.key,
    label: s.label,
    color: s.color,
    shape: shapeFor(s.mark),
    dashed: s.dash === 'dashed',
    ...(s.strokeWidth !== undefined && { strokeWidth: s.strokeWidth }),
    ...(s.fillOpacity !== undefined && { fillOpacity: s.fillOpacity }),
    ...(s.strokeOpacity !== undefined && { strokeOpacity: s.strokeOpacity }),
    ...(s.role !== undefined && { role: s.role }),
    ...(s.note !== undefined && { note: s.note }),
  }
}

/**
 * Derive the legend from a series-style array — the enforcement that the legend can never drift
 * from what's plotted. Groups by `role` (series → overlay → reference) via `ChartLegend`'s own
 * `groups` rendering.
 *
 * `legend === false`: dropped entirely, UNLESS `parent` names another series in the array — then
 * it is folded into that parent's `LegendEntry.children` as a subordinate dashed sub-entry (e.g.
 * an MA companion), rather than vanishing. A series with `legend !== false` always renders as a
 * normal top-level entry.
 */
export function deriveLegend(series: readonly SeriesStyle[]): LegendEntry[] {
  const entries: LegendEntry[] = []
  const byKey = new Map<string, LegendEntry>()

  for (const s of series) {
    if (s.legend === false) continue
    const entry = legendEntryFor(s)
    entries.push(entry)
    byKey.set(s.key, entry)
  }

  for (const s of series) {
    if (s.legend !== false || s.parent === undefined) continue
    const parent = byKey.get(s.parent)
    if (parent === undefined) continue
    parent.children ??= []
    parent.children.push(legendEntryFor(s))
  }

  return entries
}

/**
 * Derive tooltip rows from a series descriptor array + the hovered datum. Skips rows where
 * `getValue(datum) === null` or `tooltip === false`; honors per-series `formatValue` over the
 * shared `fallbackFormat`.
 * Kinds pass `series.toReversed()` for stacked charts so the tooltip stack matches the visual stack.
 */
export function deriveTooltipRows<T>(
  series: readonly ChartSeries<T>[],
  datum: T,
  fallbackFormat: (v: number) => string,
): TooltipRowData[] {
  const rows: TooltipRowData[] = []
  for (const s of series) {
    if (s.tooltip === false) continue
    const value = s.getValue(datum)
    if (value === null) continue
    const format: (v: number, d: T) => string = s.formatValue ?? fallbackFormat
    rows.push({
      key: s.key,
      label: s.label,
      color: s.color,
      value: format(value, datum),
      shape: shapeFor(s.mark),
      dashed: s.dash === 'dashed',
      ...(s.strokeWidth !== undefined && { strokeWidth: s.strokeWidth }),
    })
  }
  return rows
}

/**
 * Coerces a `ChartSeries.getValue` result into what a plotted point stores as its y: `null`,
 * `undefined` and `NaN` all collapse to `null`, which downstream `definedOn` reads as a
 * documented gap rather than a value to plot. Shared by `MultiLine`'s `seriesPoints` and
 * `ZonedLine`'s `linePoints` — both used to reimplement this coercion independently.
 */
export function toPlotPoint(v: number | null | undefined): number | null {
  return v === null || v === undefined || Number.isNaN(v) ? null : v
}

/**
 * A `defined` predicate for `LinePath`/`AreaClosed`/`Threshold`, bound to one y-scale. A null
 * `__y` is a documented gap (`ChartSeries.getValue`), and a non-positive value on a log scale maps
 * to `NaN` via the scale itself — without excluding both, d3's generators either draw an
 * interpolated straight line across the hole or blank the entire path from that point on (SVG's
 * `NaN` path-command handling). Shared by `MultiLine` and `ZonedLine`.
 */
export function definedOn(scale: (y: number) => number): (d: { __y: number | null }) => boolean {
  return (d) => d.__y !== null && Number.isFinite(scale(d.__y))
}
