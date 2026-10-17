/**
 * Meter — one bounded quantity on a track: progress to a target, a committed/forecast split, a
 * part-of-a-whole strip (`segments`), or a single headline ratio as a `ring`. Choose it for "how far
 * along is this against a limit"; choose `BarList` for a ranking and a chart for a trend. An HTML/CSS
 * primitive, not a chart kind (no scale, axis or tooltip).
 *
 * Colour law: the fill is neutral (`VX.line`). `color` is for a VERDICT only (over budget, below
 * target) and is a status colour the consumer passes; categorical `segments` take the consumer's
 * series colours. Committed vs forecast is the same neutral at two strengths — never colour alone: a
 * tick marks the boundary and a caption names the forecast. A value past `max` clamps the fill at the
 * track end; the caption still states the real value.
 *
 * @example
 * import { Meter } from 'basalt-ui'
 *
 * <Meter label="Monthly budget" value={412} max={500} target={450} format={usd} />
 * <Meter
 *   label="Course progress"
 *   max={120}
 *   segments={[{ value: 70, label: 'Done' }, { value: 25, label: 'Planned', forecast: true }]}
 * />
 * <Meter shape="ring" label="Cache hit rate" value={87} max={100} format={(v) => `${v}%`} />
 */
import { Skeleton, VisuallyHidden } from '@mantine/core'
import { useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../common/props'
import type { BasaltProps } from '../common/props'
import classes from './meter.module.css'

export type MeterProps = BasaltProps & {
  /** Accessible name (`aria-label`). Required: a meter without one is announced as a bare number. */
  label: string
  /** The reading. `null`/`undefined` (with no `segments`) renders the empty state. */
  value?: number | null | undefined
  /** Track start. Default 0. */
  min?: number
  /** Track end. Default 100. */
  max?: number
  /** `'bar'` (default) or `'ring'` — one ring per card, value centred. */
  shape?: 'bar' | 'ring'
  /** A status colour, for a verdict only. Omit for the neutral fill. */
  color?: string
  /** Ordered parts. Their sum is the reading; `value` is ignored. `forecast` parts render lighter. */
  segments?: readonly { value: number; label: string; color?: string; forecast?: boolean }[]
  /** Target position; draws a tick (bar) and states it in the end caption. */
  target?: number
  /** Formats values in captions and the accessible text. Default: the number as written. */
  format?: (value: number) => string
  /** Start caption (default: the formatted reading). Pass `null` to drop it. */
  startCaption?: ReactNode
  /** End caption (default: `Target <target>` when a target is set). Pass `null` to drop it. */
  endCaption?: ReactNode
  /** Names the forecast beside the boundary tick (default: `Forecast: <labels>`). */
  forecastCaption?: string
  /** Renders a skeleton with the meter's footprint. */
  loading?: boolean
  /** Muted line shown when there is no reading. The track stays so the footprint holds. */
  emptyText?: string
}

const RING_VIEWBOX = 36
const RING_STROKE = 4
const RING_RADIUS = (RING_VIEWBOX - RING_STROKE) / 2
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))
const asText = (n: number): string => String(n)

type Part = {
  readonly start: number
  readonly size: number
  readonly label: string | undefined
  readonly color: string | undefined
  readonly forecast: boolean
}

/** Fractions of the track: each part starts where the last stopped and never passes the end. */
function layout(
  parts: readonly { value: number; label?: string; color?: string; forecast?: boolean }[],
  span: number,
): Part[] {
  let cursor = 0
  return parts.map((p) => {
    const size = Math.min(clamp01(p.value / span), 1 - cursor)
    const part = {
      start: cursor,
      size: Math.max(0, size),
      label: p.label,
      color: p.color,
      forecast: p.forecast === true,
    }
    cursor += part.size
    return part
  })
}

