/**
 * The composed-chart infrastructure `DualPanel` and `MirroredBars` share (`docs/V2-SPEC.md` § 9.2):
 * two TanStack views composed with `composeViews` + `grid` + `alignX` into ONE definition — one
 * host, one cursor, one tooltip — mounted by the rung's own `ChartShell`. A kind supplies a
 * `PanelPlan` (its two panes and its tooltip rows) per legend state; everything else — size, legend,
 * `state`, cursor binding, tooltip surface, guides — is the rung's or lives here once.
 */
import { crosshair } from '@tanstack/charts/crosshair'
import { portal } from '@tanstack/charts/tooltip/portal'
import type {
  ChartBuildContext,
  ChartPoint,
  ChartTooltipRow as EngineTooltipRow,
  ChartValue,
  StoredChartSpec,
} from '@tanstack/charts/types/core'
import { alignX, composeViews, grid } from '@tanstack/charts/view'
import type { ComposableResponsiveChartDefinition } from '@tanstack/charts/view'
import { useCallback } from 'react'
import type { ReactElement } from 'react'
import { ChartShell } from './CartesianChart'
import type { ChartShellProps, ShellContext } from './CartesianChart'
import { defaultFormatX, engineRow, utcHeaderDate, visibleSeries, xGuide, yGuide } from './compile'
import type { CartesianDefinition } from './compile'
import { cursorBinding, quietWhileFollowing } from './cursor'
import { plotAccess } from './plot-context'
import type { PlotAccess } from './plot-context'
import type { XScaleModel } from './scales'
import { CHART_THEME, CROSSHAIR } from './theme'
import type { ContainerClass } from '../tokens/size-classes'
import type {
  CartesianChartProps,
  ChartMarks,
  ChartSeries,
  ChartTooltipRow,
  ChartX,
  PlotRow,
} from './types'

/** What a pane builder is given: the engine's frame for the pane and its plot-size access, to build
 * a `PlotContext` with `plotContext()` (`plot-context.ts`). */
export type PaneContext = ChartBuildContext & { plot: PlotAccess }

/** One pane, built per container class: its marks and its scales (x, y, and any helper scale). */
export type PaneBuilder = (ctx: PaneContext) => {
  marks: ChartMarks
  scales: StoredChartSpec['scales']
}

/** Everything a composed kind compiles for one legend state. */
export type PanelPlan<T> = {
  /** Every x value the cursor can land on, for snapping a foreign cursor. */
  keys: readonly ChartX[]
  top: PaneBuilder
  bottom: PaneBuilder
  /** The top pane's share of the grid, 0..1. */
  topFraction: number
  /** Space between the panes in px. */
  gap: number
  /** The per-series tooltip rows for a hovered datum; `tooltip.rows` and the title are the rung's. */
  rows: (d: T) => readonly EngineTooltipRow[]
}

export type PanelInput = {
  hidden: ReadonlySet<string>
  highlighted: string | null
  /** The measured chart width, only when the rung is asked for it (`byWidth`), otherwise 0. */
  width: number
}

export type PanelRungProps<T, X extends ChartX> = Omit<ChartShellProps<T>, 'compile'> &
  Pick<CartesianChartProps<T, X>, 'formatX' | 'cursorGroup' | 'cursorResolution' | 'tooltip'> & {
    plan: (input: PanelInput) => PanelPlan<T>
    /** Recompile on width changes: for a kind whose data depends on it (`fold`). */
    byWidth?: boolean
  }

/** A child's theme may not carry a background or focus ring: the composed chart owns them. */
const { background: _background, focusRing: _focusRing, ...PANE_THEME } = CHART_THEME

/** The least share of the height either pane keeps: the grid needs positive tracks. */
const MIN_PANE_SHARE = 0.02

/** A pane's y axis: the scale and the rung's guide for it. */
export const paneY = (opts: {
  scale: ChartScale
  domain: readonly [number, number]
  format: (v: number) => string
  ticks: number
  cls: ContainerClass
  /** The whole chart's height ({@link chartHeightOf}). */
  height: number
}): StoredChartSpec['scales'][string] => ({
  scale: opts.scale,
  ...yGuide({
    cfg: { ticks: opts.ticks },
    axis: { domain: opts.domain, format: opts.format },
    cls: opts.cls,
    height: opts.height,
    side: 'left',
    grid: true,
  }),
})

type ChartScale = NonNullable<StoredChartSpec['scales'][string]>['scale']

/** The shared x axis (drawn on the bottom pane only): the rung's ticks and format. */
export const paneX = <X extends ChartX>(opts: {
  scale: ChartScale
  model: XScaleModel<X>
  format: (v: ChartValue) => string
  cls: ContainerClass
  /** The whole chart's height ({@link chartHeightOf}). */
  height: number
}): StoredChartSpec['scales'][string] => ({
  scale: opts.scale,
  ...xGuide({
    model: opts.model,
    xTicks: undefined,
    format: opts.format,
    cls: opts.cls,
    height: opts.height,
  }),
})

/** The whole chart's height from one pane's: a pane gets `share` of the height less the gap. */
export const chartHeightOf = (paneHeight: number, share: number, gap: number): number =>
  paneHeight > 0 && share > 0 ? paneHeight / share + gap : 0

