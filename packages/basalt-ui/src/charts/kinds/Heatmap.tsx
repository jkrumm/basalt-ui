import { Group } from '@visx/group'
import type { PointerEvent, ReactNode } from 'react'
import { memo, useMemo, useState } from 'react'
import { assertRequiredProps } from '../../common/validate'
import type { BasaltProps } from '../../common/props'
import {
  ChartTooltipFloat,
  TooltipBody,
  TooltipHeader,
  TooltipRow,
} from '../primitives/ChartTooltip'
import { ChartFrame } from '../primitives/ChartFrame'
import { useChartTierMetrics } from '../primitives/chart-tier'
import type { ChartState } from '../primitives/ChartPending'
import { maxTextWidth } from '../utils/measure-text'
import { thinLabels, xLabelPxFor } from '../utils/ticks'
import { VX, alpha } from '../../tokens'

/** A single resolved heatmap cell — the unit the tooltip and hover operate on. */
type HeatmapCell = { row: string; col: string; value: number }

/** A hovered cell plus the viewport anchor `ChartTooltipFloat` positions against. */
type HeatmapTip = HeatmapCell & { anchor: { x: number; y: number } }

export type HeatmapProps<T> = BasaltProps & {
  data: T[]
  /** Fixed height in pixels. Used when neither `aspectRatio` nor `fill` is set. Default 240. */
  height?: number
  /** height = Math.round(containerWidth / aspectRatio). Ignored when `fill` is set. */
  aspectRatio?: number
  /** Fill the parent flex/grid cell's measured height instead of a fixed/derived one. */
  fill?: boolean
  chartId: string
  /** Extracts the y-axis category (row) from a data point. */
  getRow: (d: T) => string
  /** Extracts the x-axis category (column) from a data point. */
  getCol: (d: T) => string
  /** Extracts the cell intensity value. */
  getValue: (d: T) => number
  /** Explicit y order; defaults to first-seen rows from data. */
  rows?: string[]
  /** Explicit x order; defaults to first-seen columns from data. */
  cols?: string[]
  /** Base hue token for the heat fill. Default VX.line. */
  color?: string
  /** Maps a value to a 0..1 intensity. Default value/max. */
  intensity?: (value: number, max: number) => number
  /** Gap (px) between cells. Default 2. */
  cellGap?: number
  /** Corner radius (px) of each cell. Default 2. */
  cellRadius?: number
  /** Formatter for the tooltip value. */
  formatValue?: (v: number) => string
  /** Label transform for a row category (axis + tooltip). */
  rowLabel?: (row: string) => string
  /** Label transform for a column category (axis + tooltip). */
  colLabel?: (col: string) => string
  /** Optional extra tooltip rows (rendered after the main row). */
  renderTooltip?: (cell: HeatmapCell) => ReactNode
  /** Optional gradient legend strip below the grid (faint → solid color). */
  legend?: { min: string; max: string }
  /** Accessible text alternative, forwarded to `ChartFrame` as `aria-label` (+ `role="group"`). */
  ariaLabel?: string
  /** Forwarded to `ChartFrame` — see `ChartPending`'s JSDoc for the three-state rationale. */
  isPending?: boolean
  /** The three "nothing to draw" states in one prop — pending → error → empty. See
   * `ChartState`; `isPending` stays a supported alias for `state={{ pending: true }}`. */
  state?: ChartState
}

/** Build a first-seen-ordered list of unique keys from data via an accessor. */
function firstSeen<T>(data: T[], get: (d: T) => string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const d of data) {
    const k = get(d)
    if (!seen.has(k)) {
      seen.add(k)
      out.push(k)
    }
  }
  return out
}

// Compound (row, col) cell key. A null byte can't appear in user category strings, so it never
// collides the way a space separator could — e.g. (row "a b", col "c") vs (row "a", col "b c").
const cellKey = (row: string, col: string): string => `${row}\u0000${col}`

// Category labels read like axis ticks (docs/DESIGN-SPEC.md §5: "ticks mono 10.5px faint") even
// though Heatmap renders them as plain <text> rather than through the Axis* primitives.
const LABEL_FONT_FAMILY = 'var(--basalt-font-mono)'

// Left gutter for row labels, bottom gutter for column labels, top breathing room.
const PAD_LEFT = 44
const PAD_BOTTOM = 24
const PAD_TOP = 8

/** Line box of one category label at `fontPx` — the vertical room a row label needs, and so the
 * pitch below which the row labels thin (`thinLabels`). Same 1.35em line box `autoMargin` uses. */
const labelLineHeight = (fontPx: number): number => Math.ceil(fontPx * 1.35)
// Height of the optional gradient legend strip (+ its label line).
const LEGEND_H = 8
const LEGEND_LABEL_H = 16

