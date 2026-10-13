/**
 * `CartesianChart` — the one cartesian rung (`docs/V2-SPEC.md` § 9.2): a definition compiler plus
 * one host. Every cartesian kind is this component with fixed `marks`.
 *
 * Three layers, composed here and nowhere else: the pure sizing hook (`sizing.ts`: measured width
 * → container class → height), the bare engine mount (`host.tsx`), and the chrome — the derived
 * legend, the `state` placeholders and the `ChartCard` header slot — around both.
 */
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { useChartCard } from './card-context'
import { compileCartesian } from './compile'
import type { CartesianDefinition } from './compile'
import { ChartEngine, idPrefixOf } from './host'
import { ChartLegend, legendEntries } from './legend'
import type { LegendMode } from './legend'
import { useChartSize } from './sizing'
import { ChartPlaceholder, resolveChartState } from './state'
import type { CartesianChartProps, ChartSeries, ChartX } from './types'

/** Kind-only compile switches, never on the public props. */
export type RungOptions = {
  /** A band x scale (bars). */
  band?: boolean
  /** Tooltip rows bottom-up, so a stack reads top-down. */
  reverseRows?: boolean
  /** How the bar series combine for the auto domain. */
  stack?: 'stacked' | 'normalized'
}

const rootStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }

/** `useId` output (`«r1»`, `:r1:`) is not a safe SVG id fragment. */

/** The previous object while every field is `Object.is`-equal: a one-dependency memo key. */
function useShallowStable<V extends Record<string, unknown>>(next: V): V {
  const [kept, setKept] = useState(next)
  // Union of keys: an omitted prop and an explicit `undefined` are different inputs.
  const same = [...new Set([...Object.keys(kept), ...Object.keys(next)])].every((k) =>
    Object.is(kept[k], next[k]),
  )
  // Render-phase setState: React re-renders at once with `kept` replaced, no effect, no stale frame.
  if (!same) setKept(next)
  return same ? kept : next
}

/** What a chart's definition is compiled from, besides its own props: the chrome's live state. */
export type ShellContext = {
  /** Unique per mounted chart (React `useId`). */
  chartId: string
  /** Series keys the legend has toggled off. */
  hidden: ReadonlySet<string>
  /** The legend entry under the pointer. */
  highlighted: string | null
  /** A coarse primary pointer. */
  coarse: boolean
  /** The measured width; 0 unless the shell was asked to track it (`byWidth`). */
  width: number
}

export type ChartShellProps<T> = Pick<
  CartesianChartProps<T, ChartX>,
  'ariaLabel' | 'legend' | 'height' | 'state' | 'className' | 'style'
> & {
  /** The legend and tooltip source. */
  series: readonly ChartSeries<T>[]
  /** Compiles the definition; memoized on its own identity and the context. Keep it stable. */
  compile: (ctx: ShellContext) => CartesianDefinition
  /** Recompile when the measured width changes (default: it is not an input). */
  byWidth?: boolean
}

/**
 * The chrome around every chart: size, the `hidden`/`highlighted` legend state, the derived legend
 * (and its `ChartCard` header slot), the `state` placeholders and the engine mount. The rung and
 * the composed kinds differ only in the definition they compile.
 */
export function ChartShell<T>(props: ChartShellProps<T>): ReactElement {
  const { ariaLabel, legend, height, state, className, style, series, compile, byWidth } = props
  const chartId = useId()
  const card = useChartCard()
  const { ref, size, coarse } = useChartSize(height)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  const [highlighted, setHighlighted] = useState<string | null>(null)

  const width = byWidth ? size.width : 0
  const definition = useMemo(
    () => compile({ chartId, hidden, highlighted, coarse, width }),
    [compile, chartId, hidden, highlighted, coarse, width],
  )

  // ── legend: micro has none, compact shows dots, regular and wide show chips ────────────────────
  const config = legend === false ? null : (legend ?? {})
  const entryCount = legendEntries(series, false)[0]?.length ?? 0
  // Micro has no legend, compact shows dots, regular and wide show chips (§ 9.6).
  const cls = size.containerClass
  const shown = config !== null && entryCount > 0 && cls !== 'micro'
  const mode: LegendMode | null = shown ? (cls === 'compact' ? 'dots' : 'chips') : null
  const toggle = config?.toggle ?? entryCount >= 2
  const onToggle = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }, [])
  const legendNode: ReactNode = useMemo(
    () =>
      mode === null ? null : (
        <ChartLegend
          series={series}
          hidden={hidden}
          mode={mode}
          groups={config?.groups === true}
          toggle={toggle}
          onToggle={onToggle}
          onHighlight={setHighlighted}
        />
      ),
    [mode, series, hidden, config?.groups, toggle, onToggle],
  )
  const inHeader = config?.placement === 'header' && card !== null
  useEffect(() => {
    if (!inHeader || !card) return
    card.setHeaderLegend(chartId, legendNode)
    return () => card.setHeaderLegend(chartId, null)
  }, [inHeader, card, chartId, legendNode])
  const atTop = config?.placement === 'top' || (config?.placement === 'header' && !card)

  const resolved = resolveChartState(state)
  return (
    <div
      ref={ref}
      data-basalt-chart=""
      {...(className !== undefined && { className })}
      style={style ? { ...rootStyle, ...style } : rootStyle}
    >
      {atTop && legendNode}
      {resolved === null ? (
        <ChartEngine
          definition={definition}
          ariaLabel={ariaLabel}
          height={size.height}
          idPrefix={idPrefixOf(chartId)}
          coarse={coarse}
        />
      ) : (
        <ChartPlaceholder state={state} height={size.height} />
      )}
      {!atTop && !inHeader && legendNode}
    </div>
  )
}

export function CartesianRung<T, X extends ChartX>(
  props: CartesianChartProps<T, X> & RungOptions,
): ReactElement {
  const { ariaLabel, legend, height, state, className, style, series, ...spec } = props
  const stable = useShallowStable({ ...spec, series })
  const compile = useCallback(
    (ctx: ShellContext) => compileCartesian({ ...stable, ...ctx }),
    [stable],
  )
  return (
    <ChartShell
      series={series}
      compile={compile}
      ariaLabel={ariaLabel}
      {...(legend !== undefined && { legend })}
      {...(height !== undefined && { height })}
      {...(state !== undefined && { state })}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    />
  )
}

/**
 * The cartesian rung with consumer marks. Required `ariaLabel`; `marks(plot)` returns TanStack
 * marks imported from the allowed `@tanstack/charts/*` subpaths, drawn from `plot.rows(key)`.
 *
 * ```tsx
 * import { lineY } from '@tanstack/charts/line'
 * <CartesianChart
 *   ariaLabel="Load"
 *   data={rows}
 *   x={(d) => d.at}
 *   series={[{ key: 'load', label: 'Load', color: VX.line, getValue: (d) => d.load }]}
 *   marks={(plot) => [lineY(plot.rows('load'), { x: 'x', y: 'y', stroke: VX.line })]}
 * />
 * ```
 */
export function CartesianChart<T, X extends ChartX>(
  props: CartesianChartProps<T, X>,
): ReactElement {
  return <CartesianRung {...props} />
}
