/**
 * `Heatmap` — a band × band matrix of `cell` marks (`docs/V2-SPEC.md` § 9.3). Intensity is ABSOLUTE:
 * the color scale spans `domain` (default `[0, max]`), never each row's own range, so two grids on
 * one page read against the same ink. A cell with a datum but a `null` value is ABSENT: a flat
 * `--vx-neutral` fill, no hatch; a cell the consumer names a `states` entry for (failed, idle, …)
 * draws that state's flat fill instead, legended next to the gradient. A position with NO datum is
 * inert: it paints the absent fill and answers no pointer — no tooltip, no snap to a neighbour.
 * There is no cursor and no crosshair — the tooltip is per cell, its rows are `tooltip.rows(d)` data.
 */
import { colorGradientLegend } from '@tanstack/charts/legend'
import { cell } from '@tanstack/charts/rect'
import { scaleBand } from '@tanstack/charts/scales/band'
import { tooltip as tooltipHost } from '@tanstack/charts/tooltip'
import { portal } from '@tanstack/charts/tooltip/portal'
import type { ChartBuildContext, ChartPoint, StoredChartSpec } from '@tanstack/charts/types/core'
import { scaleQuantize } from 'd3-scale'
import { useId, useMemo } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { BasaltProps } from '../common/props'
import { alpha, VX } from '../tokens'
import { resolveContainerClass } from '../tokens/size-classes'
import { engineRow, strideTicks } from './compile'
import type { CartesianDefinition } from './compile'
import { resolveNamedState } from './band-fold'
import { ABSENT_OPACITY, RAMP_LEVELS, rampOpacities } from './heatmap-fill'
import { ChartEngine, idPrefixOf } from './host'
import { ChartLegend } from './legend'
import { useCoarsePointer } from '../common/use-media-query'
import { HEIGHT_MAX, HEIGHT_MIN } from './box'
import { ChartPlaceholder, resolveChartState } from './state'
import { AXIS_LINE, CHART_THEME } from './theme'
import type { ChartSeries, ChartState, ChartTooltipRow, ResponsiveChartHeight } from './types'

/** A named cell state: its flat fill, its legend entry and its tooltip reading. */
export type HeatmapState<K extends string = string> = {
  key: K
  label: string
  /** A `VX.*` ref or a series token. */
  color: string
  /** Default 1. */
  fillOpacity?: number | undefined
}

export type HeatmapProps<T, K extends string = string> = BasaltProps & {
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
  rows?: readonly string[] | undefined
  cols?: readonly string[] | undefined
  /** The ink at full intensity, a `VX.*` ref or a series token. Default `VX.line`. */
  color?: string | undefined
  /** The value range the color scale spans. Default `[0, max]` of the data. */
  domain?: readonly [number, number] | undefined
  /** Tooltip value format. Default: the number as-is. */
  formatValue?: ((v: number) => string) | undefined
  /**
   * The gradient legend's two end labels. Default: `formatValue`. The engine labels only the ends
   * (a 240px ramp), so a unit-bearing `formatValue` ("50.0% below fastest hour") overlaps its
   * neighbour there — pass a compact form ("50%") when the tooltip's reads long.
   */
  formatLegend?: ((v: number) => string) | undefined
  /**
   * The state a datum is in, a `states` key, or `undefined` for the plain value ramp. A stated cell
   * draws its state's flat fill whatever its value. Memoize it: a new function recompiles the chart.
   */
  getState?: ((d: T) => K | undefined) | undefined
  /** The named states, legended after the gradient (hidden with `legend={false}`). */
  states?: readonly HeatmapState<K>[] | undefined
  /** Band tick and tooltip header labels. Default: the band key. */
  formatRow?: ((row: string) => string) | undefined
  formatCol?: ((col: string) => string) | undefined
  /** `false` hides the gradient legend; `label` titles it. */
  legend?: false | { label?: string | undefined } | undefined
  /** Rows after the value row, per cell (a sample count, a failure reason). Called with the datum. */
  tooltip?:
    | (
        | false
        | {
            rows?: ((d: T) => readonly ChartTooltipRow[]) | undefined
            /** The value row's label. Default "Value". */
            valueLabel?: string | undefined
          }
      )
    | undefined
  /** A fixed height, or one per container class. Default: by row count (160–420px). */
  height?: number | ResponsiveChartHeight | undefined
  /** Fill the parent's height instead. Overrides `height`. CSS-owned like every other kind's box
   * (`ChartBox`, no measuring, SSR-stable), so the parent needs a definite CSS height — a grid or
   * flex stretch, `h-full`, an explicit height — which no kind can read off an auto-height parent. */
  matchHeight?: boolean | undefined
  state?: ChartState | undefined
}

