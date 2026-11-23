/**
 * `Heatmap` — a band × band matrix of `cell` marks (`docs/V2-SPEC.md` § 9.3). Intensity is ABSOLUTE:
 * the color scale spans `domain` (default `[0, max]`), never each row's own range, so two grids on
 * one page read against the same ink. A cell with a datum but a `null` value is ABSENT: a flat
 * `--basalt-line` fill, no hatch; a cell the consumer names a `states` entry for (failed, idle, …)
 * draws that state's flat fill instead, legended next to the gradient. A position with NO datum is
 * inert: it paints the absent fill and answers no pointer — no tooltip, no snap to a neighbour.
 * There is no cursor and no crosshair — the tooltip is per cell, its rows are `tooltip.rows(d)` data.
 */
import { colorGradientLegend } from '@tanstack/charts/legend'
import { decorative } from '@tanstack/charts/mark/decorative'
import { cell } from '@tanstack/charts/rect'
import { text } from '@tanstack/charts/text'
import { scaleBand } from '@tanstack/charts/scales/band'
import type { ChartBuildContext, ChartPoint, StoredChartSpec } from '@tanstack/charts/types/core'
import { scaleQuantize } from 'd3-scale'
import { useId, useMemo } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { BasaltProps } from '../../common/props'
import { alpha, BASALT } from '../../tokens'
import { resolveContainerClass } from '../../tokens/size-classes'
import type { ContainerClass } from '../../tokens/size-classes'
import { captionWidth } from '../axis-gaps'
import { engineRow, strideTicks } from '../core/compile'
import type { CartesianDefinition } from '../core/compile'
import { GLYPH_MIN_PX, glyphOf, resolveNamedState } from './band-fold'
import type { NamedChartState } from './band-fold'
import { ABSENT_OPACITY, RAMP_LEVELS, RAMP_OPACITIES } from './heatmap-fill'
import { flatInk, stateInk } from './heatmap-ink'
import { engineTooltip } from '../core/cursor'
import { cardPortal } from '../core/portal'
import { ChartEngine, idPrefixOf } from '../host'
import { ChartLegend } from '../legend'
import type { GlyphKey } from '../legend'
import { useCoarsePointer } from '../../common/use-media-query'
import { HEIGHT_MAX, HEIGHT_MIN } from '../box'
import { ChartPlaceholder, resolveChartState } from '../state'
import { AXIS_LINE, CHART_THEME, CV, CV_STATUS, DIMMED } from '../core/theme'
import type { ChartFocus, ChartName } from '../contract'
import { chartName } from '../chart-name'
import { engineFocusHandler, hostFocusProps } from '../focus'
import type { ChartSeries, ChartState, ChartTooltipRow, ResponsiveChartHeight } from '../types'
import type { Empty } from '../../core/phase'
import type { Phase, QueryStateLike } from '../../core/ports'
import { toChartState } from './cartesian-adapt'

/**
 * A named cell state, the same base `BandStrip`'s `states` use (`NamedChartState`): `color` and
 * `fillOpacity` (default 1) are its flat fill, `label` its legend entry and tooltip reading, `note`
 * a muted qualifier after the label in the legend, `legend: false` keeps it out of the legend.
 * `tooltip` is omitted: a cell's tooltip always names its state, so there is no row to hide.
 *
 * A categorical STATUS grid (up / degraded / down) names a `tone` instead of a `color`:
 *
 * ```tsx
 * <Heatmap getState={(d) => d.status} getValue={() => null} …
 *   states={[{ key: 'up', label: 'Up', tone: 'good' }, { key: 'down', label: 'Down', tone: 'bad' }]} />
 * ```
 *
 * `warn` and `bad` draw `!` and `×` in the cell; `glyph` overrides them, `glyph: ''` opts out.
 */
export type HeatmapState<K extends string = string> = Omit<
  NamedChartState,
  'key' | 'tooltip' | 'color'
> & {
  key: K
  /** The flat fill, a `BASALT.*` ref. Needed unless `tone` is set; `color` wins over `tone`. */
  color?: string | undefined
}