/**
 * Category × category intensity grid. Each cell is a rounded rect filled with the base
 * color at an opacity derived from its value; empty cells stay a faint neutral track.
 * Generalizes argo's day-of-week × hour-of-day heatmap. Categorical axes are rendered as
 * plain themed `<text>` (cells are not date-categorical, so there's no shared cursor here) —
 * per-cell hover drives the local tooltip directly. Painting them outside the `Axis*` primitives
 * does NOT exempt them from §1's measured law: both runs thin through {@link thinLabels} and the
 * right gutter reserves half the widest column label, so no two painted labels overlap and the
 * last one cannot clip.
 *
 * Composes `ChartFrame` purely for measuring (`height`/`aspectRatio`/`fill`, the same three
 * sizing modes every other kind exposes) — `legend={false}` and an empty `series` opt out of
 * `ChartFrame`'s own derived legend, since Heatmap already ships its own gradient strip.
 */
function HeatmapInner<T>(props: HeatmapProps<T>) {
  // F-ERR-1: name the component and the prop. Without this a missing accessor surfaces
  // from inside visx as `undefined is not a function`, which `BasaltErrorBoundary`
  // swallows into a blank subtree that names nothing.
  assertRequiredProps('Heatmap', props, ['data', 'getRow', 'getCol', 'getValue'])
  const { chartId, height, aspectRatio, fill, ariaLabel, isPending, state, className, style } =
    props

  return (
    <ChartFrame
      series={[]}
      chartId={chartId}
      legend={false}
      {...(height !== undefined && { height })}
      {...(aspectRatio !== undefined && { aspectRatio })}
      {...(fill !== undefined && { fill })}
      {...(ariaLabel !== undefined && { ariaLabel })}
      {...(isPending !== undefined && { isPending })}
      {...(state !== undefined && { state })}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    >
      {(plot) => <HeatmapPlot {...props} plot={plot} />}
    </ChartFrame>
  )
}

type HeatmapPlotProps<T> = HeatmapProps<T> & {
  plot: { width: number; height: number; hidden: ReadonlySet<string> }
}

/** The measured plot — split from {@link HeatmapInner} so the grid only draws once `ChartFrame`
 * has resolved a non-empty plot rect. */
