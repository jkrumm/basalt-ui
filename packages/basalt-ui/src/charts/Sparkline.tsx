/**
 * `Sparkline` — a quiet inline trend, line or bar (`docs/V2-SPEC.md` § 9.3; the two 1.x sparkline
 * kinds, merged). Guide-free and zero-margin, so the plot is the whole box: no axes, grid, legend,
 * cursor or tooltip. It does not ride `CartesianChart` (all of that is the rung's chrome); it
 * compiles a bare definition and mounts it on the same host. `width` omitted, the host measures
 * the container, which is what a `StatCard` sparkline slot or a flex row wants.
 */
import { barY } from '@tanstack/charts/bar'
import { dot } from '@tanstack/charts/dot'
import { decorative } from '@tanstack/charts/mark/decorative'
import { lineY } from '@tanstack/charts/line'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { useId, useMemo } from 'react'
import type { ReactElement } from 'react'
import type { BasaltProps } from '../common/props'
import { VX } from '../tokens'
import type { CartesianDefinition } from './compile'
import { chartCurve } from './curves'
import { ChartEngine, idPrefixOf } from './host'
import { CHART_THEME } from './theme'

export type SparklineProps = BasaltProps & {
  /** The accessible name. Required: a chart without one is an unlabeled image. */
  ariaLabel: string
  data: readonly number[]
  /** Height in px. */
  height: number
  /** Width in px. Default: the container's, measured by the host. */
  width?: number
  /** Default `'line'`. */
  mark?: 'line' | 'bar'
  /** A `VX.*` ref or a series token. Default `VX.faint`. */
  color?: string
  /** Paints the last point in `emphasisColor` — the one reading a trend beside a KPI is for. */
  emphasizeLast?: boolean
  /** Default `VX.accent`. */
  emphasisColor?: string
}

type Point = { i: number; v: number | null }

const LINE_WIDTH = 1.6
const DOT_R = 2.5
const BAR_GAP = 0.15

const finite = (v: number): number | null => (Number.isFinite(v) ? v : null)

/** Min and max of the finite values, by loop (a spread overflows the stack on long series). */
function extent(rows: readonly Point[]): readonly [number, number] | null {
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  for (const r of rows) {
    if (r.v === null) continue
    if (r.v < lo) lo = r.v
    if (r.v > hi) hi = r.v
  }
  return lo <= hi ? [lo, hi] : null
}

function compileSparkline(
  rows: readonly Point[],
  [lo, hi]: readonly [number, number],
  mark: 'line' | 'bar',
  color: string,
  emphasisColor: string | null,
): CartesianDefinition {
  const last = rows.at(-1)
  return {
    chart: () => {
      if (mark === 'bar') {
        return {
          marks: [
            barY(rows, {
              id: 'bars',
              x: 'i',
              y: 'v',
              fill: (r: Point) =>
                emphasisColor !== null && r.i === rows.length - 1 ? emphasisColor : color,
            }),
          ],
          scales: {
            x: {
              scale: scaleBand<number>()
                .domain(rows.map((r) => r.i))
                .padding(BAR_GAP),
              axis: false as const,
            },
            y: {
              scale: scaleLinear().domain([Math.min(lo, 0), Math.max(hi, 0) || 1]),
              axis: false as const,
            },
          },
          theme: CHART_THEME,
          guides: false,
          margin: 0,
        }
      }
      // A flat or single-point series needs an extent; 10% air keeps the stroke inside the box.
      const pad = (hi - lo) * 0.1 || 1
      // Half a dot of air at each end, in index units, so the last-point dot is not clipped.
      const xPad = emphasisColor === null ? 0 : (rows.length - 1) * 0.04 || 0.5
      return {
        marks: [
          lineY(rows, {
            id: 'line',
            x: 'i',
            y: 'v',
            stroke: color,
            strokeWidth: LINE_WIDTH,
            curve: chartCurve('monotone'),
          }),
          ...(emphasisColor !== null && last !== undefined && last.v !== null
            ? [
                decorative(
                  dot([last], { id: 'last', x: 'i', y: 'v', r: DOT_R, fill: emphasisColor }),
                ),
              ]
            : []),
        ],
        scales: {
          x: {
            scale: scaleLinear().domain([-xPad, Math.max(rows.length - 1, 1) + xPad]),
            axis: false as const,
          },
          y: { scale: scaleLinear().domain([lo - pad, hi + pad]), axis: false as const },
        },
        theme: CHART_THEME,
        guides: false,
        margin: 0,
      }
    },
  }
}

/** `useId` output (`«r1»`, `:r1:`) is not a safe SVG id fragment. */

export function Sparkline(props: SparklineProps): ReactElement {
  const {
    ariaLabel,
    data,
    height,
    width,
    mark = 'line',
    color = VX.faint,
    emphasizeLast = false,
    emphasisColor = VX.accent,
    className,
    style,
  } = props
  const id = useId()
  const definition = useMemo(() => {
    const rows: Point[] = data.map((v, i) => ({ i, v: finite(v) }))
    const range = extent(rows)
    // No finite value means nothing to scale: the empty render, never an Infinity domain.
    if (range === null) return null
    return compileSparkline(rows, range, mark, color, emphasizeLast ? emphasisColor : null)
  }, [data, mark, color, emphasizeLast, emphasisColor])
  return (
    <div
      data-basalt-sparkline=""
      {...(className !== undefined && { className })}
      style={{ width: width ?? '100%', height, minWidth: 0, ...style }}
    >
      {definition !== null && (
        <ChartEngine
          definition={definition}
          ariaLabel={ariaLabel}
          height={height}
          idPrefix={idPrefixOf(id, 'spark')}
          coarse={false}
        />
      )}
    </div>
  )
}
