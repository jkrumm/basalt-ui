/**
 * `MirroredBars` — two bar panes mirrored around one baseline, each in its OWN y domain
 * (`docs/V2-SPEC.md` § 9.2, § 9.3): the `up` pane grows from the baseline upward, the `down` pane
 * downward. Two views composed with `composeViews` + `grid` + `alignX`, one host, one cursor, one
 * tooltip.
 *
 * Why two domains: an upload an order of magnitude below its download flattens to a line along the
 * baseline on a shared scale, and it is the half that explains a stall. A pane has no lower bound to
 * configure — its zero IS the baseline.
 *
 * ABSENCE is a state a reader cannot decode from either axis, so it is drawn across the full height
 * of both panes in one flat fill (`--vx-neutral`, or the `absentState` entry's colour): a `getAbsentFraction` share of a bar's width that no
 * source sample covers. A bar that measured zero draws nothing; an absent one draws neutral.
 */
import { decorative } from '@tanstack/charts/mark/decorative'
import { rect } from '@tanstack/charts/rect'
import { ruleY } from '@tanstack/charts/rule'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import type { ChartTooltipRow as EngineTooltipRow, ChartValue } from '@tanstack/charts/types/core'
import { useCallback, useMemo } from 'react'
import type { ReactElement } from 'react'
import { VX, alpha } from '../tokens'
import { resolveContainerClass } from '../tokens/size-classes'
import { defaultFormatX, defaultNumberFormat, seriesRow, visibleSeries } from './compile'
import { barMark, emphasis } from './marks'
import { PanelRung, chartHeightOf, paneX, paneY, rowsOf } from './panel'
import type { PaneBuilder, PanelInput, PanelPlan } from './panel'
import { xScaleFor } from './scales'
import { foldBands, resolveNamedState } from './band-fold'
import { rowX } from './types'
import type { CartesianChartProps, ChartSeries, ChartX, PlotRow } from './types'

/** One of the two panes. */
export type MirroredBarPane = {
  /** The `series` entry this pane draws: its colour, legend entry and tooltip row. A key naming no
   * entry throws: the pane would vanish, which reads as a measured zero. */
  key: string
  /** The pane's upper bound. `'auto'` (default) is its own visible maximum; a number pins it. */
  max?: number | 'auto' | undefined
  /** When `'auto'`: floors the upper bound, so a quiet window does not amplify noise to full height. */
  autoMaxFloor?: number | undefined
  /** Tick count for this pane's own axis. Default 3. */
  ticks?: number | undefined
  /** Tick and tooltip formatter, in the pane's OWN units. */
  format: (v: number) => string
}

/** A bar series. Any entry that is neither pane is legend-only (give it `getValue: () => null`). */
export type MirroredBarsSeries<T, K extends string = string> = Pick<
  ChartSeries<T>,
  'label' | 'color' | 'getValue' | 'formatValue' | 'tooltip' | 'legend' | 'role' | 'note'
> & {
  key: K
  /** Read for the `absentState` entry only (its fill and swatch); the panes draw at full colour. */
  fillOpacity?: number | undefined
}

export type MirroredBarsProps<T, X extends ChartX = ChartX, K extends string = string> = Pick<
  CartesianChartProps<T, X>,
  | 'ariaLabel'
  | 'data'
  | 'x'
  | 'formatX'
  | 'legend'
  | 'height'
  | 'state'
  | 'cursorGroup'
  | 'tooltip'
  | 'className'
  | 'style'
> & {
  /** The single source of colours, legend entries and tooltip rows. */
  series: readonly MirroredBarsSeries<T, K>[]
  /** Drawn above the baseline. */
  up: MirroredBarPane
  /** Drawn below the baseline. */
  down: MirroredBarPane
  /** The up pane's share of the height. Default 0.35: the pair is usually asymmetric. */
  upFraction?: number | undefined
  /** 0..1 of a bar's width that no source sample covers, drawn across both panes. */
  getAbsentFraction?: ((d: T) => number) | undefined
  /**
   * The `series` key that names the absent share: its colour fills it and its legend entry labels
   * it (give it `getValue: () => null`, it is legend-only). `BandStrip.absentState`'s shape. Its
   * colour must differ from every measured series', not only by alpha. Default: a flat
   * `--vx-neutral` with no legend entry. A key naming no entry throws.
   */
  absentState?: K | undefined
  /** Per-datum bar opacity: a real but qualified measurement (a short bucket) drawn dimmer. */
  getBarOpacity?: ((d: T) => number) | undefined
  /**
   * Collapse adjacent data where one band per datum would be sub-pixel. `merge` is the consumer's
   * (max, sum, or a rate from summed parts) and must keep `group[0]`'s x, the slot start.
   */
  fold?: { minBandPx?: number | undefined; merge: (group: T[]) => T } | undefined
  /** Default `'leading'`: x is a slot's start. */
  cursorResolution?: CartesianChartProps<T, X>['cursorResolution'] | undefined
}

