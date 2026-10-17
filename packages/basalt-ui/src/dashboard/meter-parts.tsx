/** Meter's internal pieces: bar, ring, empty and loading. `meter.tsx` dispatches between them. */
import { Skeleton, VisuallyHidden } from '@mantine/core'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../common/props'
import { ariaValues, modelBar, ringFraction, startCaptionText, zoneBand } from './meter-model'
import type { MeterSegment, MeterZone, Part, ZoneLabel } from './meter-model'
import classes from './meter.module.css'
import { toPct } from './scale'

export type Shell = { className: string | undefined; style: CSSProperties | undefined }

/**
 * The one root contract of every Meter state. `data-basalt-meter` is the handle `StatCard` keys its
 * visual slot on (`:has([data-basalt-meter])`), so every state must carry it.
 */
function rootProps(shell: Shell) {
  return {
    className: cx(classes.root, shell.className),
    style: shell.style,
    'data-basalt-meter': '',
  } as const
}

const RING_VIEWBOX = 36
const RING_STROKE = 4
const RING_RADIUS = (RING_VIEWBOX - RING_STROKE) / 2
const RING_LENGTH = 2 * Math.PI * RING_RADIUS
const RING_CENTER = RING_VIEWBOX / 2

/** The one ring drawing: a track and, when there is a reading, its arc (a fraction of the circle). */
function RingSvg({ fraction, color }: { fraction?: number; color?: string | undefined }) {
  return (
    <svg className={classes.ring} viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`} aria-hidden>
      <circle
        className={classes.ringTrack}
        cx={RING_CENTER}
        cy={RING_CENTER}
        r={RING_RADIUS}
        strokeWidth={RING_STROKE}
      />
      {fraction !== undefined && (
        <circle
          className={classes.ringArc}
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          strokeWidth={RING_STROKE}
          strokeDasharray={`${fraction * RING_LENGTH} ${RING_LENGTH}`}
          {...(color !== undefined && { style: { stroke: color } })}
        />
      )}
    </svg>
  )
}

export function MeterLoading({
  label,
  ring,
  shell,
}: {
  label: string
  ring: boolean
  shell: Shell
}) {
  return (
    <div {...rootProps(shell)} aria-busy="true">
      <VisuallyHidden>{`Loading ${label}`}</VisuallyHidden>
      {ring ? (
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

export function MeterEmpty(props: { label: string; text: string; ring: boolean; shell: Shell }) {
  const { label, text, ring, shell } = props
  return (
    <output {...rootProps(shell)} aria-label={label}>
      {ring ? (
        <span className={classes.ringBox}>
          <RingSvg />
        </span>
      ) : (
        <div className={classes.trackBox}>
          <div className={classes.track} data-meter-track />
        </div>
      )}
      <span className={classes.empty}>{text}</span>
    </output>
  )
}

export function MeterRing(props: {
  label: string
  reading: number
  min: number
  max: number
  color: string | undefined
  format: (value: number) => string
  shell: Shell
}) {
  const { label, reading, min, max, color, format, shell } = props
  return (
    <div {...rootProps(shell)}>
      <span
        className={classes.ringBox}
        aria-label={label}
        {...ariaValues(reading, min, max, format)}
      >
        <RingSvg fraction={ringFraction(reading, min, max)} color={color} />
        <span className={classes.ringValue}>{format(reading)}</span>
      </span>
    </div>
  )
}

function fillStyle(p: Part): CSSProperties {
  return { width: `${toPct(p.size)}%`, ...(p.color !== undefined && { background: p.color }) }
}

/** Uncoloured zones step from `MIN` to `MIN + STEP` percent of the neutral, so order reads without hue. */
const ZONE_STRENGTH_MIN = 15
const ZONE_STRENGTH_STEP = 45
const ZONE_STRENGTH_SOLO = 40
/** Every band after the first gives up its leading pixel, so a boundary never relies on fill strength. */
const ZONE_GAP = '1px'

function zoneStyle(zone: MeterZone, index: number, count: number, min: number, span: number) {
  const band = zoneBand(zone, min, span)
  const gap = index > 0
  const strength =
    count > 1 ? ZONE_STRENGTH_MIN + (index / (count - 1)) * ZONE_STRENGTH_STEP : ZONE_STRENGTH_SOLO
  return {
    insetInlineStart: gap ? `calc(${band.start}% + ${ZONE_GAP})` : `${band.start}%`,
    width: gap ? `calc(${band.width}% - ${ZONE_GAP})` : `${band.width}%`,
    background: zone.color ?? `color-mix(in srgb, var(--vx-line) ${strength}%, transparent)`,
  } satisfies CSSProperties
}

/** Overlap on one axis between neighbouring label boxes, or a box leaving the row, is a collision. */
function collides(boxes: readonly DOMRect[], row: DOMRect): boolean {
  const sorted = boxes.toSorted((a, b) => a.left - b.left)
  return sorted.some(
    (box, i) =>
      box.left < row.left - 0.5 ||
      box.right > row.right + 0.5 ||
      (i > 0 && box.left < (sorted[i - 1]?.right ?? 0) + 0.5),
  )
}

/**
 * Names each zone under its band, the holding one in ink. Labels sit left-aligned at their band
 * start; when two would overlap (or one would leave the row) the band hides and the same names wrap
 * as a list in zone order instead. The band stays laid out (hidden, not removed) so a resize can
 * measure it again. Decorative: the zone names and the holding zone are in the described-by text.
 */
function ZoneLabels({ labels }: { labels: readonly ZoneLabel[] }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [list, setList] = useState(false)

  useLayoutEffect(() => {
    const row = rowRef.current
    if (!row) return
    const measure = () => {
      const boxes = [...row.children].map((c) => c.getBoundingClientRect())
      setList(collides(boxes, row.getBoundingClientRect()))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => observer.disconnect()
  }, [labels])

  return (
    <>
      <div
        ref={rowRef}
        className={classes.zoneBand}
        data-meter-zone-labels="band"
        data-collapsed={list || undefined}
        aria-hidden
      >
        {labels.map((l) => (
          <span
            key={l.key}
            className={cx(classes.zoneLabel, l.holding && classes.zoneLabelHolding)}
            data-meter-zone-label={l.label}
            data-holding={l.holding || undefined}
            style={{ insetInlineStart: `${l.startPct}%` }}
          >
            {l.label}
          </span>
        ))}
      </div>
      {list && (
        <div className={classes.zoneList} data-meter-zone-labels="list" aria-hidden>
          {labels.map((l) => (
            <span
              key={l.key}
              className={cx(classes.zoneListItem, l.holding && classes.zoneLabelHolding)}
              data-meter-zone-label={l.label}
              data-holding={l.holding || undefined}
            >
              {l.label}
            </span>
          ))}
        </div>
      )}
    </>
  )
}

export function MeterBar(props: {
  label: string
  reading: number
  min: number
  max: number
  format: (value: number) => string
  color: string | undefined
  segments: readonly MeterSegment[] | undefined
  zones: readonly MeterZone[] | undefined
  target: number | undefined
  forecastCaption: string | undefined
  startCaption: ReactNode
  endCaption: ReactNode
  shell: Shell
}) {
  const { label, reading, min, max, format, zones, shell } = props
  const describedId = useId()
  const model = modelBar(props)
  const start = startCaptionText(model, props.startCaption)
  const end = props.endCaption === undefined ? model.endText : props.endCaption
  const hasCaptions = start !== null || end !== null || model.forecastText !== null
  const hasParts = model.partCaptions.length > 0
  const describedBy =
    model.describedByText === null ? {} : ({ 'aria-describedby': describedId } as const)

  return (
    <div {...rootProps(shell)}>
      <div
        className={classes.trackBox}
        aria-label={label}
        {...ariaValues(reading, min, max, format)}
        {...describedBy}
      >
        <div className={classes.track} data-meter-track>
          {model.markerPct !== undefined &&
            zones?.map((z, i) => (
              <div
                key={i}
                className={classes.zone}
                data-meter-zone={z.label}
                style={zoneStyle(z, i, zones.length, min, model.span)}
              />
            ))}
          {model.parts.map((p, i) => (
            <div
              key={i}
              className={cx(classes.fill, p.forecast && classes.forecastFill)}
              data-meter-fill={p.forecast ? 'forecast' : 'committed'}
              style={fillStyle(p)}
            />
          ))}
        </div>
        <Tick kind="marker" className={classes.marker} pct={model.markerPct} />
        <Tick kind="boundary" className={classes.boundaryTick} pct={model.boundaryPct} />
        <Tick kind="target" className={classes.tick} pct={model.targetPct} />
      </div>
      {model.zoneLabels.length > 0 && <ZoneLabels labels={model.zoneLabels} />}
      {model.describedByText !== null && (
        <VisuallyHidden id={describedId}>{model.describedByText}</VisuallyHidden>
      )}
      {hasParts && (
        // The explicit role is deliberate: `list-style: none` makes Safari/VoiceOver drop the implicit one.
        // oxlint-disable-next-line jsx-a11y/no-redundant-roles
        <ul className={classes.partCaptions} role="list" data-meter-parts>
          {model.partCaptions.map((c) => (
            <li key={c.key} className={classes.partCaption}>
              <span
                className={classes.swatch}
                // theme-allow hidden-inline-style — the swatch repeats the part's fill colour (data)
                style={{ background: c.color ?? 'var(--vx-line)' }}
                aria-hidden
              />
              {c.label} {c.text}
            </li>
          ))}
        </ul>
      )}
      {hasCaptions && (
        <div className={classes.captions} data-meter-captions>
          {start !== null && <span className={classes.caption}>{start}</span>}
          {model.forecastText !== null && (
            <span className={classes.caption}>{model.forecastText}</span>
          )}
          {end !== null && <span className={classes.captionEnd}>{end}</span>}
        </div>
      )}
    </div>
  )
}

function Tick({
  kind,
  className,
  pct,
}: {
  kind: 'marker' | 'boundary' | 'target'
  className: string
  pct: number | undefined
}) {
  if (pct === undefined) return null
  return (
    <div
      className={className}
      data-meter-tick={kind}
      style={{ insetInlineStart: `${pct}%` }}
      aria-hidden
    />
  )
}