/** The fill a state resolves to: its `color`, else its tone's status colour, else neutral. */
const fillOf = (s: HeatmapState | undefined): string =>
  s?.color ?? (s?.tone === undefined ? CV.neutral : CV_STATUS[s.tone])

type HeatmapBase<T, K extends string> = BasaltProps & {
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
  /** The ink at full intensity, a `BASALT.*` ref or a series token. Default `BASALT.line`. */
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
   * draws its state's flat fill whatever its value, and — not being a measurement — does NOT
   * contribute to the default `[0, max]` domain; pass `domain` to pin it. Memoize it: a new
   * function recompiles the chart.
   */
  getState?: ((d: T) => K | undefined) | undefined
  /**
   * The named states `getState` may return, legended after the gradient (hidden with
   * `legend={false}`). Without `getState` they draw and legend nothing.
   */
  states?: readonly HeatmapState<K>[] | undefined
  /** Band tick and tooltip header labels. Default: the band key. A label that is '' hides that tick
   * (thin the axis by hand); the tooltip header then names the cell by its band key. */
  formatRow?: ((row: string) => string) | undefined
  formatCol?: ((col: string) => string) | undefined
  /** Column keys whose x tick must survive the kit's thinning (an onset hour). A stride tick that
   * would crowd one is dropped; a key not in `cols` is ignored. Memoize it. */
  tickCols?: readonly string[] | undefined
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
  /** A fixed height, one per container class, or `'fill'` (the card's `box.height`) to take the parent's, as `matchHeight` does. Default: by row count (160–420px). */
  height?: number | ResponsiveChartHeight | 'fill' | undefined
  /** Fill the parent's height instead (the same as `height="fill"`). Overrides `height`. CSS-owned like every other kind's box
   * (`ChartBox`, no measuring, SSR-stable), so the parent needs a definite CSS height — a grid or
   * flex stretch, `h-full`, an explicit height — which no kind can read off an auto-height parent. */
  matchHeight?: boolean | undefined
  /** The load state, as on every data part: a `Phase` or a query result. */
  phase?: Phase | QueryStateLike | undefined
  /** The measured-empty state once the query settled; `cause` is the line the tile prints. */
  empty?: Empty | null | undefined
  /** @deprecated Use `phase` and `empty`; removed in the next minor. */
  state?: ChartState | undefined
  /**
   * `useChartFocus(data, …)`: pointing at a cell or stepping with the arrow keys focuses its datum,
   * every other cell dims, and `focus.readout` drives a card fact. The grid stays one tab stop. A
   * list row that holds a run of cells (`focus.hold`, a `BarList` row on `focusItems`) focuses every
   * cell of the run.
   */
  focus?: ChartFocus<T> | undefined
  /**
   * A short mark in the cell (an onset glyph, a two-digit hour), `null` for none. Drawn centred in
   * the cell's contrast ink, and skipped where the cell is too narrow to hold it. It is decoration:
   * say what it means in the subtitle or a tooltip row.
   */
  annotate?: ((d: T) => string | null) | undefined
}

export type HeatmapProps<T, K extends string = string> = HeatmapBase<T, K> & ChartName

const ROW_PITCH = 26
const CHROME = 64
const CELL_INSET = 1
const AT_CELL = { x: 'col', y: 'row', inset: CELL_INSET, key: 'id' } as const
/** One grid position. `id` is its row-major index: the mark key, so no row/col pair can collide. */
type Cell<T, K extends string> = {
  id: number
  row: string
  col: string
  value: number | null
  datum: T | undefined
  state: K | undefined
}

/** A cell's centred mark: its text and ink. */
type Mark = { id: number; row: string; col: string; text: string; fill: string }

const identityLabel = (band: string): string => band

/** The bands in use: the explicit order, else first seen in `data`. */
function useBands<T>(
  explicit: readonly string[] | undefined,
  data: readonly T[],
  get: (d: T) => string,
): readonly string[] {
  return useMemo(() => explicit ?? [...new Set(data.map(get))], [explicit, data, get])
}

