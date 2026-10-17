/** Meter's internal pieces: bar, ring, empty and loading. `meter.tsx` dispatches between them. */
import { Skeleton, VisuallyHidden } from '@mantine/core'
import { useContext, useId, useRef, useState } from 'react'
import type { CSSProperties, HTMLAttributes, ReactNode, RefObject } from 'react'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import { cx } from '../common/props'
import {
  ariaValues,
  modelBar,
  ringFraction,
  startCaptionText,
  zoneBand,
  zoneLabelsFit,
} from './meter-model'
import type { MeterSegment, MeterTick, MeterZone, Part, TickMark, ZoneLabel } from './meter-model'
import classes from './meter.module.css'
import { VisualSlotContext } from './visual-slot'
import { toPct } from './scale'

export type Shell = {
  className: string | undefined
  style: CSSProperties | undefined
  /** `size="row"`: one text line tall, no caption rows. */
  row: boolean
}

/**
 * The one root contract of every Meter state. `data-basalt-meter` is the handle `StatCard` keys its
 * visual slot on (`:has([data-basalt-meter])`), so every state must carry it.
 */
function rootProps(shell: Shell) {
  return {
    className: cx(classes.root, shell.row && classes.row, shell.className),
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

/**
 * A value and its unit stay on one line: a no-break space replaces the space between a digit and a
 * known unit ("24 h", "7 d", "5 min", "40 %"), so a caption never wraps to a lone "d". Any other
 * word ("3 of 7", "250 over") keeps its ordinary space.
 */
const UNITS = 'h|d|w|mo|y|s|ms|min|m|km|mi|g|kg|%|€|pts|bpm|AU|kcal|KB|MB|GB|TB'
const UNIT_AFTER_NUMBER = new RegExp(`(\\d) (?=(?:${UNITS})(?![\\p{L}\\d]))`, 'gu')
/** The last two words of a caption Meter composes are one unit when the last is short, so no
 * line ends on a lone "budget" or "d". */
// Ordinary spaces only: an already-glued unit (`7\u00a0d`) counts as one word.
const SHORT_LAST_WORD = /([^ ]) ([^ ]{1,6})$/u
const glueUnits = (text: ReactNode): ReactNode =>
  typeof text === 'string' ? text.replace(UNIT_AFTER_NUMBER, '$1\u00a0') : text
const glue = (text: ReactNode): ReactNode =>
  typeof text === 'string' ? String(glueUnits(text)).replace(SHORT_LAST_WORD, '$1\u00a0$2') : text

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
      <VisuallyHidden className={classes.summary}>{`Loading ${label}`}</VisuallyHidden>
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

/**
 * Joins the names with a character no label carries, so the effect re-runs only when they change.
 * The holding zone is part of the key: its label is bolder, so a reading that crosses a boundary
 * changes widths with no row resize.
 */
const labelsKey = (labels: readonly ZoneLabel[]) =>
  labels.map((l) => l.label + (l.holding ? '*' : '')).join('\u0000')

/**
 * Whether the zone names fit on the band, re-measured when the row resizes, when web fonts finish
 * loading (a mono swap changes label widths without resizing the row) and when the names change.
 * Server markup shows the band; the list may appear after mount, when the measurement fails.
 */
function useZoneLabelLayout(rowRef: RefObject<HTMLDivElement | null>, key: string): boolean {
  const [fits, setFits] = useState(true)

  // Keyed on a string of the names, not the `labels` array: the model rebuilds that every render.
  useIsomorphicLayoutEffect(() => {
    const row = rowRef.current
    if (!row) return
    const measure = () => {
      const origin = row.getBoundingClientRect()
      const boxes = [...row.children].map((c) => {
        const r = c.getBoundingClientRect()
        return { left: r.left - origin.left, right: r.right - origin.left }
      })
      setFits(zoneLabelsFit(boxes, origin.width))
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(row)
    // `document.fonts` is absent (or partial) outside a full browser; every use is guarded.
    const fonts =
      typeof document === 'undefined' ? undefined : (document.fonts as FontFaceSet | undefined)
    let live = true
    void fonts?.ready?.then(() => live && measure())
    fonts?.addEventListener?.('loadingdone', measure)
    return () => {
      live = false
      observer?.disconnect()
      fonts?.removeEventListener?.('loadingdone', measure)
    }
  }, [rowRef, key])

  return fits
}

/**
 * The reading on a zoned track, centred on the marker so number and notch are one mark. Measured,
 * its start edge is clamped to the row (a label wider than the row overflows the end, never the
 * start) and placed logically, so it holds under `dir="rtl"`. Observing the label as well as the row
 * catches a font swap that changes its width with no row resize. Until the first measure (server
 * markup) it sits at the marker, centred by a direction-aware translate, and the row clips.
 */
function ZoneReading({ pct, children }: { pct: number; children: ReactNode }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [start, setStart] = useState<number>()
  useIsomorphicLayoutEffect(() => {
    const row = rowRef.current
    const text = textRef.current
    if (!row || !text) return
    const measure = () => {
      const centre = (row.clientWidth * pct) / 100
      setStart(
        Math.max(0, Math.min(centre - text.offsetWidth / 2, row.clientWidth - text.offsetWidth)),
      )
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    observer.observe(text)
    return () => observer.disconnect()
  }, [pct])
  return (
    <div ref={rowRef} className={classes.zoneReadingRow} data-meter-reading-row>
      <span
        ref={textRef}
        className={classes.zoneReading}
        data-measured={start === undefined ? undefined : ''}
        style={{ insetInlineStart: start === undefined ? `${pct}%` : `${start}px` }}
      >
        {children}
      </span>
    </div>
  )
}

function ZoneName({ label, ...rest }: { label: ZoneLabel } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...rest}
      className={cx(rest.className, label.holding && classes.zoneLabelHolding)}
      data-meter-zone-label={label.label}
      data-holding={label.holding || undefined}
    >
      {label.label}
    </span>
  )
}

/**
 * Names each zone under its band, the holding one in ink and a heavier weight. Labels sit
 * left-aligned at their band start; when two would overlap (or one would leave the row) the band
 * hides and the same names wrap as a list in zone order instead. The band stays laid out (hidden,
 * not removed) so a resize can measure it again. Decorative: the zone names and the holding zone
 * are in the described-by text.
 */
function ZoneLabels({ labels }: { labels: readonly ZoneLabel[] }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const fits = useZoneLabelLayout(rowRef, labelsKey(labels))

  return (
    <>
      <div
        ref={rowRef}
        className={classes.zoneBand}
        data-meter-zone-band
        data-collapsed={fits ? undefined : ''}
        aria-hidden
      >
        {labels.map((l) => (
          <ZoneName
            key={l.key}
            label={l}
            className={classes.zoneLabel}
            style={{ insetInlineStart: `${l.startPct}%` }}
          />
        ))}
      </div>
      {!fits && (
        <div className={classes.zoneList} data-meter-zone-list aria-hidden>
          {labels.map((l) => (
            <ZoneName key={l.key} label={l} className={classes.zoneListItem} />
          ))}
        </div>
      )}
    </>
  )
}

/** Ticks past the middle caption to the left of their mark, so a caption near the end stays on the row. */
const TICK_LABEL_FLIP_PCT = 50

/**
 * Captions the labelled ticks above the track, each hugging its mark. Same fit rule as the zone names:
 * when two would overlap (or one would leave the row) the band hides and the labels wrap as a list in
 * tick order. Decorative: the ticks are in the described-by text.
 */
function TickLabels({ ticks }: { ticks: readonly TickMark[] }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const fits = useZoneLabelLayout(rowRef, ticks.map((t) => `${t.label}@${t.pct}`).join('\u0000'))
  return (
    <div className={classes.tickLabels}>
      <div
        ref={rowRef}
        className={classes.tickBand}
        data-meter-tick-band
        data-collapsed={fits ? undefined : ''}
        aria-hidden
      >
        {ticks.map((t) => (
          <span
            key={t.key}
            className={classes.tickLabel}
            data-meter-tick-label=""
            style={
              t.pct > TICK_LABEL_FLIP_PCT
                ? { insetInlineEnd: `${100 - t.pct}%` }
                : { insetInlineStart: `${t.pct}%` }
            }
          >
            {t.label}
          </span>
        ))}
      </div>
      {!fits && (
        <div className={classes.zoneList} data-meter-tick-list aria-hidden>
          {ticks.map((t) => (
            <span key={t.key} className={classes.zoneListItem}>
              {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
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
  ticks: readonly MeterTick[] | undefined
  tone: 'muted' | undefined
  forecastCaption: string | undefined
  startCaption: ReactNode
  endCaption: ReactNode
  shell: Shell
}) {
  const { label, reading, min, max, format, zones, shell } = props
  const describedId = useId()
  const model = modelBar(props)
  const compact = shell.row
  // A host that already shows the value as its hero (StatCard, a strip cell) owns the reading: a
  // zoned track keeps its marker and zone labels but does not print the number a second time.
  const hosted = useContext(VisualSlotContext) && model.markerPct !== undefined
  const start = compact || hosted ? null : startCaptionText(model, props.startCaption)
  const end = compact ? null : props.endCaption === undefined ? model.endText : props.endCaption
  const anchored = model.markerPct !== undefined && start !== null
  const hasCaptions =
    (start !== null && !anchored) || end !== null || (!compact && model.forecastText !== null)
  const hasParts = !compact && model.partCaptions.length > 0
  const tickLabels = compact ? [] : model.ticks.filter((t) => t.label !== undefined)
  const describedBy =
    model.describedByText === null ? {} : ({ 'aria-describedby': describedId } as const)

  const root = rootProps(shell)
  return (
    <div
      {...root}
      className={cx(root.className, !compact && model.zoneLabels.length > 0 && classes.zoned)}
    >
      {tickLabels.length > 0 && <TickLabels ticks={tickLabels} />}
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
              data-tone={
                props.tone === 'muted' && p.color === undefined && !p.forecast ? 'muted' : undefined
              }
              style={fillStyle(p)}
            />
          ))}
        </div>
        <Tick kind="marker" className={classes.marker} pct={model.markerPct} />
        <Tick kind="boundary" className={classes.boundaryTick} pct={model.boundaryPct} />
        {model.ticks.map((t) => (
          <Tick key={t.key} kind="tick" className={classes.tick} pct={t.pct} />
        ))}
        <Tick kind="target" className={classes.tick} pct={model.targetPct} />
      </div>
      {!compact && model.zoneLabels.length > 0 && <ZoneLabels labels={model.zoneLabels} />}
      {anchored && <ZoneReading pct={model.markerPct ?? 0}>{start}</ZoneReading>}
      {model.describedByText !== null && (
        <VisuallyHidden id={describedId} className={classes.summary}>
          {model.describedByText}
        </VisuallyHidden>
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
              {glueUnits(`${c.label} ${c.text}`)}
            </li>
          ))}
        </ul>
      )}
      {hasCaptions && (
        <div className={classes.captions} data-meter-captions>
          {start !== null && !anchored && <span className={classes.caption}>{glue(start)}</span>}
          {!compact && model.forecastText !== null && (
            <span className={classes.caption}>{glue(model.forecastText)}</span>
          )}
          {end !== null && <span className={classes.captionEnd}>{glue(end)}</span>}
        </div>
      )}
    </div>
  )
}

/** A tick's width: the end tick's start edge sits this far inside the track. */
const TICK_WIDTH = '2px'

/**
 * Centred on its percent. A target or tick AT the track end is the exception: centred there it is
 * half outside the track (and hidden by a full fill), so its end edge sits ON the track end and it
 * reads inside. The marker is the reading itself and stays centred.
 */
function tickPosition(kind: TickKind, pct: number): CSSProperties {
  if (pct < 100 || kind === 'marker' || kind === 'boundary') return { insetInlineStart: `${pct}%` }
  return { insetInlineStart: `calc(100% - ${TICK_WIDTH})`, marginInlineStart: 0 }
}

type TickKind = 'marker' | 'boundary' | 'target' | 'tick'

function Tick({
  kind,
  className,
  pct,
}: {
  kind: TickKind
  className: string
  pct: number | undefined
}) {
  if (pct === undefined) return null
  return (
    <div className={className} data-meter-tick={kind} style={tickPosition(kind, pct)} aria-hidden />
  )
}