function HeatmapPlot<T>(props: HeatmapPlotProps<T>) {
  const {
    data,
    plot,
    chartId,
    getRow,
    getCol,
    getValue,
    rows: rowsProp,
    cols: colsProp,
    color = VX.line,
    intensity = (value, max) => (max > 0 ? value / max : 0),
    cellGap = 2,
    cellRadius = 2,
    formatValue = (v) => `${v}`,
    rowLabel = (r) => r,
    colLabel = (c) => c,
    renderTooltip,
    legend,
  } = props
  const { width, height } = plot

  // The row/column labels and the gradient legend's endpoints read like axis ticks, so they take
  // the tier's tick font for the same reason `Axes.tsx` does — a 360px heatmap that painted its
  // categories at the desktop size would be the one chart still ignoring §8.
  const { axisFont } = useChartTierMetrics()

  const [tip, setTip] = useState<HeatmapTip | null>(null)

  const rows = useMemo(() => rowsProp ?? firstSeen(data, getRow), [rowsProp, data, getRow])
  const cols = useMemo(() => colsProp ?? firstSeen(data, getCol), [colsProp, data, getCol])

  // Lookup keyed by cellKey(row, col) → value for O(1) cell fill.
  const { lookup, max } = useMemo(() => {
    const map = new Map<string, number>()
    let m = 0
    for (const d of data) {
      const v = getValue(d)
      map.set(cellKey(getRow(d), getCol(d)), v)
      if (v > m) m = v
    }
    return { lookup: map, max: m }
  }, [data, getRow, getCol, getValue])

  const rowLabels = useMemo(() => rows.map(rowLabel), [rows, rowLabel])
  const colLabels = useMemo(() => cols.map(colLabel), [cols, colLabel])

  const legendH = legend ? LEGEND_H + LEGEND_LABEL_H : 0
  // The last column label is CENTRED on the last cell, so half of it hangs past the grid — the
  // same reason `autoMargin` reserves half the widest x label on the right. Measured, not a
  // constant: at 390px `19:00` used to print straight off the SVG's own clip edge.
  const padRight = Math.ceil(maxTextWidth(colLabels, axisFont) / 2)
  const gridW = Math.max(0, width - PAD_LEFT - padRight)
  const gridH = Math.max(0, height - PAD_TOP - PAD_BOTTOM - legendH)
  const cellW = cols.length > 0 ? gridW / cols.length : 0
  const cellH = rows.length > 0 ? gridH / rows.length : 0
  const legendGradientId = `${chartId}-heat-legend`

  // §1's measured law, applied to the one kind that paints its labels as plain `<text>` rather
  // than through the `Axis*` primitives: a label every `ceil(labelPx / cellPitch)` bands, so two
  // painted neighbours can never overlap. Columns thin horizontally by the widest label, rows
  // vertically by the line box.
  const keptCols = useMemo(
    () => thinLabels(colLabels, cellW, xLabelPxFor(colLabels, axisFont)),
    [colLabels, cellW, axisFont],
  )
  const keptRows = useMemo(
    () => thinLabels(rowLabels, cellH, labelLineHeight(axisFont)),
    [rowLabels, cellH, axisFont],
  )

  const show = (row: string, col: string, value: number, event: PointerEvent<SVGRectElement>) => {
    setTip({ row, col, value, anchor: { x: event.clientX, y: event.clientY } })
  }
  const hide = () => setTip(null)

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
        <Group left={PAD_LEFT} top={PAD_TOP}>
          {rows.flatMap((row, ri) =>
            cols.map((col, ci) => {
              const value = lookup.get(cellKey(row, col))
              const has = value !== undefined
              const cellFill = has ? alpha(color, intensity(value, max)) : alpha(VX.neutral, 0.04)
              return (
                <rect
                  key={cellKey(row, col)}
                  x={ci * cellW + cellGap / 2}
                  y={ri * cellH + cellGap / 2}
                  width={Math.max(0, cellW - cellGap)}
                  height={Math.max(0, cellH - cellGap)}
                  rx={cellRadius}
                  fill={cellFill}
                  style={{ cursor: has ? 'pointer' : 'default' }}
                  onPointerMove={(e) => has && show(row, col, value, e)}
                  onPointerLeave={hide}
                  onPointerCancel={hide}
                />
              )
            }),
          )}
        </Group>

        {/* Row labels (left). */}
        <Group left={0} top={PAD_TOP}>
          {rows.map((row, ri) =>
            keptRows.has(ri) ? (
              <text
                key={row}
                x={PAD_LEFT - 6}
                y={ri * cellH + cellH / 2 + 4}
                textAnchor="end"
                fontSize={axisFont}
                fontFamily={LABEL_FONT_FAMILY}
                fill={VX.faint}
              >
                {rowLabels[ri]}
              </text>
            ) : null,
          )}
        </Group>

        {/* Column labels (bottom). */}
        <Group left={PAD_LEFT} top={PAD_TOP + gridH}>
          {cols.map((col, ci) =>
            keptCols.has(ci) ? (
              <text
                key={col}
                x={ci * cellW + cellW / 2}
                y={16}
                textAnchor="middle"
                fontSize={axisFont}
                fontFamily={LABEL_FONT_FAMILY}
                fill={VX.faint}
              >
                {colLabels[ci]}
              </text>
            ) : null,
          )}
        </Group>

        {/* Optional gradient legend strip below the grid. */}
        {legend && (
          <Group left={PAD_LEFT} top={PAD_TOP + gridH + PAD_BOTTOM}>
            <defs>
              <linearGradient id={legendGradientId} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor={alpha(color, 0.08)} />
                <stop offset="100%" stopColor={color} />
              </linearGradient>
            </defs>
            <rect width={gridW} height={LEGEND_H} rx={2} fill={`url(#${legendGradientId})`} />
            <text
              x={0}
              y={LEGEND_H + 12}
              textAnchor="start"
              fontSize={axisFont}
              fontFamily={LABEL_FONT_FAMILY}
              fill={VX.faint}
            >
              {legend.min}
            </text>
            <text
              x={gridW}
              y={LEGEND_H + 12}
              textAnchor="end"
              fontSize={axisFont}
              fontFamily={LABEL_FONT_FAMILY}
              fill={VX.faint}
            >
              {legend.max}
            </text>
          </Group>
        )}
      </svg>

      {tip !== null && (
        <ChartTooltipFloat anchor={tip.anchor}>
          <TooltipHeader date={rowLabel(tip.row)} label={colLabel(tip.col)} />
          <TooltipBody>
            <TooltipRow
              color={alpha(color, 0.9)}
              shape="bar"
              label="Value"
              value={formatValue(tip.value)}
            />
            {renderTooltip?.(tip)}
          </TooltipBody>
        </ChartTooltipFloat>
      )}
    </div>
  )
}

/**
 * Hand-memoized: React Compiler does not process the shipped dist, so the hot Heatmap kind is
 * wrapped in `React.memo` to retain auto-memoization (parity with ZonedLine / Bars).
 */
const HeatmapMemo = memo(HeatmapInner)
// Without it every kind reads as `Memo` in React DevTools (audit A16) — a profiler flame
// graph of nine identically-named nodes names nothing.
HeatmapMemo.displayName = 'Heatmap'
export const Heatmap = HeatmapMemo as typeof HeatmapInner
