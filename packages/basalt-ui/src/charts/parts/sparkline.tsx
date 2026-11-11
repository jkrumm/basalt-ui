import { useId } from 'react'
import type { ReactElement } from 'react'
import { sparkGeometry } from '../core/compile-spark'
import type { SparklineProps } from '../contract'
import {
  LABEL_ROW,
  LINE_CAP,
  PLOT_INSET,
  SparkFrame,
  meanOf,
  pool,
  readoutOf,
  summaryOf,
  toRows,
  useSparkFormat,
} from './sparkline-shared'

/** The y inset of a `'fill'` plot, in the 100-unit viewBox: the dot clears the box at the extremes. */
const FILL_INSET = 5
const FILL_UNITS = 100
/** The unit width a plot is drawn in when `width` is not given: the box stretches it. */
const FLUID_UNITS = 100

/**
 * A quiet inline trend: a neutral line, or an area that fades to nothing, with the now dot on the
 * last point. Hand SVG, no engine and no tooltip. Without `axisLabels` it is an image with a name and
 * no tab stop; with them the arrow keys, Home and End (or a pointer) move a readout into the label
 * row's middle slot. No `tone`, no `color`: the dot reads `--spark-now`, which the frame sets from its
 * delta or status and is neutral outside a frame.
 *
 * @useWhen a card, a table row or a strip shows the trend of one metric in a small box
 * @neverWhen the reader needs axes, a legend or several series (use a line chart)
 *
 * @example
 * <Sparkline series={perDay} height={72} axisLabels={['Mon', 'Today', 'Sun']} ariaLabel="Shipped per day" />
 */
export function Sparkline(props: SparklineProps): ReactElement {
  const { series, ariaLabel, height, width, form = 'line', reference, axisLabels, format } = props
  const gradient = useId().replaceAll(':', '')
  const { f, fmt } = useSparkFormat(format)
  const rows = pool(toRows(series), LINE_CAP, 'line')
  const values = rows.map((r) => r.v)

  const fill = height === 'fill'
  const plotH = fill ? FILL_UNITS : Math.max(1, height - (axisLabels === undefined ? 0 : LABEL_ROW))
  const plotW = width === undefined ? FLUID_UNITS : Math.max(1, width - 2 * PLOT_INSET)
  const refValue = reference === 'mean' ? meanOf(rows) : reference
  const ref = refValue !== undefined && Number.isFinite(refValue) ? refValue : undefined
  const g = sparkGeometry({
    values,
    width: plotW,
    height: plotH,
    padY: fill ? FILL_INSET : PLOT_INSET,
    ...(ref === undefined ? {} : { reference: ref }),
  })
  const place = (i: number): { x: number; y: number } | null => {
    const v = values[i]
    return v === null || v === undefined ? null : { x: g.x(i), y: g.y(v) }
  }

  return (
    <SparkFrame
      slot="sparkline"
      ariaLabel={ariaLabel}
      summary={props.summary ?? summaryOf(rows, fmt)}
      height={height}
      width={width}
      axisLabels={axisLabels}
      rows={rows}
      readout={(row) => readoutOf(row, fmt, f)}
      indexAt={(clientX, plot) => {
        const box = plot.getBoundingClientRect()
        const fraction = box.width === 0 ? 1 : (clientX - box.left) / box.width
        return Math.min(rows.length - 1, Math.max(0, Math.round(fraction * (rows.length - 1))))
      }}
    >
      {(active) => {
        const now = active === null ? g.last : place(active)
        return (
          <>
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox={`0 0 ${plotW} ${plotH}`}
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible text-muted-foreground"
            >
              {form === 'area' && (
                <>
                  <defs>
                    <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
                      <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={g.area} fill={`url(#${gradient})`} stroke="none" />
                </>
              )}
              {ref === undefined ? null : (
                <line
                  data-slot="spark-reference"
                  x1={0}
                  x2={plotW}
                  y1={g.y(ref)}
                  y2={g.y(ref)}
                  className="stroke-line"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <path
                data-slot="spark-line"
                d={g.line}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {now === null ? null : (
              <span
                data-slot="spark-now"
                aria-hidden="true"
                className="pointer-events-none absolute size-1.5 -translate-1/2 rounded-full"
                style={{
                  left: `${(now.x / plotW) * 100}%`,
                  top: `${(now.y / plotH) * 100}%`,
                  background: 'var(--spark-now, var(--color-foreground))',
                }}
              />
            )}
          </>
        )
      }}
    </SparkFrame>
  )
}
