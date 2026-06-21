import { Group } from '@visx/group'
import type { ReactNode } from 'react'
import { memo, useMemo } from 'react'
import {
  ChartTooltip,
  TooltipBody,
  TooltipHeader,
  TooltipRow,
  useTooltipStyles,
} from '../primitives/ChartTooltip'
import { useChartTooltip } from '../hooks/useChartTooltip'
import { VX, alpha } from '../../tokens'

/** A single resolved heatmap cell — the unit the tooltip and hover operate on. */
type HeatmapCell = { row: string; col: string; value: number }

export type HeatmapProps<T> = {
  data: T[]
  width: number
  height: number
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

// Left gutter for row labels, bottom gutter for column labels, top breathing room.
const PAD_LEFT = 44
const PAD_BOTTOM = 24
const PAD_TOP = 8
// Height of the optional gradient legend strip (+ its label line).
const LEGEND_H = 8
const LEGEND_LABEL_H = 16

/**
 * Category × category intensity grid. Each cell is a rounded rect filled with the base
 * color at an opacity derived from its value; empty cells stay a faint neutral track.
 * Generalizes argo's day-of-week × hour-of-day heatmap. Categorical axes are rendered as
 * plain themed `<text>` (cells are not date-categorical, so no useHoverSync / shared
 * cursor) — per-cell hover drives the local tooltip directly.
 */
function HeatmapInner<T>(props: HeatmapProps<T>) {
  const {
    data,
    width,
    height,
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

  const tooltipStyles = useTooltipStyles()
  const { tip, show, hide, tooltipRef } = useChartTooltip<HeatmapCell>()

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

  const legendH = legend ? LEGEND_H + LEGEND_LABEL_H : 0
  const gridW = Math.max(0, width - PAD_LEFT)
  const gridH = Math.max(0, height - PAD_TOP - PAD_BOTTOM - legendH)
  const cellW = cols.length > 0 ? gridW / cols.length : 0
  const cellH = rows.length > 0 ? gridH / rows.length : 0
  const legendGradientId = `${chartId}-heat-legend`

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
        <Group left={PAD_LEFT} top={PAD_TOP}>
          {rows.flatMap((row, ri) =>
            cols.map((col, ci) => {
              const value = lookup.get(cellKey(row, col))
              const has = value !== undefined
              const fill = has ? alpha(color, intensity(value, max)) : alpha(VX.neutral, 0.04)
              return (
                <rect
                  key={cellKey(row, col)}
                  x={ci * cellW + cellGap / 2}
                  y={ri * cellH + cellGap / 2}
                  width={Math.max(0, cellW - cellGap)}
                  height={Math.max(0, cellH - cellGap)}
                  rx={cellRadius}
                  fill={fill}
                  style={{ cursor: has ? 'pointer' : 'default' }}
                  onMouseMove={(e) => has && show({ row, col, value }, e)}
                  onMouseLeave={hide}
                />
              )
            }),
          )}
        </Group>

        {/* Row labels (left). */}
        <Group left={0} top={PAD_TOP}>
          {rows.map((row, ri) => (
            <text
              key={row}
              x={PAD_LEFT - 6}
              y={ri * cellH + cellH / 2 + 4}
              textAnchor="end"
              fontSize={VX.axisFont}
              fill={VX.axis}
            >
              {rowLabel(row)}
            </text>
          ))}
        </Group>

        {/* Column labels (bottom). */}
        <Group left={PAD_LEFT} top={PAD_TOP + gridH}>
          {cols.map((col, ci) => (
            <text
              key={col}
              x={ci * cellW + cellW / 2}
              y={16}
              textAnchor="middle"
              fontSize={VX.axisFont}
              fill={VX.axis}
            >
              {colLabel(col)}
            </text>
          ))}
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
            <text x={0} y={LEGEND_H + 12} textAnchor="start" fontSize={VX.axisFont} fill={VX.axis}>
              {legend.min}
            </text>
            <text
              x={gridW}
              y={LEGEND_H + 12}
              textAnchor="end"
              fontSize={VX.axisFont}
              fill={VX.axis}
            >
              {legend.max}
            </text>
          </Group>
        )}
      </svg>

      <ChartTooltip tip={tip} tooltipRef={tooltipRef} styles={tooltipStyles}>
        {tip !== null && (
          <>
            <TooltipHeader date={rowLabel(tip.data.row)} label={colLabel(tip.data.col)} />
            <TooltipBody>
              <TooltipRow
                color={alpha(color, 0.9)}
                shape="bar"
                label="Value"
                value={formatValue(tip.data.value)}
              />
              {renderTooltip?.(tip.data)}
            </TooltipBody>
          </>
        )}
      </ChartTooltip>
    </div>
  )
}

/**
 * Hand-memoized: React Compiler does not process the shipped dist, so the hot Heatmap kind is
 * wrapped in `React.memo` to retain auto-memoization (parity with ZonedLine / Bars).
 */
export const Heatmap = memo(HeatmapInner) as typeof HeatmapInner