const DEFAULT_UP_FRACTION = 0.35
const DEFAULT_PANE_TICKS = 3
const DEFAULT_MIN_BAND_PX = 3
const BAR_OPACITY = 1
/** A band's drawn share of its step: `1 - BAND_PADDING_INNER` in `scales.ts`. */
const BAND_FILL = 0.8

const clamp01 = (v: number | undefined): number =>
  v === undefined || !Number.isFinite(v) ? 0 : Math.min(Math.max(v, 0), 1)

/** One pane's upper bound; `|| 1` guards a window with no traffic (a zero-width domain is NaN). */
function paneMax<T>(pane: MirroredBarPane, s: ChartSeries<T>, data: readonly T[], on: boolean) {
  if (pane.max !== undefined && pane.max !== 'auto') return pane.max || 1
  if (!on) return 1
  let max = 0
  for (const d of data) {
    const v = s.getValue(d)
    if (v !== null && Number.isFinite(v)) max = Math.max(max, v)
  }
  return Math.max(max, pane.autoMaxFloor ?? 0) || 1
}

function assertPaneKey<T>(
  side: 'up' | 'down',
  key: string,
  series: readonly ChartSeries<T>[],
): ChartSeries<T> {
  const found = series.find((s) => s.key === key)
  if (found) return found
  throw new Error(
    `[basalt] MirroredBars: ${side}.key "${key}" names no \`series\` entry ` +
      `(known: ${series.map((s) => s.key).join(', ')}): the pane would silently vanish, which ` +
      'reads as a measured zero.',
  )
}