const ramp = (color: string): string[] => RAMP_OPACITIES.map((a) => alpha(color, a))

const noneHidden: ReadonlySet<string> = new Set()
const noop = (): void => {}

const noStates: readonly never[] = []

/** The value row of a cell's tooltip: its state's label, "No data", or the formatted value. */
function valueRows<K extends string>(
  c: Cell<unknown, K>,
  named: HeatmapState<K> | undefined,
  label: string,
  formatValue: (v: number) => string,
  pointColor: string | undefined,
): ChartTooltipRow[] {
  if (named) return [{ label, value: named.label, color: fillOf(named) }]
  if (c.value === null) return [{ label, value: 'No data' }]
  return [{ label, value: formatValue(c.value), ...(pointColor && { color: pointColor }) }]
}

/** What the x ticks have to fit in: one column's width and the widest tick label, both in px. */
export type TickRoom = { cellPx: number; labelPx: number }

/**
 * The x tick columns: every `named` column (one not in `cols` is ignored), thinned in order from the
 * first to the ones a label's width (and an 8 px gap) leaves room for, so a grid that names every column
 * draws an even step. The class's stride ticks are added only on a shared step: when every kept named
 * tick is one of them and a label fits between two. Any other mix reads as an uneven axis (weekly names
 * with stride ticks between them), so then the named ticks stand alone. The result keeps `cols` order.
 */
export function colTicks(
  cols: readonly string[],
  named: readonly string[] | undefined,
  cls: ContainerClass,
  room?: TickRoom,
): string[] {
  const stride = strideTicks(cols, cls)
  const step = room ? Math.ceil((room.labelPx + 8) / room.cellPx) : 1
  let last = -Infinity
  // Each named column is kept when it sits a step after the last kept one.
  const kept = cols.filter((c, i) => named?.includes(c) && i - last >= step && ((last = i), true))
  if (kept.length === 0) return stride
  const onStride = kept.every((c) => stride.includes(c))
  return onStride && step <= cols.indexOf(stride[1] as string) ? stride : kept
}

/**
 * A hovered cell's tooltip header. A `formatCol` that returns '' for a column (thinning the ticks by
 * hand) never blanks it: the cell is named whole, by its band key when the label is empty.
 */
export function cellHeader(
  row: string,
  col: string,
  formatRow: (row: string) => string,
  formatCol: (col: string) => string,
): string {
  return `${formatRow(row) || row} · ${formatCol(col) || col}`
}

/**
 * The box height a Heatmap states or derives from its row count (160–420 px): what its pending
 * placeholder, inside a `ChartCard`, reserves. `undefined` when the rows are not known up front.
 */
export function heatmapHeight(props: {
  height?: number | ResponsiveChartHeight | 'fill' | undefined
  rows?: readonly string[] | undefined
}): number | ResponsiveChartHeight | undefined {
  if (props.height === 'fill') return undefined
  if (props.height !== undefined) return props.height
  return props.rows === undefined ? undefined : heightOfRows(props.rows.length)
}

const heightOfRows = (count: number): number =>
  Math.min(Math.max(count * ROW_PITCH + CHROME, HEIGHT_MIN), HEIGHT_MAX)

// A column: the box (`fillFrame`) takes the height the legend row leaves, so the legend sits inside
// the parent's height instead of past it.
const fillStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: HEIGHT_MIN,
}

/** The datum at each grid position, by `row\0col`; the last datum at a position wins. */
const gridIndex = <T,>(
  data: readonly T[],
  getRow: (d: T) => string,
  getCol: (d: T) => string,
): Map<string, T> => new Map(data.map((d) => [`${getRow(d)}\u0000${getCol(d)}`, d]))

/** The datum at each grid position, row-major; `undefined` where the grid has none. */
export function datumGrid<T>(
  data: readonly T[],
  rows: readonly string[],
  cols: readonly string[],
  getRow: (d: T) => string,
  getCol: (d: T) => string,
): (T | undefined)[][] {
  const at = gridIndex(data, getRow, getCol)
  return rows.map((r) => cols.map((c) => at.get(`${r}\u0000${c}`)))
}

