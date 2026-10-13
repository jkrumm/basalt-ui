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
import type { ContainerClass } from '../tokens/size-classes'
import { useChartCard } from './card-context'
import { compileCartesian } from './compile'
import { ChartEngine } from './host'
import { ChartLegend, legendEntries } from './legend'
import type { LegendMode } from './legend'
import { useChartSize } from './sizing'
import { ChartPlaceholder, resolveChartState } from './state'
import type { CartesianChartProps, ChartX } from './types'

/** Kind-only compile switches, never on the public props. */
export type RungOptions = {
  /** A band x scale (bars). */
  band?: boolean
  /** Tooltip rows bottom-up, so a stack reads top-down. */
  reverseRows?: boolean
  /** How the bar series combine for the auto domain. */
  stack?: 'stacked' | 'normalized'
}

/** Micro has no legend, compact shows dots, regular and wide show chips (§ 9.6). */
function legendMode(shown: boolean, cls: ContainerClass): LegendMode | null {
  if (!shown || cls === 'micro') return null
  return cls === 'compact' ? 'dots' : 'chips'
}

const rootStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }

/** `useId` output (`«r1»`, `:r1:`) is not a safe SVG id fragment. */
const idPrefixOf = (id: string): string => `basalt-chart-${id.replaceAll(/[^\w-]/g, '')}`

export function CartesianRung<T, X extends ChartX>(
  props: CartesianChartProps<T, X> & RungOptions,
): ReactElement {
  const {
    ariaLabel,
    data,
    x,
    series,
    marks,
    y,
    y2,
    xTicks,
    formatX,
    zones,
    xZones,
    refLines,
    legend,
    height,
    state,
    cursorGroup,
    cursorResolution,
    tooltip,
    band,
    reverseRows,
    stack,
    className,
    style,
  } = props
  const chartId = useId()
  const card = useChartCard()
  const { ref, size, coarse } = useChartSize(height)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  const [highlighted, setHighlighted] = useState<string | null>(null)

  const definition = useMemo(
    () =>
      compileCartesian({
        chartId,
        data,
        x,
        series,
        marks,
        hidden,
        highlighted,
        coarse,
        ...(y !== undefined && { y }),
        ...(y2 !== undefined && { y2 }),
        ...(xTicks !== undefined && { xTicks }),
        ...(formatX !== undefined && { formatX }),
        ...(zones !== undefined && { zones }),
        ...(xZones !== undefined && { xZones }),
        ...(refLines !== undefined && { refLines }),
        ...(cursorGroup !== undefined && { cursorGroup }),
        ...(cursorResolution !== undefined && { cursorResolution }),
        ...(tooltip !== undefined && { tooltip }),
        ...(band !== undefined && { band }),
        ...(reverseRows !== undefined && { reverseRows }),
        ...(stack !== undefined && { stack }),
      }),
    [
      chartId,
      data,
      x,
      series,
      marks,
      hidden,
      highlighted,
      coarse,
      y,
      y2,
      xTicks,
      formatX,
      zones,
      xZones,
      refLines,
      cursorGroup,
      cursorResolution,
      tooltip,
      band,
      reverseRows,
      stack,
    ],
  )

  // ── legend: micro has none, compact shows dots, regular and wide show chips ────────────────────
  const config = legend === false ? null : (legend ?? {})
  const entryCount = legendEntries(series, false)[0]?.length ?? 0
  const mode = legendMode(config !== null && entryCount > 0, size.containerClass)
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
