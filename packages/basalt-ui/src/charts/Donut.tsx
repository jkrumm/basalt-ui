/**
 * `Donut` — a share-of-total ring on the engine's `polar` container (`docs/V2-SPEC.md` § 9.3).
 * At most six slices are drawn; the rest fold into a neutral "Other". The legend is derived from
 * the slices (a toggle drops a slice from the ring and the tooltip; every share is still taken of
 * ALL slices, so the legend and the tooltip never disagree). It sits beside the ring on a frame
 * wider than 1.5 × its height, below it otherwise. No cursor: a ring has no shared axis.
 */
import { tooltip as tooltipHost } from '@tanstack/charts/tooltip'
import { portal } from '@tanstack/charts/tooltip/portal'
import { pie, polar, radialArc } from '@tanstack/charts/polar'
import type { ChartPoint, StoredChartSpec } from '@tanstack/charts/types/core'
import { useCallback, useId, useMemo, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { BasaltProps } from '../common/props'
import { alpha, VX } from '../tokens'
import type { CartesianDefinition } from './compile'
import { ChartEngine } from './host'
import { ChartLegend } from './legend'
import { useChartSize } from './sizing'
import { ChartPlaceholder, resolveChartState } from './state'
import { CHART_THEME } from './theme'
import type { ChartSeries, ChartState, ResponsiveChartHeight } from './types'

export type DonutDatum<K extends string = string> = { key: K; value: number }

export type DonutProps<K extends string = string> = BasaltProps & {
  /** The accessible name. Required. */
  ariaLabel: string
  data: readonly DonutDatum<K>[]
  /** A `VX.*` ref or a consumer series token per key. */
  colorForKey: (key: K) => string
  formatValue: (v: number) => string
  /** Legend and tooltip label for a key. Default: the key. */
  seriesLabel?: (key: string) => string
  /** The ring's centre text, and the smaller line under it. */
  centerLabel?: string
  centerSubLabel?: string
  /** Default 240. */
  height?: number | ResponsiveChartHeight
  state?: ChartState
}

/** Slices kept before the rest fold into "Other". */
const MAX_SLICES = 6
const OTHER_KEY = '__other'
/** W/H above which the legend sits beside the ring, and the ring's share of the width then. */
const SIDE_ASPECT = 1.5
const SIDE_RING_SHARE = 0.55
const DEFAULT_HEIGHT = 240
const INNER_RATIO = 0.62

type Slice = { key: string; label: string; color: string; value: number }

const safe = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0)

function foldOther<K extends string>(
  data: readonly DonutDatum<K>[],
): {
  kept: DonutDatum<K>[]
  other: number | null
} {
  const all = data.map((d) => ({ key: d.key, value: safe(d.value) }))
  if (all.length <= MAX_SLICES) return { kept: all, other: null }
  const top = new Set(
    all
      .toSorted((a, b) => b.value - a.value)
      .slice(0, MAX_SLICES)
      .map((d) => d.key),
  )
  return {
    kept: all.filter((d) => top.has(d.key)),
    other: all.reduce((sum, d) => (top.has(d.key) ? sum : sum + d.value), 0),
  }
}

const percent = (value: number, total: number): string =>
  `${total > 0 ? Math.round((value / total) * 100) : 0}%`

const centerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  fontFamily: 'var(--basalt-font-mono)',
}

const rootStyle: CSSProperties = { display: 'flex', gap: 12, minWidth: 0 }

