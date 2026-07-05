/**
 * The series descriptor — single source of truth for color + line-style + label + accessor.
 * Legend + tooltip rows are *derived* from it, never hand-authored in parallel. Mantine-free.
 *
 * Generalizes `MultiLineSeries<T>` (`kinds/MultiLine.tsx`) into the shared spine consumed by
 * every kind. `LegendPlacement` also lives here so `ChartLegend` and the future `ChartFrame`
 * share one definition.
 */

import type { LegendEntry } from './primitives/ChartLegend'

/** Governs BOTH the plotted mark and the legend swatch shape. */
export type SeriesMark = 'line' | 'bar' | 'area'

/** Only meaningful for `mark: 'line'`. */
export type SeriesDash = 'solid' | 'dashed'

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
  /** Default VX.lineWidth (one width, everywhere). */
  strokeWidth?: number
  /** bar/area: the swatch honors this so it cannot lie. */
  fillOpacity?: number
  /** Default 'series'. */
  role?: SeriesRole
  /** Default true; false = companion folded under `parent`. */
  legend?: boolean
  /** e.g. an MA line names its parent so hover-dimming keeps the pair. */
  parent?: string
}

/** Full descriptor = visual identity + data accessors. Generic over the point type. */
export type ChartSeries<T> = SeriesStyle & {
  /** null = line gap + skipped tooltip row. */
  getValue: (d: T) => number | null
  /** Per-series override of the shared tooltip/value formatter. */
  formatValue?: (v: number) => string
  /** PR star / status dot. Return null for no marker at that point. */
  getMarker?: (d: T) => { color?: string; r?: number } | null
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
    ...(s.role !== undefined && { role: s.role }),
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
 * `getValue(datum) === null`; honors per-series `formatValue` over the shared `fallbackFormat`.
 * Kinds pass `series.toReversed()` for stacked charts so the tooltip stack matches the visual stack.
 */
export function deriveTooltipRows<T>(
  series: readonly ChartSeries<T>[],
  datum: T,
  fallbackFormat: (v: number) => string,
): TooltipRowData[] {
  const rows: TooltipRowData[] = []
  for (const s of series) {
    const value = s.getValue(datum)
    if (value === null) continue
    const format = s.formatValue ?? fallbackFormat
    rows.push({
      key: s.key,
      label: s.label,
      color: s.color,
      value: format(value),
      shape: shapeFor(s.mark),
      dashed: s.dash === 'dashed',
      ...(s.strokeWidth !== undefined && { strokeWidth: s.strokeWidth }),
    })
  }
  return rows
}