/**
 * The arrow keys over a heat grid: Left and Right along the row, Up and Down along the column,
 * skipping positions with no datum and stopping at the edge; Home and End are the first and last
 * datum in reading order; Escape clears. From no focus, the first key lands on the first (or, for
 * Left, Up and End, the last) datum. Returns the item index `indexOf` gives, or `undefined`.
 */
export function stepGrid<T>(
  grid: readonly (readonly (T | undefined)[])[],
  key: string,
  current: T | undefined,
  indexOf: (d: T) => number,
): number | null | undefined {
  if (key === 'Escape') return null
  const step = STEPS[key]
  if (!step && key !== 'Home' && key !== 'End') return undefined
  const cells = grid.flatMap((row, r) =>
    row.flatMap((d, c) => (d === undefined ? [] : [{ r, c, d }])),
  )
  const here = cells.find((p) => p.d === current)
  if (!step || !here) {
    const back = key === 'ArrowLeft' || key === 'ArrowUp' || key === 'End'
    const edge = back ? cells.at(-1) : cells[0]
    return edge && indexOf(edge.d)
  }
  const [dr, dc] = step
  for (let r = here.r + dr, c = here.c + dc; inside(grid, r, c); r += dr, c += dc) {
    const d = grid[r]?.[c]
    if (d !== undefined) return indexOf(d)
  }
  return indexOf(here.d)
}

const STEPS: Record<string, readonly [number, number]> = {
  ArrowRight: [0, 1],
  ArrowLeft: [0, -1],
  ArrowDown: [1, 0],
  ArrowUp: [-1, 0],
}

const inside = (grid: readonly (readonly unknown[])[], r: number, c: number): boolean =>
  r >= 0 && r < grid.length && c >= 0 && c < (grid[r]?.length ?? 0)

/**
 * A band by band grid of cells whose intensity is absolute (one scale across the whole grid), with
 * named states for cells that are failed, idle or absent. `getRow`, `getCol`, `getValue`, `getState` and
 * `tickCols` need a stable identity (module scope or memoized) to spare the work: a new function every render
 * rebuilds the chart on each pass. Focus settles either way: an inline `data`, `domain`, `legend` or `tooltip`
 * and a build without the React Compiler hover, key and hold the grid without a render loop.
 *
 * @useWhen two ordered categories cross (weekday by hour, service by day) and the cell value is the answer
 * @neverWhen there is one row of states over time (use BandStrip), or the exact value matters more than the pattern (use a table)
 */