export function Donut<K extends string = string>(props: DonutProps<K>): ReactElement {
  const {
    ariaLabel,
    data,
    colorForKey,
    formatValue,
    seriesLabel = (key: string) => key,
    centerLabel,
    centerSubLabel,
    height = DEFAULT_HEIGHT,
    state,
    className,
    style,
  } = props
  const chartId = useId()
  const { ref, size, coarse } = useChartSize(height)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  const onToggle = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }, [])

  const slices = useMemo<Slice[]>(() => {
    const { kept, other } = foldOther(data)
    const out: Slice[] = kept.map((d) => ({
      key: d.key,
      label: seriesLabel(d.key),
      color: colorForKey(d.key),
      value: d.value,
    }))
    if (other !== null)
      out.push({ key: OTHER_KEY, label: 'Other', color: alpha(VX.neutral, 0.5), value: other })
    return out
  }, [data, colorForKey, seriesLabel])
  const total = slices.reduce((sum, s) => sum + s.value, 0)

  const series = useMemo<ChartSeries<Slice>[]>(
    () =>
      slices.map((s) => ({
        key: s.key,
        label: s.label,
        color: s.color,
        mark: 'bar' as const,
        getValue: () => s.value,
        note: `${formatValue(s.value)} · ${percent(s.value, total)}`,
      })),
    [slices, total, formatValue],
  )

  const definition = useMemo<CartesianDefinition>(() => {
    const drawn = slices.filter((s) => !hidden.has(s.key))
    const arcs = pie(drawn, { value: 'value' })
    return {
      chart: (): StoredChartSpec => ({
        marks: [
          polar({
            inset: 4,
            scales: { angle: null, radius: null },
            marks: [
              radialArc(arcs, {
                key: 'key',
                innerRadius: ({ radius }) => radius * INNER_RATIO,
                cornerRadius: 3,
                fill: (a) => a.color,
              }),
            ],
          }),
        ],
        scales: { x: null, y: null },
        theme: CHART_THEME,
      }),
      tooltip: {
        use: tooltipHost,
        portal,
        content: (points: readonly ChartPoint[]) => {
          const slice = points[0]?.datum as Slice | undefined
          if (!slice || !slices.some((s) => s.key === slice.key)) return { rows: [] }
          return {
            title: slice.label,
            rows: [
              { label: 'Value', value: formatValue(slice.value), color: slice.color },
              { label: 'Share', value: percent(slice.value, total) },
            ],
          }
        },
      },
    }
  }, [slices, hidden, total, formatValue])

  const side =
    size.containerClass !== 'micro' &&
    size.containerClass !== 'compact' &&
    size.width / size.height > SIDE_ASPECT
  const legend = (
    <ChartLegend
      series={series}
      hidden={hidden}
      mode="chips"
      groups={false}
      toggle={series.length >= 2}
      onToggle={onToggle}
      onHighlight={() => {}}
    />
  )
  const resolved = resolveChartState(state)
  const ringWidth = side ? Math.min(size.height, size.width * SIDE_RING_SHARE) : undefined
  return (
    <div
      ref={ref}
      data-basalt-chart=""
      {...(className !== undefined && { className })}
      style={{
        ...rootStyle,
        flexDirection: side ? 'row' : 'column',
        alignItems: side ? 'center' : 'stretch',
        ...style,
      }}
    >
      <div
        style={{
          position: 'relative',
          minWidth: 0,
          ...(ringWidth !== undefined && { flex: `0 0 ${ringWidth}px` }),
        }}
      >
        {resolved === null ? (
          <ChartEngine
            definition={definition}
            ariaLabel={ariaLabel}
            height={size.height}
            idPrefix={`basalt-chart-${chartId.replaceAll(/[^\w-]/g, '')}`}
            coarse={coarse}
          />
        ) : (
          <ChartPlaceholder state={state} height={size.height} />
        )}
        {resolved === null && (centerLabel !== undefined || centerSubLabel !== undefined) && (
          <div aria-hidden style={centerStyle}>
            {centerLabel !== undefined && (
              <span style={{ color: VX.ink, fontSize: VX.text.lg, fontWeight: 600 }}>
                {centerLabel}
              </span>
            )}
            {centerSubLabel !== undefined && (
              <span style={{ color: VX.axis, fontSize: VX.text.micro }}>{centerSubLabel}</span>
            )}
          </div>
        )}
      </div>
      {resolved === null && legend}
    </div>
  )
}