/** One row per datum for a series: a `null` or non-finite value is kept as a gap. */
export function rowsOf<T, X extends ChartX>(
  data: readonly T[],
  x: (d: T) => X,
  s: ChartSeries<T>,
): PlotRow<T, X>[] {
  return data.map((d) => {
    const v = s.getValue(d)
    return { x: x(d), y: v === null || !Number.isFinite(v) ? null : v, series: s.key, datum: d }
  })
}

/** A pane as a composable view. The crosshair is per pane: together they span both. */
function paneView(
  build: PaneBuilder,
  access: () => PlotAccess,
): ComposableResponsiveChartDefinition {
  return {
    chart: (ctx) => {
      const { marks, scales } = build({ ...ctx, plot: access() })
      return {
        marks: [...marks, crosshair({ x: CROSSHAIR, y: false })],
        scales,
        theme: PANE_THEME,
        clip: true,
      }
    },
  }
}

/** A plotted datum is a `PlotRow` of an owned series: its source datum. Otherwise the datum is `T`. */
function sourceOf<T>(point: ChartPoint, owned: ReadonlySet<string>): { x: ChartValue; d: T } {
  const datum = point.datum
  if (typeof datum === 'object' && datum !== null && 'datum' in datum && 'series' in datum) {
    const row = datum as PlotRow<T>
    if (owned.has(row.series)) return { x: point.xValue, d: row.datum }
  }
  return { x: point.xValue, d: datum as T }
}

type DefinitionProps<T, X extends ChartX> = Pick<PanelRungProps<T, X>, 'series'> & {
  [K in 'formatX' | 'cursorGroup' | 'cursorResolution' | 'tooltip']: PanelRungProps<T, X>[K]
}

function panelDefinition<T, X extends ChartX>(
  props: DefinitionProps<T, X>,
  ctx: ShellContext,
  plan: PanelPlan<T>,
): CartesianDefinition {
  const { series, formatX, cursorGroup, cursorResolution = 'nearest' } = props
  const { hidden, chartId } = ctx
  const tooltip = props.tooltip === false ? undefined : props.tooltip
  // A share outside 0..1 (or NaN) is clamped to leave each pane a sliver rather than throw.
  const top = Number.isFinite(plan.topFraction)
    ? Math.min(Math.max(plan.topFraction, MIN_PANE_SHARE), 1 - MIN_PANE_SHARE)
    : 0.5
  const composed = composeViews({
    views: {
      top: paneView(plan.top, () => plotAccess(definition, ctx.plot, 'top')),
      bottom: paneView(plan.bottom, () => plotAccess(definition, ctx.plot, 'bottom')),
    },
    layout: grid({
      rows: [
        { id: 'top', grow: top },
        { id: 'bottom', grow: 1 - top },
      ],
      columns: [{ id: 'main', grow: 1 }],
      gap: plan.gap,
      cells: { top: { row: 'top', column: 'main' }, bottom: { row: 'bottom', column: 'main' } },
    }),
    links: [alignX('top', 'bottom')],
  })
  const owned = new Set(series.map((s) => s.key))
  const visible = visibleSeries(series, hidden)
  const hiddenSeries = series.filter((s) => !visible.includes(s))
  const header = (v: ChartValue, d: T): string => {
    if (tooltip?.formatHeader) return tooltip.formatHeader(v as X, d)
    if (v instanceof Date && !formatX) return utcHeaderDate(v)
    return formatX ? formatX(v as X) : defaultFormatX(v)
  }
  const definition: CartesianDefinition = {
    chart: () => composed,
    focus: 'group-x',
    maxFocusDistance: Number.POSITIVE_INFINITY,
    cursor: cursorBinding({
      group: cursorGroup,
      chartId,
      keys: plan.keys,
      mode: cursorResolution,
      pin: ctx.coarse,
    }),
    tooltip:
      props.tooltip === false
        ? false
        : {
            use: quietWhileFollowing,
            ...(!tooltip?.onFollow && { follower: { group: cursorGroup, chartId } }),
            portal,
            anchor: 'group-center',
            content: (points: readonly ChartPoint[]) => {
              const primary = points[0]
              if (!primary) return { rows: [] }
              const { x, d } = sourceOf<T>(primary, owned)
              const extra: readonly ChartTooltipRow[] =
                tooltip?.rows?.(d, { visible, hidden: hiddenSeries }) ?? []
              return { title: header(x, d), rows: [...plan.rows(d), ...extra.map(engineRow)] }
            },
          },
  }
  return definition
}

export function PanelRung<T, X extends ChartX>(props: PanelRungProps<T, X>): ReactElement {
  const { plan, byWidth, formatX, cursorGroup, cursorResolution, tooltip, ...shell } = props
  const { series } = shell
  const compile = useCallback(
    (ctx: ShellContext) =>
      panelDefinition(
        { series, formatX, cursorGroup, cursorResolution, tooltip },
        ctx,
        plan({ hidden: ctx.hidden, highlighted: ctx.highlighted, width: ctx.width }),
      ),
    [series, formatX, cursorGroup, cursorResolution, tooltip, plan],
  )
  return <ChartShell {...shell} compile={compile} {...(byWidth !== undefined && { byWidth })} />
}
