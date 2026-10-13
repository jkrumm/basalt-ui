/**
 * `Heatmap` — a band × band matrix of `cell` marks (`docs/V2-SPEC.md` § 9.3). Intensity is ABSOLUTE:
 * the color scale spans `domain` (default `[0, max]`), never each row's own range, so two grids on
 * one page read against the same ink. A cell with no datum, or a `null` value, is ABSENT: a flat
 * `--vx-neutral` fill, no hatch. There is no cursor and no crosshair — the tooltip is per cell, its
 * rows are `tooltip.rows(d)` data.
 */
import { colorGradientLegend } from '@tanstack/charts/legend'
import { decorative } from '@tanstack/charts/mark/decorative'
import { cell } from '@tanstack/charts/rect'
import { scaleBand } from '@tanstack/charts/scales/band'
import { tooltip as tooltipHost } from '@tanstack/charts/tooltip'
import { portal } from '@tanstack/charts/tooltip/portal'
import type { ChartBuildContext, ChartPoint, StoredChartSpec } from '@tanstack/charts/types/core'
import { scaleQuantize } from 'd3-scale'
import { useCallback, useId, useMemo, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import type { BasaltProps } from '../common/props'
import { alpha, VX } from '../tokens'
import { resolveContainerClass } from '../tokens/size-classes'
import type { CartesianDefinition } from './compile'
import { ChartEngine } from './host'
import { useChartSize } from './sizing'
import { ChartPlaceholder, resolveChartState } from './state'
import { AXIS_LINE, CHART_THEME } from './theme'
import type { ChartState, ChartTooltipRow, ResponsiveChartHeight } from './types'

export type HeatmapProps<T> = BasaltProps & {
  /** The accessible name. Required. */
  ariaLabel: string
  data: readonly T[]
  /** The y band (a row) of a datum. */
  getRow: (d: T) => string
  /** The x band (a column) of a datum. */
  getCol: (d: T) => string
  /** The intensity; `null` is an absent cell (flat neutral), never a zero. */
  getValue: (d: T) => number | null
  /** Explicit band order. Default: first seen in `data`. */
  rows?: readonly string[]
  cols?: readonly string[]
  /** The ink at full intensity, a `VX.*` ref or a series token. Default `VX.line`. */
  color?: string
  /** The value range the color scale spans. Default `[0, max]` of the data. */
  domain?: readonly [number, number]
  /** Tooltip, legend-end and `aria` value format. Default: the number as-is. */
  formatValue?: (v: number) => string
  /** Band tick and tooltip header labels. Default: the band key. */
  formatRow?: (row: string) => string
  formatCol?: (col: string) => string
  /** `false` hides the gradient legend; `label` titles it. */
  legend?: false | { label?: string }
  /** Rows after the value row, per cell (a sample count, a failure reason). Called with the datum. */
  tooltip?: false | { rows?: (d: T) => readonly ChartTooltipRow[] }
  /** A fixed height, or one per container class. Default: by row count (160–420px). */
  height?: number | ResponsiveChartHeight
  /** Fill the parent's height instead (the parent needs a definite height). Overrides `height`. */
  matchHeight?: boolean
  state?: ChartState
}

/** Intensity steps: quantized, so the gradient legend and the cells are the same ramp. */
const LEVELS = 8
const MIN_LEVEL = 0.14
const ROW_PITCH = 26
const CHROME = 64
// The default height law's bounds, mirrored from `sizing.ts` (which does not export them).
const HEIGHT_MIN = 160
const HEIGHT_MAX = 420
const CELL_INSET = 1

/** One grid position. `id` is its row-major index: the mark key, so no row/col pair can collide. */
type Cell<T> = { id: number; row: string; col: string; value: number | null; datum: T | undefined }

const identityLabel = (band: string): string => band

const firstSeen = (keys: Iterable<string>): string[] => [...new Set(keys)]

const ramp = (color: string): string[] =>
  Array.from({ length: LEVELS }, (_, i) =>
    alpha(color, MIN_LEVEL + ((1 - MIN_LEVEL) * i) / (LEVELS - 1)),
  )

/** The measured height of the element `ref` lands on, `0` until measured. */
function useMeasuredHeight(enabled: boolean): { ref: (el: HTMLElement | null) => void; h: number } {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [h, setH] = useState(0)
  useIsomorphicLayoutEffect(() => {
    if (!enabled || !node) return
    setH(Math.round(node.getBoundingClientRect().height))
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setH(Math.round(entry.contentRect.height))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [node, enabled])
  return { ref: useCallback((el: HTMLElement | null) => setNode(el), []), h }
}

const fillStyle: CSSProperties = { position: 'relative', height: '100%', minHeight: HEIGHT_MIN }

export function Heatmap<T>(props: HeatmapProps<T>): ReactElement {
  const {
    ariaLabel,
    data,
    getRow,
    getCol,
    getValue,
    color = VX.line,
    domain,
    formatValue = String,
    formatRow = identityLabel,
    formatCol = identityLabel,
    legend,
    tooltip,
    height,
    matchHeight = false,
    state,
    className,
    style,
  } = props
  const chartId = useId()
  // Primitives, so the definition does not rebuild for a fresh `{ label }` / `{ rows }` literal.
  const showLegend = legend !== false
  const legendLabel = legend === false ? undefined : legend?.label
  const showTooltip = tooltip !== false
  const tooltipRows = tooltip === false ? undefined : tooltip?.rows
  const rows = useMemo(() => props.rows ?? firstSeen(data.map(getRow)), [props.rows, data, getRow])
  const cols = useMemo(() => props.cols ?? firstSeen(data.map(getCol)), [props.cols, data, getCol])
  const fixedHeight =
    height ?? Math.min(Math.max(rows.length * ROW_PITCH + CHROME, HEIGHT_MIN), HEIGHT_MAX)
  const { ref, size, coarse } = useChartSize(matchHeight ? undefined : fixedHeight)
  const fill = useMeasuredHeight(matchHeight)
  const measureHeight = fill.ref
  const rootRef = useCallback(
    (el: HTMLElement | null) => {
      ref(el)
      if (matchHeight) measureHeight(el)
    },
    [ref, measureHeight, matchHeight],
  )
  const chartHeight = matchHeight && fill.h > 0 ? fill.h : size.height

  const definition = useMemo<CartesianDefinition>(() => {
    const byBand = new Map<string, Map<string, T>>()
    for (const d of data) {
      const row = getRow(d)
      const inRow = byBand.get(row) ?? new Map<string, T>()
      inRow.set(getCol(d), d)
      byBand.set(row, inRow)
    }
    // One pass: split the grid into measured, absent-with-a-datum and absent-with-none.
    const present: Cell<T>[] = []
    const absentWithDatum: Cell<T>[] = []
    const absentEmpty: Cell<T>[] = []
    let max = 0
    for (const [r, row] of rows.entries()) {
      for (const [c, col] of cols.entries()) {
        const datum = byBand.get(row)?.get(col)
        const raw = datum === undefined ? null : getValue(datum)
        const value = raw !== null && Number.isFinite(raw) ? raw : null
        const cellAt: Cell<T> = { id: r * cols.length + c, row, col, datum, value }
        if (value !== null) {
          present.push(cellAt)
          max = Math.max(max, value)
        } else if (datum === undefined) absentEmpty.push(cellAt)
        else absentWithDatum.push(cellAt)
      }
    }
    const [lo, hi] = domain ?? [0, max]
    // A flat or inverted domain would map every value to one step; widen it to a unit.
    const scale = scaleQuantize<string>()
      .domain([lo, hi > lo ? hi : lo + 1])
      .range(ramp(color))
    const header = (c: Cell<T>): string => `${formatRow(c.row)} · ${formatCol(c.col)}`

    return {
      chart: ({ width }: ChartBuildContext): StoredChartSpec => {
        const ticks = { line: false as const, size: 0 }
        const tickLabels = {
          fontSize: resolveContainerClass(width) === 'wide' ? VX.text.micro : VX.text.nano,
          opacity: 1,
          thin: true,
        }
        const marks = [
          decorative(
            cell(absentEmpty, {
              id: 'absent-empty',
              x: 'col',
              y: 'row',
              fill: VX.neutral,
              fillOpacity: 0.12,
              inset: CELL_INSET,
            }),
          ),
          cell(absentWithDatum, {
            id: 'absent',
            x: 'col',
            y: 'row',
            fill: VX.neutral,
            fillOpacity: 0.12,
            inset: CELL_INSET,
            key: 'id',
          }),
          cell(present, {
            id: 'cells',
            x: 'col',
            y: 'row',
            color: 'value',
            inset: CELL_INSET,
            key: 'id',
          }),
        ]
        return {
          marks,
          scales: {
            x: {
              scale: scaleBand<string>().domain(cols).paddingInner(0).paddingOuter(0),
              axis: {
                line: AXIS_LINE,
                ticks: { values: cols, format: (v) => formatCol(String(v)), ...ticks },
                tickLabels,
              },
            },
            y: {
              scale: scaleBand<string>().domain(rows).paddingInner(0).paddingOuter(0),
              axis: {
                line: false,
                ticks: { values: rows, format: (v) => formatRow(String(v)), ...ticks },
                tickLabels,
              },
            },
          },
          color: {
            scale,
            ...(showLegend && {
              legend: colorGradientLegend({
                steps: LEVELS,
                format: formatValue,
                placement: 'bottom',
                ...(legendLabel !== undefined && { label: legendLabel }),
              }),
            }),
          },
          theme: CHART_THEME,
        }
      },
      tooltip: showTooltip
        ? {
            use: tooltipHost,
            portal,
            content: (points: readonly ChartPoint[]) => {
              const point = points[0]
              const c = point?.datum as Cell<T> | undefined
              if (!point || !c) return { rows: [] }
              const extra = c.datum === undefined ? [] : (tooltipRows?.(c.datum) ?? [])
              const value: readonly ChartTooltipRow[] =
                c.value === null
                  ? [{ label: 'Value', value: 'No data' }]
                  : [
                      {
                        label: 'Value',
                        value: formatValue(c.value),
                        ...(point.color && { color: point.color }),
                      },
                    ]
              return { title: header(c), rows: [...value, ...extra] }
            },
          }
        : false,
    }
  }, [
    data,
    rows,
    cols,
    getRow,
    getCol,
    getValue,
    color,
    domain,
    formatValue,
    formatRow,
    formatCol,
    legendLabel,
    showLegend,
    showTooltip,
    tooltipRows,
  ])

  const resolved = resolveChartState(state)
  return (
    <div
      ref={rootRef}
      data-basalt-chart=""
      {...(className !== undefined && { className })}
      style={matchHeight ? { ...fillStyle, ...style } : style}
    >
      {resolved === null ? (
        <ChartEngine
          definition={definition}
          ariaLabel={ariaLabel}
          height={chartHeight}
          idPrefix={`basalt-chart-${chartId.replaceAll(/[^\w-]/g, '')}`}
          coarse={coarse}
        />
      ) : (
        <ChartPlaceholder state={state} height={chartHeight} />
      )}
    </div>
  )
}