export function MirroredBars<T, X extends ChartX = ChartX, K extends string = string>(
  props: MirroredBarsProps<T, X, K>,
): ReactElement {
  const {
    data,
    x,
    series,
    up,
    down,
    upFraction = DEFAULT_UP_FRACTION,
    getAbsentFraction,
    getBarOpacity,
    fold: foldConfig,
    cursorResolution = 'leading',
    absentState,
    ...rung
  } = props
  const { formatX } = rung

  const absentKey = resolveNamedState(
    'MirroredBars',
    'absentState',
    absentState,
    series.map((s) => s.key),
  )
  const bars = useMemo<ChartSeries<T>[]>(
    () =>
      series.map((s) => ({
        ...s,
        mark: 'bar' as const,
        // A pane draws at full colour, so its swatch must not claim an opacity the plot lacks.
        ...(s.key !== absentKey && { fillOpacity: undefined }),
      })),
    [series, absentKey],
  )
  const absentEntry = bars.find((s) => s.key === absentKey)

  const plan = useCallback(
    ({ hidden, highlighted, width }: PanelInput): PanelPlan<T> => {
      const upSeries = assertPaneKey('up', up.key, bars)
      const downSeries = assertPaneKey('down', down.key, bars)
      const drawn = foldConfig
        ? foldBands(
            data,
            Math.floor(width / (foldConfig.minBandPx ?? DEFAULT_MIN_BAND_PX)),
            foldConfig.merge,
          )
        : data
      const model = xScaleFor<X>(drawn.map(x), true)
      const visible = visibleSeries(bars, hidden)
      // A legend-hidden absent entry gives its share back to the measured bar, as `BandStrip`
      // does; with no entry the share is always drawn, flat neutral.
      const absentOn = !absentEntry || visible.includes(absentEntry)
      const absentFill = absentEntry
        ? alpha(absentEntry.color, absentEntry.fillOpacity ?? 1)
        : VX.neutral
      const upOn = visible.includes(upSeries)
      const downOn = visible.includes(downSeries)
      const format = (v: ChartValue): string => (formatX ? formatX(v as X) : defaultFormatX(v))
      const upMax = paneMax(up, upSeries, drawn, upOn)
      const downMax = paneMax(down, downSeries, drawn, downOn)
      const bandWidth = 2 * model.halfStep * BAND_FILL
      // One instance per pane: the engine sets a scale's range, and the panes' plots differ in width.
      const bandScale = () => xScaleFor<X>(drawn.map(x), true).scale

      const pane =
        (
          side: 'up' | 'down',
          cfg: MirroredBarPane,
          s: ChartSeries<T>,
          on: boolean,
          max: number,
        ): PaneBuilder =>
        ({ width: w, height: h }) => {
          const cls = resolveContainerClass(w)
          const whole = chartHeightOf(h, side === 'up' ? upFraction : 1 - upFraction, 0)
          // The down pane's zero is at its top.
          const domain: [number, number] = side === 'up' ? [0, max] : [max, 0]
          const rows: PlotRow<T, X>[] = on ? rowsOf(drawn, x, s) : []
          const opacity = (d: T): number =>
            (getBarOpacity?.(d) ?? BAR_OPACITY) * emphasis(highlighted, s)
          // A partly-absent bar is painted by rects on the plot-fraction scale, so its measured share
          // is narrower than its band; the bar itself stays as the (transparent) focus target.
          const left = (row: PlotRow<T, X>): number => (model.fraction(row.x) ?? 0) - bandWidth / 2
          const absent = (d: T): number => (absentOn ? clamp01(getAbsentFraction?.(d)) : 0)
          const measured = rows.filter(
            (r) => r.y !== null && absent(r.datum) > 0 && absent(r.datum) < 1,
          )
          const byOpacity = (rs: PlotRow<T, X>[]): [number, PlotRow<T, X>[]][] => {
            const groups = new Map<number, PlotRow<T, X>[]>()
            for (const r of rs) {
              const o = opacity(r.datum)
              const group = groups.get(o)
              if (group) group.push(r)
              else groups.set(o, [r])
            }
            return [...groups]
          }
          const gaps = (on ? drawn : []).flatMap((d, i) => {
            const a = absent(d)
            const row = rows[i] ?? { x: x(d), y: null, series: s.key, datum: d }
            return a > 0 ? [{ row, a }] : []
          })
          return {
            marks: [
              ruleY([0], {
                id: 'baseline',
                stroke: VX.axisStroke,
                strokeOpacity: 1,
                strokeWidth: 1,
              }),
              barMark(rows, {
                id: `${side}-bars`,
                x: rowX,
                y: 'y',
                fill: (row: PlotRow<T, X>) =>
                  absent(row.datum) > 0 ? 'transparent' : alpha(s.color, opacity(row.datum)),
              }),
              // A rect's fill is constant, so one mark per distinct opacity.
              ...byOpacity(measured).map(([o, group]) =>
                decorative(
                  rect(group, {
                    id: `${side}-measured-${o}`,
                    x1: (r) => left(r),
                    x2: (r) => left(r) + bandWidth * (1 - absent(r.datum)),
                    y1: () => 0,
                    y2: (r) => r.y ?? 0,
                    xScale: 'zx',
                    fill: alpha(s.color, o),
                    inset: 0,
                  }),
                ),
              ),
              decorative(
                rect(gaps, {
                  id: `${side}-absent`,
                  x1: ({ row, a }) => left(row) + bandWidth * (1 - a),
                  x2: ({ row }) => left(row) + bandWidth,
                  y1: () => 0,
                  y2: () => max,
                  xScale: 'zx',
                  fill: absentFill,
                  inset: 0,
                }),
              ),
            ],
            scales: {
              x:
                side === 'down'
                  ? paneX({ scale: bandScale(), model, format, cls, height: whole })
                  : { scale: bandScale(), axis: false },
              y: paneY({
                scale: scaleLinear().domain(domain),
                domain,
                format: cfg.format,
                ticks: cfg.ticks ?? DEFAULT_PANE_TICKS,
                cls,
                height: whole,
              }),
              zx: { channel: 'x', scale: scaleLinear().domain([0, 1]), axis: false },
            },
          }
        }

      return {
        keys: model.values,
        top: pane('up', up, upSeries, upOn, upMax),
        bottom: pane('down', down, downSeries, downOn, downMax),
        topFraction: upFraction,
        gap: 0,
        rows: (d) => {
          const out: EngineTooltipRow[] = []
          for (const s of visible) {
            const v = s.getValue(d)
            if (s.tooltip === false || v === null || !Number.isFinite(v)) continue
            // Each pane's row falls back to ITS OWN formatter: the panes are in different units.
            const fallback =
              s.key === up.key ? up.format : s.key === down.key ? down.format : defaultNumberFormat
            out.push(
              seriesRow(
                s,
                s.formatValue ? s.formatValue(v, d) : fallback(v),
                highlighted === s.key,
              ),
            )
          }
          return out
        },
      }
    },
    [
      data,
      x,
      bars,
      up,
      down,
      upFraction,
      getAbsentFraction,
      getBarOpacity,
      foldConfig,
      formatX,
      absentEntry,
    ],
  )

  return (
    <PanelRung
      {...rung}
      series={bars}
      plan={plan}
      byWidth={foldConfig !== undefined}
      cursorResolution={cursorResolution}
    />
  )
}