const ROW_PITCH = 26
const CHROME = 64
const CELL_INSET = 1

/** One grid position. `id` is its row-major index: the mark key, so no row/col pair can collide. */
type Cell<T> = {
  id: number
  row: string
  col: string
  value: number | null
  datum: T | undefined
  state: string | undefined
}

const identityLabel = (band: string): string => band

const firstSeen = (keys: Iterable<string>): string[] => [...new Set(keys)]

const ramp = (color: string): string[] => rampOpacities().map((a) => alpha(color, a))

const noneHidden: ReadonlySet<string> = new Set()
const noop = (): void => {}

const noStates: readonly HeatmapState[] = []

const fillStyle: CSSProperties = { position: 'relative', height: '100%', minHeight: HEIGHT_MIN }

export function Heatmap<T, K extends string = string>(props: HeatmapProps<T, K>): ReactElement {
  const {
    ariaLabel,
    data,
    getRow,
    getCol,
    getValue,
    color = VX.line,
    domain,
    formatValue = String,
    formatLegend = formatValue,
    getState,
    states = noStates as readonly HeatmapState<K>[],
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
  const valueLabel = (tooltip === false ? undefined : tooltip?.valueLabel) ?? 'Value'
  const rows = useMemo(() => props.rows ?? firstSeen(data.map(getRow)), [props.rows, data, getRow])
  const cols = useMemo(() => props.cols ?? firstSeen(data.map(getCol)), [props.cols, data, getCol])
  const statedHeight =
    height ?? Math.min(Math.max(rows.length * ROW_PITCH + CHROME, HEIGHT_MIN), HEIGHT_MAX)
  const coarse = useCoarsePointer()
  const boxHeight = matchHeight ? 'fill' : statedHeight

  // Resolved per datum below; a key naming nothing throws in dev, paints the ramp in production.
  const stateKeys = useMemo(() => states.map((s) => s.key), [states])
  const stateByKey = useMemo(
    () => new Map<string, HeatmapState<K>>(states.map((s) => [s.key, s])),
    [states],
  )

  const definition = useMemo<CartesianDefinition>(() => {
    const byBand = new Map<string, Map<string, T>>()
    for (const d of data) {
      const row = getRow(d)
      const inRow = byBand.get(row) ?? new Map<string, T>()
      inRow.set(getCol(d), d)
      byBand.set(row, inRow)
    }
    // One pass: split the grid into measured, stated, absent-with-a-datum and absent-with-none.
    const present: Cell<T>[] = []
    const stated = new Map<string, Cell<T>[]>()
    const absentWithDatum: Cell<T>[] = []
    const absentEmpty: Cell<T>[] = []
    let max = 0
    for (const [r, row] of rows.entries()) {
      for (const [c, col] of cols.entries()) {
        const datum = byBand.get(row)?.get(col)
        const raw = datum === undefined ? null : getValue(datum)
        const value = raw !== null && Number.isFinite(raw) ? raw : null
        const stateKey =
          datum === undefined || getState === undefined
            ? undefined
            : resolveNamedState('Heatmap', 'Heatmap.getState', getState(datum), stateKeys)
        const cellAt: Cell<T> = { id: r * cols.length + c, row, col, datum, value, state: stateKey }
        if (stateKey !== undefined) {
          stated.set(stateKey, [...(stated.get(stateKey) ?? []), cellAt])
        } else if (value !== null) {
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
        const cls = resolveContainerClass(width)
        const tickLabels = {
          fontSize: cls === 'wide' ? VX.text.micro : VX.text.nano,
          opacity: 1,
          thin: true,
        }
        const marks = [
          // Inert, not decorative: it must still win the hit test, so a pointer over an empty
          // position lands on THIS cell (whose tooltip is empty) instead of snapping to a neighbour.
          cell(absentEmpty, {
            id: 'absent-empty',
            x: 'col',
            y: 'row',
            fill: VX.neutral,
            fillOpacity: ABSENT_OPACITY,
            inset: CELL_INSET,
            key: 'id',
          }),
          cell(absentWithDatum, {
            id: 'absent',
            x: 'col',
            y: 'row',
            fill: VX.neutral,
            fillOpacity: ABSENT_OPACITY,
            inset: CELL_INSET,
            key: 'id',
          }),
          ...[...stated].map(([key, group]) => {
            const named = stateByKey.get(key)
            return cell(group, {
              id: `state:${key}`,
              x: 'col',
              y: 'row',
              fill: named?.color ?? VX.neutral,
              ...(named?.fillOpacity !== undefined && { fillOpacity: named.fillOpacity }),
              inset: CELL_INSET,
              key: 'id',
            })
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
                ticks: {
                  values: strideTicks(cols, cls),
                  format: (v) => formatCol(String(v)),
                  ...ticks,
                },
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
                steps: RAMP_LEVELS,
                format: formatLegend,
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
              if (!point || !c || c.datum === undefined) return { rows: [] }
              const extra = c.datum === undefined ? [] : (tooltipRows?.(c.datum) ?? [])
              const named = c.state === undefined ? undefined : stateByKey.get(c.state)
              const value: readonly ChartTooltipRow[] = named
                ? [{ label: valueLabel, value: named.label, color: named.color }]
                : c.value === null
                  ? [{ label: valueLabel, value: 'No data' }]
                  : [
                      {
                        label: valueLabel,
                        value: formatValue(c.value),
                        ...(point.color && { color: point.color }),
                      },
                    ]
              return { title: header(c), rows: [...value, ...extra].map(engineRow) }
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
    formatLegend,
    getState,
    stateKeys,
    stateByKey,
    valueLabel,
    formatRow,
    formatCol,
    legendLabel,
    showLegend,
    showTooltip,
    tooltipRows,
  ])

  const legendSeries = useMemo<ChartSeries<T>[]>(
    () =>
      states.map((s) => ({
        key: s.key,
        label: s.label,
        color: s.color,
        mark: 'bar' as const,
        ...(s.fillOpacity !== undefined && { fillOpacity: s.fillOpacity }),
        getValue: () => null,
      })),
    [states],
  )
  const resolved = resolveChartState(state)
  return (
    <div
      data-basalt-chart=""
      {...(className !== undefined && { className })}
      style={matchHeight ? { ...fillStyle, ...style } : style}
    >
      {resolved === null ? (
        <ChartEngine
          definition={definition}
          ariaLabel={ariaLabel}
          height={boxHeight}
          idPrefix={idPrefixOf(chartId)}
          coarse={coarse}
        />
      ) : (
        <ChartPlaceholder state={state} height={boxHeight} />
      )}
      {resolved === null && showLegend && states.length > 0 && (
        <ChartLegend
          series={legendSeries}
          hidden={noneHidden}
          mode="chips"
          groups={false}
          toggle={false}
          onToggle={noop}
          onHighlight={noop}
        />
      )}
    </div>
  )
}
