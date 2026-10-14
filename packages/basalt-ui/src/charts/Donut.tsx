/**
 * `Donut` — a share-of-total ring on the engine's `polar` container (`docs/V2-SPEC.md` § 9.3).
 * At most six slices are drawn; the rest fold into a neutral "Other". The legend is derived from
 * the slices (a toggle drops a slice from the ring and the tooltip; every share is still taken of
 * ALL slices, so the legend and the tooltip never disagree). It sits beside the ring in a 480px
 * container or wider, below it otherwise (`donut.module.css`, decided in CSS so the server HTML is
 * the hydrated layout). No cursor: a ring has no shared axis.
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
import { ChartEngine, idPrefixOf } from './host'
import { ChartLegend } from './legend'
import { useCoarsePointer } from '../common/use-media-query'
import { chartBoxVars, isShortChart } from './box'
import classes from './donut.module.css'
import { ChartPlaceholder, resolveChartState } from './state'
import { CHART_THEME, DIMMED } from './theme'
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
  seriesLabel?: ((key: K) => string) | undefined
  /** The ring's centre text, and the smaller line under it. */
  centerLabel?: string | undefined
  centerSubLabel?: string | undefined
  /** Default 240. */
  height?: number | ResponsiveChartHeight | undefined
  state?: ChartState | undefined
}

/** Slices kept before the rest fold into "Other". */
const MAX_SLICES = 6
const DEFAULT_HEIGHT = 240
const INNER_RATIO = 0.62

/** `id` is the internal identity (legend key, hidden set, arc key): `k:<key>` for a datum, `other`
 * for the fold. A consumer key can never equal `other`, whatever it is called. */
type Slice = { id: string; label: string; color: string; value: number }
const OTHER_ID = 'other'

const identityLabel = (key: string): string => key

/** Duplicate keys add up; a non-finite or non-positive value is an ABSENCE and drops out, it is
 * not a zero-width slice. First-seen order. */
function aggregate<K extends string>(data: readonly DonutDatum<K>[]): DonutDatum<K>[] {
  const sums = new Map<K, number>()
  for (const d of data) {
    if (!Number.isFinite(d.value) || d.value <= 0) continue
    sums.set(d.key, (sums.get(d.key) ?? 0) + d.value)
  }
  return [...sums].map(([key, value]) => ({ key, value }))
}

/** The six largest keep their place; everything else sums into one trailing remainder. */
function foldOther<K extends string>(
  all: readonly DonutDatum<K>[],
): {
  kept: DonutDatum<K>[]
  other: number | null
} {
  if (all.length <= MAX_SLICES) return { kept: [...all], other: null }
  const top = new Set(
    all
      .toSorted((a, b) => b.value - a.value)
      .slice(0, MAX_SLICES)
      .map((d) => d.key),
  )
  let other = 0
  const kept: DonutDatum<K>[] = []
  for (const d of all) {
    if (top.has(d.key)) kept.push(d)
    else other += d.value
  }
  return { kept, other }
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

// A size container: the row inside lays the legend beside or under the ring by this width (CSS).
// `width: 100%`: a size container takes no width from its content (see `CartesianChart`'s root).
const rootStyle: CSSProperties = { containerType: 'inline-size', width: '100%', minWidth: 0 }

export function Donut<K extends string = string>(props: DonutProps<K>): ReactElement {
  const {
    ariaLabel,
    data,
    colorForKey,
    formatValue,
    seriesLabel = identityLabel,
    centerLabel,
    centerSubLabel,
    height = DEFAULT_HEIGHT,
    state,
    className,
    style,
  } = props
  const chartId = useId()
  const coarse = useCoarsePointer()
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const onToggle = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }, [])

  const slices = useMemo<Slice[]>(() => {
    const { kept, other } = foldOther(aggregate(data))
    const out: Slice[] = kept.map((d) => ({
      id: `k:${d.key}`,
      label: seriesLabel(d.key),
      color: colorForKey(d.key),
      value: d.value,
    }))
    if (other !== null)
      out.push({ id: OTHER_ID, label: 'Other', color: alpha(VX.neutral, 0.5), value: other })
    return out
  }, [data, colorForKey, seriesLabel])
  const total = slices.reduce((sum, s) => sum + s.value, 0)

  const series = useMemo<ChartSeries<Slice>[]>(
    () =>
      slices.map((s) => ({
        key: s.id,
        label: s.label,
        color: s.color,
        mark: 'bar' as const,
        getValue: () => s.value,
        note: `${formatValue(s.value)} · ${percent(s.value, total)}`,
      })),
    [slices, total, formatValue],
  )

  const definition = useMemo<CartesianDefinition>(() => {
    const drawn = slices.filter((s) => !hidden.has(s.id))
    const arcs = pie(drawn, { value: 'value' })
    return {
      chart: (): StoredChartSpec => ({
        marks: [
          polar({
            inset: 4,
            scales: { angle: null, radius: null },
            marks: [
              radialArc(arcs, {
                key: 'id',
                innerRadius: ({ radius }) => radius * INNER_RATIO,
                cornerRadius: 3,
                fill: (a) =>
                  highlighted === null || highlighted === a.id ? a.color : alpha(a.color, DIMMED),
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
          if (!slice) return { rows: [] }
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
  }, [slices, hidden, highlighted, total, formatValue])

  const legend = (
    <ChartLegend
      series={series}
      hidden={hidden}
      mode="chips"
      groups={false}
      toggle={series.length >= 2}
      onToggle={onToggle}
      onHighlight={setHighlighted}
    />
  )
  const resolved = resolveChartState(state)
  return (
    <div
      data-basalt-chart=""
      {...(className !== undefined && { className })}
      style={{ ...rootStyle, ...style }}
    >
      <div className={classes.row}>
        <div
          className={classes.ring}
          style={chartBoxVars(height)}
          {...(isShortChart(height) && { 'data-basalt-chart-short': '' })}
        >
          {resolved === null ? (
            <ChartEngine
              definition={definition}
              ariaLabel={ariaLabel}
              height="fill"
              idPrefix={idPrefixOf(chartId)}
              coarse={coarse}
            />
          ) : (
            <ChartPlaceholder state={state} height="fill" />
          )}
          {resolved === null && (centerLabel !== undefined || centerSubLabel !== undefined) && (
            <div style={centerStyle}>
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
    </div>
  )
}