export function Meter({
  label,
  value,
  min = 0,
  max = 100,
  shape = 'bar',
  color,
  segments,
  target,
  format = asText,
  startCaption,
  endCaption,
  forecastCaption,
  loading = false,
  emptyText = 'No data',
  className,
  style,
}: MeterProps) {
  const describedId = useId()
  const isRing = shape === 'ring'

  if (loading) {
    return (
      <div className={cx(classes.root, className)} style={style} aria-busy="true">
        <VisuallyHidden>{`Loading ${label}`}</VisuallyHidden>
        {isRing ? (
          <Skeleton className={classes.skeletonRing} circle />
        ) : (
          <>
            <Skeleton className={classes.skeletonTrack} />
            <Skeleton className={classes.skeletonCaption} radius="sm" />
          </>
        )}
      </div>
    )
  }

  const span = max - min > 0 ? max - min : 1
  const hasSegments = segments !== undefined && segments.length > 0
  const reading = hasSegments
    ? segments.reduce((sum, s) => sum + s.value, 0)
    : value === null || value === undefined
      ? undefined
      : value

  if (reading === undefined) {
    return (
      <div className={cx(classes.root, className)} style={style}>
        {isRing ? (
          <span className={classes.ringBox}>
            <svg
              className={classes.ring}
              viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`}
              aria-hidden
            >
              <circle
                className={classes.ringTrack}
                cx={RING_VIEWBOX / 2}
                cy={RING_VIEWBOX / 2}
                r={RING_RADIUS}
                strokeWidth={RING_STROKE}
              />
            </svg>
          </span>
        ) : (
          <div className={classes.trackBox}>
            <div className={classes.track} data-meter-track />
          </div>
        )}
        <span className={classes.empty}>{emptyText}</span>
      </div>
    )
  }

  const parts = hasSegments
    ? layout(segments, span)
    : layout([{ value: reading - min, ...(color !== undefined && { color }) }], span)
  const firstForecast = parts.findIndex((p) => p.forecast)
  const boundary = firstForecast > 0 ? parts[firstForecast]?.start : undefined
  const forecastLabels = hasSegments
    ? segments.filter((s) => s.forecast === true).map((s) => `${s.label} ${format(s.value)}`)
    : []
  const targetPct = target === undefined ? undefined : clamp01((target - min) / span) * 100

  const start = startCaption === undefined ? format(reading) : startCaption
  const end =
    endCaption === undefined
      ? target === undefined
        ? null
        : `Target ${format(target)}`
      : endCaption
  const forecastText =
    boundary === undefined ? null : (forecastCaption ?? `Forecast: ${forecastLabels.join(', ')}`)

  const describedBy = [
    ...(hasSegments
      ? segments.map((s) => `${s.label} ${format(s.value)}${s.forecast ? ' (forecast)' : ''}`)
      : []),
    ...(target === undefined ? [] : [`Target ${format(target)}`]),
  ]
  const ariaProps = {
    role: 'meter',
    'aria-label': label,
    'aria-valuenow': Math.min(max, Math.max(min, reading)),
    'aria-valuemin': min,
    'aria-valuemax': max,
    'aria-valuetext': format(reading),
    ...(describedBy.length > 0 && { 'aria-describedby': describedId }),
  } as const
  const hidden =
    describedBy.length > 0 ? (
      <VisuallyHidden id={describedId}>{describedBy.join('; ')}</VisuallyHidden>
    ) : null

  if (isRing) {
    return (
      <div className={cx(classes.root, className)} style={style}>
        <span className={classes.ringBox} {...ariaProps}>
          <svg className={classes.ring} viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`} aria-hidden>
            <circle
              className={classes.ringTrack}
              cx={RING_VIEWBOX / 2}
              cy={RING_VIEWBOX / 2}
              r={RING_RADIUS}
              strokeWidth={RING_STROKE}
            />
            {parts.map((p, i) => (
              <circle
                key={i}
                className={cx(classes.ringArc, p.forecast && classes.ringForecast)}
                cx={RING_VIEWBOX / 2}
                cy={RING_VIEWBOX / 2}
                r={RING_RADIUS}
                strokeWidth={RING_STROKE}
                strokeDasharray={`${p.size * RING_LENGTH} ${RING_LENGTH}`}
                strokeDashoffset={-p.start * RING_LENGTH}
                {...(p.color !== undefined && { style: { stroke: p.color } })}
              />
            ))}
          </svg>
          <span className={classes.ringValue}>{format(reading)}</span>
        </span>
        {hidden}
      </div>
    )
  }

  return (
    <div className={cx(classes.root, className)} style={style}>
      <div className={classes.trackBox} {...ariaProps}>
        <div className={classes.track} data-meter-track>
          {parts.map((p, i) => (
            <div
              key={i}
              className={cx(classes.fill, p.forecast && classes.forecastFill)}
              data-meter-fill={p.forecast ? 'forecast' : 'committed'}
              style={fillStyle(p)}
            />
          ))}
        </div>
        {boundary !== undefined && (
          <div
            className={classes.boundaryTick}
            data-meter-tick="boundary"
            style={{ insetInlineStart: `${boundary * 100}%` }}
            aria-hidden
          />
        )}
        {targetPct !== undefined && (
          <div
            className={classes.tick}
            data-meter-tick="target"
            style={{ insetInlineStart: `${targetPct}%` }}
            aria-hidden
          />
        )}
      </div>
      {hidden}
      {(start !== null || end !== null || forecastText !== null) && (
        <div className={classes.captions}>
          {start !== null && <span className={classes.caption}>{start}</span>}
          {forecastText !== null && <span className={classes.caption}>{forecastText}</span>}
          {end !== null && <span className={classes.captionEnd}>{end}</span>}
        </div>
      )}
    </div>
  )
}

function fillStyle(p: Part): CSSProperties {
  return {
    width: `${p.size * 100}%`,
    ...(p.color !== undefined && { background: p.color }),
  }
}
