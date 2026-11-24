import { useId } from 'react'
import type { ReactElement } from 'react'
import { capValues, sparkGeometry } from '../core/compile-spark'
import type { SparklineProps } from '../contract'
import {
  LABEL_ROW,
  LINE_CAP,
  OFF_SCALE_CARET,
  PLOT_INSET,
  SparkFrame,
  announceOf,
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
/** The room over the plot an off-scale caret takes: px, and units of a `'fill'` plot's 100. */
const CARET_ROOM = 6
const FILL_CARET_ROOM = 8
/**
 * The strength the line keeps round a stepped point: the kinds' `DIMMED`, restated so the sparkline
 * does not pull the chart theme (and the token table) into its bundle.
 */
const DIMMED = 0.5

/**
 * A quiet inline trend: a neutral line, or an area that fades to nothing, with the now dot on the
 * last point. Hand SVG, no engine and no tooltip. Without `axisLabels` it is an image with a name and
 * no tab stop; with them it is a chart host: the arrow keys, Home and End (or a pointer) move a readout
 * of the point's x and y (`18 · W41`: its `label`, else its day, else its place, `#8`) into the label
 * row's middle slot, a polite live region reads each step, the line dims round the point and a guide
 * crosses it to both edges. `cap` holds an outlier on the top edge under an
 * off-scale caret. No `tone`, no `color`: the dot reads `--spark-now`, which the frame sets from its
 * delta or status and is neutral outside a frame.
 *
 * @useWhen a card, a table row or a strip shows the trend of one metric in a small box
 * @neverWhen the reader needs axes, a legend or several series (use a line chart)
 *
 * @example
 * <Sparkline points={perDay} height={72} axisLabels={['Mon', 'Today', 'Sun']} label="Shipped per day" />
 * <Sparkline
 *   points={weeks.map((w) => ({ value: w.hours, label: w.name }))}
 *   cap={12}
 *   height={56}
 *   axisLabels={['W41', 'Time in queue', 'W52']}
 *   label="Time in queue per week"
 * />
 */
export function Sparkline(props: SparklineProps): ReactElement {
  const { points, height, width, form = 'line', reference, cap, axisLabels, format } = props
  const ariaLabel = props.label
  const gradient = useId().replaceAll(':', '')
  const { f, fmt } = useSparkFormat(format)
  const rows = pool(toRows(points), LINE_CAP, 'line')
  const { values, over } = capValues(
    rows.map((r) => r.v),
    cap,
  )

  const fill = height === 'fill'
  const plotH = fill ? FILL_UNITS : Math.max(1, height - (axisLabels === undefined ? 0 : LABEL_ROW))
  const plotW = width === undefined ? FLUID_UNITS : Math.max(1, width - 2 * PLOT_INSET)
  const refValue = reference === 'mean' ? meanOf(rows) : reference
  const refEnds =
    typeof refValue === 'object'
      ? [refValue.min, refValue.max]
      : refValue === undefined
        ? []
        : [refValue]
  // A reference above the cap would stretch the plot past it again: a lone line there is not drawn,
  // and a range's end is held at the cap so its band still reaches the top edge.
  const held =
    cap === undefined
      ? refEnds
      : refEnds.length === 2
        ? refEnds.map((v) => Math.min(v, cap))
        : refEnds.filter((v) => v <= cap)
  const refs = held.every(Number.isFinite) ? held : []
  const g = sparkGeometry({
    values,
    width: plotW,
    height: plotH,
    padY: fill ? FILL_INSET : PLOT_INSET,
    padTop: over.length === 0 ? 0 : fill ? FILL_CARET_ROOM : CARET_ROOM,
    ...(refs.length === 0 ? {} : { reference: refs }),
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
      announce={(row) => announceOf(row, fmt, f)}
      indexAt={(clientX, plot) => {
        const box = plot.getBoundingClientRect()
        const fraction = box.width === 0 ? 1 : (clientX - box.left) / box.width
        return Math.min(rows.length - 1, Math.max(0, Math.round(fraction * (rows.length - 1))))
      }}
    >
      {(active) => {
        const now = active === null ? g.last : place(active)
        // A stepped point is the mark in focus: the line dims round it, as a chart kind dims the rest.
        const dim = active === null ? 1 : DIMMED
        const guideX = active === null ? null : g.x(active)
        const guideY = now === null || active === null ? null : now.y
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
                  <path d={g.area} fill={`url(#${gradient})`} fillOpacity={dim} stroke="none" />
                </>
              )}
              {guideX === null ? null : (
                <line
                  data-slot="spark-guide"
                  x1={guideX}
                  x2={guideX}
                  y1={0}
                  y2={plotH}
                  stroke="currentColor"
                  strokeOpacity={DIMMED}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {guideY === null ? null : (
                <line
                  data-slot="spark-guide-y"
                  x1={0}
                  x2={plotW}
                  y1={guideY}
                  y2={guideY}
                  stroke="currentColor"
                  strokeOpacity={DIMMED}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {refs.length === 2 && (
                <rect
                  data-slot="spark-band"
                  x={0}
                  y={Math.min(g.y(refs[0]!), g.y(refs[1]!))}
                  width={plotW}
                  height={Math.abs(g.y(refs[0]!) - g.y(refs[1]!))}
                  className="fill-line"
                  fillOpacity={0.25}
                />
              )}
              {refs.map((v, i) => (
                <line
                  key={i}
                  data-slot="spark-reference"
                  x1={0}
                  x2={plotW}
                  y1={g.y(v)}
                  y2={g.y(v)}
                  className="stroke-line"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path
                data-slot="spark-line"
                d={g.line}
                fill="none"
                stroke="currentColor"
                strokeOpacity={dim}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {over.map((i) => (
              <span
                key={i}
                data-slot="spark-caret"
                aria-hidden="true"
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-[6px] leading-none text-muted-foreground"
                style={{
                  left: `${(g.x(i) / plotW) * 100}%`,
                  top: `${(g.y(cap ?? 0) / plotH) * 100}%`,
                }}
              >
                {OFF_SCALE_CARET}
              </span>
            ))}
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