export function Heatmap<T, K extends string = string>(props: HeatmapProps<T, K>): ReactElement {
  const ariaLabel = chartName(props)
  const {
    data,
    getRow,
    getCol,
    getValue,
    color = BASALT.line,
    domain,
    formatValue = String,
    formatLegend = formatValue,
    getState,
    states = noStates,
    formatRow = identityLabel,
    formatCol = identityLabel,
    tickCols,
    legend,
    tooltip,
    height,
    matchHeight: matchHeightProp = false,
    phase,
    empty,
    state: legacyState,
    className,
    style,
    focus,
    annotate,
  } = props
  // `phase` and `empty` say pending, error, then the empty cause; the deprecated `state` fills in when they say nothing.
  const state = toChartState(phase, empty, legacyState)
  const chartId = useId()
  const focused = focus?.datum ?? null
  // A list row that holds a run of cells (`focus.hold`) focuses every one of them, not the first alone.
  const held = focus?.span
  const ownsKeys = focus !== undefined
  // Primitives, so the definition does not rebuild for a fresh `{ label }` / `{ rows }` literal.
  const showLegend = legend !== false
  const legendLabel = legend === false ? undefined : legend?.label
  const showTooltip = tooltip !== false
  const tooltipConfig = tooltip === false ? undefined : tooltip
  const tooltipRows = tooltipConfig?.rows
  const valueLabel = tooltipConfig?.valueLabel ?? 'Value'
  const rows = useBands(props.rows, data, getRow)
  const cols = useBands(props.cols, data, getCol)
  const matchHeight = matchHeightProp || height === 'fill'
  const coarse = useCoarsePointer()
  const boxHeight =
    matchHeightProp || height === 'fill' ? 'fill' : (height ?? heightOfRows(rows.length))

  // Resolved per datum below; a key naming nothing throws in dev, paints the ramp in production.
  const stateKeys = useMemo(() => states.map((s) => s.key), [states])
  const stateByKey = useMemo(() => new Map(states.map((s) => [s.key, s])), [states])

  const definition = useMemo<CartesianDefinition>(() => {
    const at = gridIndex(data, getRow, getCol)
    // One pass: split the grid into measured, stated, absent-with-a-datum and absent-with-none.
    const present: Cell<T, K>[] = []
    const stated = new Map<K, Cell<T, K>[]>()
    const absentWithDatum: Cell<T, K>[] = []
    const absentEmpty: Cell<T, K>[] = []
    let max = 0
    for (const [r, row] of rows.entries()) {
      for (const [c, col] of cols.entries()) {
        const datum = at.get(`${row}\u0000${col}`)
        const raw = datum === undefined ? null : getValue(datum)
        const value = raw !== null && Number.isFinite(raw) ? raw : null
        const stateKey =
          datum === undefined || getState === undefined
            ? undefined
            : resolveNamedState('Heatmap', 'Heatmap.getState', getState(datum), stateKeys)
        const cellAt: Cell<T, K> = {
          id: r * cols.length + c,
          row,
          col,
          datum,
          value,
          state: stateKey,
        }
        if (stateKey !== undefined) {
          const bucket = stated.get(stateKey) ?? []
          bucket.push(cellAt)
          stated.set(stateKey, bucket)
        } else if (value !== null) {
          present.push(cellAt)
          max = Math.max(max, value)
        } else if (datum === undefined) absentEmpty.push(cellAt)
        else absentWithDatum.push(cellAt)
      }
    }
    // A grid whose every drawn cell is stated has no ramp to legend; the state key says it all.
    const drawsRamp = present.length > 0 || stated.size === 0
    const [lo, hi] = domain ?? [0, max]
    // A flat or inverted domain would map every value to one step; widen it to a unit.
    const scale = scaleQuantize<string>()
      .domain([lo, hi > lo ? hi : lo + 1])
      .range(ramp(color))
    const levelOf = scaleQuantize<number>()
      .domain([lo, hi > lo ? hi : lo + 1])
      .range(RAMP_OPACITIES)
    const header = (c: Cell<T, K>): string => cellHeader(c.row, c.col, formatRow, formatCol)
    const heldSet = new Set<unknown>(held?.length ? held : [focused])
    const isHeld = (c: Cell<T, K>): boolean => focused !== null && heldSet.has(c.datum)
    // One builder for every cell mark; `paint` is the fill (flat, or the ramp's `color` channel).
    // With a focused datum every other cell keeps its fill at `DIMMED` of its own opacity.
    // (The cell mark takes one opacity per mark, so the focused cell is its own mark.)
    const cellMark = (
      id: string,
      group: Cell<T, K>[],
      paint: { fill?: string; color?: 'value'; fillOpacity?: number },
    ) => {
      const at = (cells: Cell<T, K>[], markId: string, fillOpacity?: number) =>
        cell(cells, {
          id: markId,
          ...AT_CELL,
          ...paint,
          ...(fillOpacity !== undefined && { fillOpacity }),
        })
      if (focused === null) return [at(group, id)]
      const base = paint.fillOpacity ?? 1
      const rest = group.filter((c) => !isHeld(c))
      return [at(rest, id, base * DIMMED), at(group.filter(isHeld), `${id}:focused`)]
    }
    // The label ink holds on the cell's own fill as it is drawn: a stated cell's bar paint, a value
    // cell's ramp step, dimmed with the rest (`heatmap-ink.ts`). A dimmed label draws at DIMMED_TEXT:
    // at DIMMED the ink fell to 2.4:1 on the dark card.
    const labelFill = (c: Cell<T, K>): string => {
      const dimmed = focused !== null && !isHeld(c)
      if (c.state !== undefined) {
        const named = stateByKey.get(c.state)
        return stateInk(fillOf(named), named?.fillOpacity ?? 1, dimmed)
      }
      if (c.value === null) return flatInk(CV.neutral, ABSENT_OPACITY, dimmed)
      return flatInk(color, levelOf(c.value), dimmed)
    }
    const drawn = [...present, ...absentWithDatum, ...[...stated.values()].flat()]
    const annotated =
      annotate === undefined
        ? []
        : drawn.flatMap((c) => {
            const note = c.datum === undefined ? null : annotate(c.datum)
            return note === null || note === '' ? [] : [{ ...c, text: note, fill: labelFill(c) }]
          })
    const tooltipOptions = showTooltip
      ? {
          use: engineTooltip,
          portal: cardPortal('card'),
          // Below the hovered cell (flipping above only when there is no room): the default sits
          // above it and covers the caption row over the grid.
          placement: ['bottom', 'top'] as const,
          content: (points: readonly ChartPoint[]) => {
            const point = points[0]
            const c = point?.datum as Cell<T, K> | undefined
            // A position with no datum is hit-tested (so it never snaps to a neighbour) but inert.
            if (!point || !c || c.datum === undefined) return { rows: [] }
            const named = c.state === undefined ? undefined : stateByKey.get(c.state)
            const rows = [
              ...valueRows(c, named, valueLabel, formatValue, point.color),
              ...(tooltipRows?.(c.datum) ?? []),
            ]
            return { title: header(c), rows: rows.map(engineRow) }
          },
        }
      : (false as const)

    return {
      chart: ({ width }: ChartBuildContext): StoredChartSpec => {
        const ticks = { line: false as const, size: 0 }
        const cls = resolveContainerClass(width)
        const tickLabels = {
          fontSize: BASALT.text.micro,
          opacity: 1,
          thin: true,
        }
        // A mark in the cell's centre (a stated cell's glyph, a per-cell note). Each mark keeps its own
        // room: a note too wide for its cell drops that cell's note alone, never every cell's.
        const cellPx = width / Math.max(cols.length, 1)
        // The plot sits right of the row labels: the ticks step by the columns their widest label spans.
        const rowPx = Math.max(...rows.map((r) => captionWidth(formatRow(r), BASALT.text.micro)))
        const tickRoom: TickRoom = {
          cellPx: (width - rowPx) / cols.length,
          labelPx: Math.max(...cols.map((c) => captionWidth(formatCol(c), BASALT.text.micro))),
        }
        const centred = (all: readonly Mark[], id: string, fontSize: number) => {
          const items = all.filter(
            (m) =>
              cellPx >=
              Math.max(GLYPH_MIN_PX, Math.ceil(captionWidth(m.text, fontSize)) + CELL_INSET * 2),
          )
          return items.length > 0
            ? [
                decorative(
                  text(items, {
                    id,
                    x: 'col',
                    y: 'row',
                    key: 'id',
                    text: 'text',
                    fill: (m: Mark) => m.fill,
                    fontSize,
                    fontWeight: 600,
                    anchor: 'middle',
                  }),
                ),
              ]
            : []
        }
        const glyphs = [...stated].flatMap(([key, group]) => {
          const named = stateByKey.get(key)
          const glyph = named && glyphOf({ ...named, color: fillOf(named) })
          return glyph ? group.map((c) => ({ ...c, text: glyph, fill: labelFill(c) })) : []
        })
        // The focused cell's ring, drawn last of the fills so no neighbour paints over it. A pointer
        // focus rings through the engine without `focus`; with it the host rings (the engine's dot and keyboard are off).
        const ringed = drawn.filter(isHeld)
        const marks = [
          // Inert, not decorative: it must still win the hit test, so a pointer over an empty
          // position lands on THIS cell (whose tooltip is empty) instead of snapping to a neighbour.
          ...cellMark('absent-empty', absentEmpty, {
            fill: CV.neutral,
            fillOpacity: ABSENT_OPACITY,
          }),
          ...cellMark('absent', absentWithDatum, { fill: CV.neutral, fillOpacity: ABSENT_OPACITY }),
          ...[...stated].flatMap(([key, group]) => {
            const named = stateByKey.get(key)
            return cellMark(`state:${key}`, group, {
              fill: fillOf(named),
              ...(named?.fillOpacity !== undefined && { fillOpacity: named.fillOpacity }),
            })
          }),
          ...cellMark('cells', present, { color: 'value' }),
          decorative(
            cell(ringed, {
              id: 'focus-ring',
              ...AT_CELL,
              fill: 'none',
              stroke: CV.brand,
              strokeWidth: 2,
            }),
          ),
          ...centred(glyphs, 'state-glyphs', BASALT.text.md),
          ...centred(annotated, 'annotations', BASALT.text.md),
        ]
        return {
          marks,
          scales: {
            x: {
              scale: scaleBand<string>().domain(cols).paddingInner(0).paddingOuter(0),
              axis: {
                line: AXIS_LINE,
                ticks: {
                  values: colTicks(cols, tickCols, cls, tickRoom),
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
            ...(showLegend &&
              drawsRamp && {
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
      tooltip: tooltipOptions,
      // With `focus` the focused cell's ring marks it, and the engine's dot would sit on the cell's centred text.
      ...(ownsKeys && { focusRing: false as const }),
      // With `focus` the wrapper is the one tab stop and steps the grid itself.
      ...(ownsKeys && { keyboard: false as const }),
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
    tickCols,
    legendLabel,
    showLegend,
    showTooltip,
    tooltipRows,
    focused,
    held,
    annotate,
    ownsKeys,
  ])

  // Legend-only series (`getValue` is always null). Without `getState` the states are never
  // drawn, so they are never legended either.
  const legendSeries = useMemo<(ChartSeries<T> & GlyphKey)[]>(
    () =>
      getState === undefined
        ? []
        : states.map((s) => ({
            ...s,
            color: fillOf(s),
            mark: 'bar' as const,
            glyph: glyphOf({ ...s, color: fillOf(s) }),
            glyphInk: stateInk(fillOf(s), s.fillOpacity ?? 1, false),
            getValue: () => null,
          })),
    [states, getState],
  )
  const resolved = resolveChartState(state)
  const engine =
    resolved === null ? (
      <ChartEngine
        definition={definition}
        ariaLabel={ariaLabel}
        height={boxHeight}
        idPrefix={idPrefixOf(chartId)}
        coarse={coarse}
        onFocusDatum={engineFocusHandler(focus)}
      />
    ) : (
      <ChartPlaceholder state={state} height={boxHeight} ghost="grid" />
    )
  const grid = focus === undefined ? undefined : datumGrid(data, rows, cols, getRow, getCol)
  return (
    <div
      data-basalt-chart=""
      {...(className !== undefined && { className })}
      style={matchHeight ? { ...fillStyle, ...style } : style}
    >
      {focus !== undefined && grid !== undefined && resolved === null ? (
        <div
          {...hostFocusProps(focus, ariaLabel, (key, index) =>
            stepGrid(grid, key, index === null ? undefined : focus.items[index], (d) =>
              focus.items.indexOf(d),
            ),
          )}
          {...(matchHeight && { style: fillStyle })}
        >
          {engine}
          {focus.live}
        </div>
      ) : (
        engine
      )}
      {showLegend && legendSeries.length > 0 && (
        <ChartLegend
          series={legendSeries}
          hidden={noneHidden}
          mode="chips"
          groups={false}
          toggle={false}
          onToggle={noop}
          onHighlight={noop}
          concealed={resolved !== null}
        />
      )}
    </div>
  )
}
