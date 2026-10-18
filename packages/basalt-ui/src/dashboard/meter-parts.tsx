/** Meter's internal pieces: bar, ring, empty and loading. `meter.tsx` dispatches between them. */
import { Skeleton, VisuallyHidden } from '@mantine/core'
import { useContext, useId, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import { cx } from '../common/props'
import {
  ariaValues,
  modelBar,
  partColumns,
  partsFitUnder,
  placeCaptionRow,
  placeRowLabels,
  ringFraction,
  ringMarks,
  startCaptionText,
  zoneBand,
  zoneFill,
} from './meter-model'
import type {
  MarkItem,
  MeterSegment,
  MeterTick,
  MeterZone,
  Part,
  PartCaption,
  RowLabel,
  TickMark,
  ZoneLabel,
} from './meter-model'
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

/** A ring tick spans from just inside the stroke's inner edge to just inside the box. */
const RING_TICK_INNER = RING_RADIUS - RING_STROKE / 2 - 0.75
const RING_TICK_OUTER = RING_VIEWBOX / 2 - 0.5

/** The one ring drawing: a track and, when there is a reading, its arc (a fraction of the circle). */
function RingSvg({
  fraction,
  color,
  marks = [],
}: {
  fraction?: number
  color?: string | undefined
  marks?: readonly { angle: number }[]
}) {
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
      {marks.map((m, i) => (
        // The svg is rotated so 0° is the top: a horizontal line at the rim, turned `angle` clockwise.
        <g key={i} data-meter-ring-tick="">
          {[classes.ringTickHalo, classes.ringTick].map((cls, n) => (
            <line
              key={n}
              className={cls}
              x1={RING_CENTER + RING_TICK_INNER}
              x2={RING_CENTER + RING_TICK_OUTER}
              y1={RING_CENTER}
              y2={RING_CENTER}
              transform={`rotate(${m.angle} ${RING_CENTER} ${RING_CENTER})`}
            />
          ))}
        </g>
      ))}
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

/**
 * One caption-height line, so a placeholder row stands where the loaded Meter's caption, figure or
 * zone-name row will (a zoned track's rows are `1.25em`, as its label rows). Not announced; the root carries the state.
 */
function Line({ zoned, children }: { zoned: boolean; children?: ReactNode }) {
  return (
    <div className={cx(classes.line, zoned && classes.lineZoned)} data-meter-line aria-hidden>
      {children}
    </div>
  )
}

/**
 * The loaded Meter's footprint at its loaded height: a zoned track keeps the figure row above and the
 * zone-name row below, a plain bar the caption row below, so the card does not jump when data lands.
 */
export function MeterLoading({
  label,
  ring,
  zoned,
  shell,
}: {
  label: string
  ring: boolean
  zoned: boolean
  shell: Shell
}) {
  return (
    <div {...rootProps(shell)} aria-busy="true">
      <VisuallyHidden className={classes.summary}>{`Loading ${label}`}</VisuallyHidden>
      {ring ? (
        <Skeleton className={classes.skeletonRing} circle />
      ) : (
        <>
          {zoned && (
            <Line zoned={zoned}>
              <Skeleton className={classes.skeletonCaption} radius="sm" />
            </Line>
          )}
          <Skeleton className={classes.skeletonTrack} />
          <Line zoned={zoned}>
            <Skeleton className={classes.skeletonCaption} radius="sm" />
          </Line>
        </>
      )}
    </div>
  )
}

const EMPTY_READING = '—'

export function MeterEmpty(props: {
  label: string
  text: string | undefined
  ring: boolean
  zoned: boolean
  shell: Shell
}) {
  const { label, text, ring, zoned, shell } = props
  // The ring has a reading slot (its centre), so the dash sits there as the reading. A bar states its
  // gap once, and only if the host says so (`text`): otherwise the caption rows a loaded Meter would
  // have stay blank, so the muted track keeps the loaded height without a dash under it.
  return (
    <output {...rootProps(shell)} aria-label={label}>
      {ring ? (
        <span className={classes.ringBox}>
          <RingSvg />
          <span className={classes.ringValue}>{EMPTY_READING}</span>
        </span>
      ) : (
        <>
          {zoned && !shell.row && <Line zoned />}
          <div className={classes.trackBox}>
            <div className={classes.track} data-meter-track />
          </div>
        </>
      )}
      {text !== undefined ? (
        <span className={classes.empty}>{text}</span>
      ) : (
        !ring && (
          <>
            <VisuallyHidden className={classes.summary}>No reading</VisuallyHidden>
            {!shell.row && <Line zoned={zoned} />}
          </>
        )
      )}
    </output>
  )
}

export function MeterRing(props: {
  label: string
  reading: number
  min: number
  max: number
  color: string | undefined
  target: number | undefined
  ticks: readonly MeterTick[] | undefined
  format: (value: number) => string
  shell: Shell
}) {
  const { label, reading, min, max, color, format, shell } = props
  const describedId = useId()
  const marks = ringMarks(props.target, props.ticks, min, max, format)
  return (
    <div {...rootProps(shell)}>
      <span
        className={classes.ringBox}
        aria-label={label}
        {...ariaValues(reading, min, max, format)}
        {...(marks.length > 0 && { 'aria-describedby': describedId })}
      >
        <RingSvg fraction={ringFraction(reading, min, max)} color={color} marks={marks} />
        <span className={classes.ringValue}>{format(reading)}</span>
      </span>
      {marks.length > 0 && (
        <VisuallyHidden id={describedId} className={classes.summary}>
          {marks.map((m) => m.text).join('; ')}
        </VisuallyHidden>
      )}
    </div>
  )
}

function fillStyle(p: Part): CSSProperties {
  return { width: `${toPct(p.size)}%`, ...(p.color !== undefined && { background: p.color }) }
}

/** Every band after the first gives up its leading pixel, so a boundary never relies on fill strength. */
const ZONE_GAP = '1px'

function zoneStyle(zone: MeterZone, index: number, count: number, min: number, span: number) {
  const band = zoneBand(zone, min, span)
  const gap = index > 0
  return {
    insetInlineStart: gap ? `calc(${band.start}% + ${ZONE_GAP})` : `${band.start}%`,
    width: gap ? `calc(${band.width}% - ${ZONE_GAP})` : `${band.width}%`,
    background: zoneFill(zone, index, count),
  } satisfies CSSProperties
}

/** The row's `column-gap` in px: one gap step of the host's spacing, the least two captions keep apart. */
const columnGapOf = (el: Element): number => Number.parseFloat(getComputedStyle(el).columnGap) || 0

/** One label on the row: its span in percent of the row (a zone name) or none (an end tick). */
type RowSlot = { spanPct?: readonly [number, number]; holding?: boolean; end?: boolean }

type RowLayout = { shown: boolean[]; short: boolean[]; shift: number[] }
const sameLayout = (a: RowLayout, b: RowLayout) =>
  a.shown.length === b.shown.length &&
  a.shown.every(
    (v, i) => v === b.shown[i] && a.short[i] === b.short[i] && a.shift[i] === b.shift[i],
  )

/**
 * Which row labels show, re-measured when the row resizes, when web fonts finish loading (a swap
 * changes label widths without resizing the row) and when the labels change. Server markup shows
 * every label; a name that does not fit its span (or clashes with a tick) hides after measuring.
 * `slots` is index-aligned with the row's first children; the children after them are the short
 * twins, `shortOf[n]` being the label index the n-th twin stands in for.
 */
function useRowLabelLayout(
  rowRef: RefObject<HTMLDivElement | null>,
  slots: readonly RowSlot[],
  shortOf: readonly number[],
  key: string,
): RowLayout {
  const [layout, setLayout] = useState<RowLayout>({ shown: [], short: [], shift: [] })
  const slotsRef = useRef(slots)
  const shortOfRef = useRef(shortOf)
  // Declared before the measuring effect so it reads this render's slots.
  useIsomorphicLayoutEffect(() => {
    slotsRef.current = slots
    shortOfRef.current = shortOf
  })

  // Keyed on a string of the labels, not the `slots` array: the model rebuilds that every render.
  useIsomorphicLayoutEffect(() => {
    const row = rowRef.current
    if (!row) return
    const measure = () => {
      const origin = row.getBoundingClientRect()
      const rtl = getComputedStyle(row).direction === 'rtl'
      const edge = (pct: number) => (origin.width * (rtl ? 100 - pct : pct)) / 100
      const children = [...row.children]
      const labels: RowLabel[] = children.slice(0, slotsRef.current.length).map((c, i) => {
        const r = c.getBoundingClientRect()
        const slot = slotsRef.current[i]
        const pct = slot?.spanPct
        const [a, b] = pct ? [edge(pct[0]), edge(pct[1])] : []
        return {
          box: { left: r.left - origin.left, right: r.right - origin.left },
          ...(a !== undefined &&
            b !== undefined && { span: { left: Math.min(a, b), right: Math.max(a, b) } }),
          ...(slot?.holding && { holding: true }),
          ...(slot?.end && { end: true }),
        }
      })
      shortOfRef.current.forEach((labelIndex, n) => {
        const r = children[slotsRef.current.length + n]?.getBoundingClientRect()
        const label = labels[labelIndex]
        if (r && label) label.short = { left: r.left - origin.left, right: r.right - origin.left }
      })
      const placed = placeRowLabels(labels, origin.width, columnGapOf(row))
      // The hook measures on the physical x axis; the margin is logical, so it flips with `dir`.
      const next = {
        shown: placed.shown,
        short: placed.short,
        shift: placed.shift.map((v) => (rtl ? -v : v)),
      }
      setLayout((prev) => (sameLayout(prev, next) ? prev : next))
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

  return layout
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

/** Ticks past the middle caption to the left of their mark, so a caption near the end stays on the row. */
const TICK_LABEL_FLIP_PCT = 50

/**
 * The one label row: each zone name centred under its own span and the labelled ticks hugging their
 * marks (the end ticks sit at the row's ends), all on one baseline. A name wider than its span, or
 * clashing with a tick or a neighbour, hides (still laid out, so a resize can measure it again) and is
 * still named in the described-by text; the holding zone is ink and heavier. Decorative.
 */
function LabelRow({ zones, ticks }: { zones: readonly ZoneLabel[]; ticks: readonly TickMark[] }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const slots: RowSlot[] = [
    ...ticks.map((t): RowSlot => (t.pct <= 0 || t.pct >= 100 ? { end: true } : {})),
    ...zones.map((z): RowSlot => ({
      spanPct: [z.centrePct - z.widthPct / 2, z.centrePct + z.widthPct / 2],
      holding: z.holding,
    })),
  ]
  const key = [
    ...ticks.map((t) => `${t.label}@${t.pct}`),
    ...zones.map((z) => `${z.label}${z.holding ? '*' : ''}@${z.centrePct}`),
  ].join('\u0000')
  // The holding name never shortens, so its zone has no twin.
  const twins = zones.flatMap((z, i) => (z.short !== undefined && !z.holding ? [i] : []))
  const { shown, short, shift } = useRowLabelLayout(
    rowRef,
    slots,
    twins.map((i) => ticks.length + i),
    `${key}\u0001${twins.map((i) => zones[i]?.short).join('\u0000')}`,
  )
  const hidden = (i: number) => (shown[i] === false || short[i] === true ? '' : undefined)
  const nudge = (i: number): CSSProperties =>
    shift[i] ? { marginInlineStart: `${shift[i]}px` } : {}
  return (
    <div
      ref={rowRef}
      className={classes.labelRow}
      {...(zones.length > 0 ? { 'data-meter-zone-band': '' } : { 'data-meter-tick-band': '' })}
      aria-hidden
    >
      {ticks.map((t, i) => (
        <span
          key={`t${t.key}`}
          className={classes.rowLabel}
          data-meter-tick-label=""
          data-hidden={hidden(i)}
          style={
            t.pct > TICK_LABEL_FLIP_PCT
              ? { insetInlineEnd: `${100 - t.pct}%` }
              : { insetInlineStart: `${t.pct}%` }
          }
        >
          {t.label}
        </span>
      ))}
      {zones.map((z, i) => (
        <span
          key={`z${z.key}`}
          className={cx(classes.rowLabel, classes.zoneLabel, z.holding && classes.zoneLabelHolding)}
          data-meter-zone-label={z.label}
          data-holding={z.holding || undefined}
          data-hidden={hidden(ticks.length + i)}
          style={{ insetInlineStart: `${z.centrePct}%`, ...nudge(ticks.length + i) }}
        >
          {z.label}
        </span>
      ))}
      {twins.map((zi) => {
        const z = zones[zi] as ZoneLabel
        const i = ticks.length + zi
        return (
          <span
            key={`s${z.key}`}
            className={cx(classes.rowLabel, classes.zoneLabel)}
            data-meter-zone-short={z.label}
            data-hidden={short[i] === true ? undefined : ''}
            style={{ insetInlineStart: `${z.centrePct}%`, ...nudge(i) }}
          >
            {z.short}
          </span>
        )
      })}
    </div>
  )
}

/** One caption of the marks row, in flow order: its anchor (`pct`, or the row's `edge`) when it has one. */
type CaptionItem = {
  key: string
  node: ReactNode
  pct?: number
  edge?: 'end'
  end?: boolean
  /** The default target figure: one line, never wrapped. */
  target?: boolean
  align?: 'start' | 'center' | 'end'
  /** Drop rank when the row is too narrow (lowest first); none never drops. */
  drop?: number
}

/** The measurement shared by the marks row and the part list: natural widths, row width, gap step. */
function measureItems(row: HTMLElement) {
  const kids = [...row.children] as HTMLElement[]
  const widths = kids.map((kid) => {
    // In the flow a caption may shrink and wrap inside itself; its anchored width is its one-line one.
    const { whiteSpace, flex, width: inline } = kid.style
    kid.style.whiteSpace = 'nowrap'
    kid.style.flex = 'none'
    // A grid cell would clamp the box to its column; the natural width is what is measured.
    kid.style.width = 'max-content'
    const width = kid.offsetWidth
    kid.style.whiteSpace = whiteSpace
    kid.style.flex = flex
    kid.style.width = inline
    return width
  })
  return { widths, rowWidth: row.clientWidth, gap: columnGapOf(row) }
}

/**
 * Runs `measure` when `key` (what the row says) changes, when the row resizes and when web fonts
 * load (a swap changes widths without resizing the row). Without layout (server markup, happy-dom)
 * nothing is measured and the row keeps its flow.
 */
function useMeasured(
  rowRef: RefObject<HTMLElement | null>,
  measure: (row: HTMLElement) => void,
  key: string,
) {
  const measureRef = useRef(measure)
  // Declared first so the effect below reads this render's closure.
  useIsomorphicLayoutEffect(() => {
    measureRef.current = measure
  })
  useIsomorphicLayoutEffect(() => {
    const row = rowRef.current
    if (!row) return
    const run = () => measureRef.current(row)
    run()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(run)
    observer?.observe(row)
    // A caption's own size changes with its content, whatever it is (a ReactNode has no string key).
    for (const kid of row.children) observer?.observe(kid)
    const fonts =
      typeof document === 'undefined' ? undefined : (document.fonts as FontFaceSet | undefined)
    fonts?.addEventListener?.('loadingdone', run)
    return () => {
      observer?.disconnect()
      fonts?.removeEventListener?.('loadingdone', run)
    }
  }, [rowRef, key])
}

type CaptionPlacement = { starts: (number | undefined)[]; dropped: boolean[] }
const samePlacement = (a: CaptionPlacement | null, b: CaptionPlacement | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.starts.length === b.starts.length &&
    a.starts.every((v, i) => v === b.starts[i] && a.dropped[i] === b.dropped[i]))

/**
 * The captions under the track. A caption that names a mark (the forecast boundary, the target) sits
 * AT that mark, centred and clamped inside the track (the reading ends at its fill end), when every
 * caption fits with a gap step between them. A row that is too narrow drops its droppable captions
 * (`drop` rank, lowest first) before anything wraps; they stay in the described-by text. Only when
 * even the rest do not fit (and in server markup) the row flows and wraps: start, forecast, end.
 */
function CaptionRow({ items }: { items: readonly CaptionItem[] }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [placed, setPlaced] = useState<CaptionPlacement | null>(null)
  useMeasured(
    rowRef,
    (row) => {
      const { widths, rowWidth, gap } = measureItems(row)
      const marks: MarkItem[] = items.map((item, i) => ({
        width: widths[i] ?? 0,
        ...(item.pct !== undefined && { pct: item.pct }),
        ...(item.edge !== undefined && { edge: item.edge }),
        ...(item.align !== undefined && { align: item.align }),
        ...(item.drop !== undefined && { drop: item.drop }),
      }))
      const next = placeCaptionRow(marks, rowWidth, gap)
      setPlaced((prev) => (samePlacement(prev, next) ? prev : next))
    },
    items
      .map(
        (i) =>
          `${i.key}@${i.pct ?? i.edge ?? ''}${i.align ?? ''}${i.drop ?? ''}:${typeof i.node === 'string' ? i.node : ''}`,
      )
      .join('\u0000'),
  )
  return (
    <div
      ref={rowRef}
      className={cx(classes.captions, placed !== null && classes.captionsAnchored)}
      data-meter-captions
      data-anchored={placed === null ? undefined : ''}
    >
      {items.map((item, i) => (
        <span
          key={item.key}
          className={
            item.target ? classes.captionTarget : item.end ? classes.captionEnd : classes.caption
          }
          data-hidden={placed?.dropped[i] ? '' : undefined}
          {...(placed?.starts[i] !== undefined && {
            style: { insetInlineStart: `${placed.starts[i]}px` },
          })}
        >
          {item.node}
        </span>
      ))}
    </div>
  )
}

/**
 * Categorical part captions (swatch, name, value): each under its own segment when every one fits
 * there on one line, else a grid from the track's start: one row when every entry fits it, else
 * the most columns that fit with no lone entry on the last row. An entry stays on one line unless
 * it is wider than the row itself.
 */
function PartCaptions({ captions }: { captions: readonly PartCaption[] }) {
  const rowRef = useRef<HTMLUListElement>(null)
  const [under, setUnder] = useState(false)
  const [overwide, setOverwide] = useState(false)
  const [cols, setCols] = useState(0)
  useMeasured(
    rowRef,
    (row) => {
      const { widths, rowWidth, gap } = measureItems(row)
      setOverwide(widths.some((w) => w > rowWidth))
      const fits = partsFitUnder(
        captions.map((c, i) => ({ startPct: c.startPct, width: widths[i] ?? 0 })),
        rowWidth,
        gap,
      )
      setUnder(fits)
      setCols(fits ? 0 : partColumns(widths, rowWidth, gap))
    },
    captions.map((c) => `${c.label} ${c.text}@${c.startPct}`).join('\u0000'),
  )
  return (
    <ul
      ref={rowRef}
      className={cx(
        classes.partCaptions,
        under && classes.partCaptionsUnder,
        overwide && classes.partCaptionsWrap,
        cols > 0 && classes.partCaptionsGrid,
      )}
      style={
        cols > 0 ? { gridTemplateColumns: `repeat(${cols}, minmax(0, max-content))` } : undefined
      }
      // The explicit role is deliberate: `list-style: none` makes Safari/VoiceOver drop the implicit one.
      // oxlint-disable-next-line jsx-a11y/no-redundant-roles
      role="list"
      data-meter-parts
      data-anchored={under ? '' : undefined}
    >
      {captions.map((c) => (
        <li
          key={c.key}
          className={classes.partCaption}
          {...(under && { style: { insetInlineStart: `${c.startPct}%` } })}
        >
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
  stops: readonly { at: number; color: string }[] | undefined
  track: boolean | undefined
  markerReading: boolean | undefined
  target: number | undefined
  ticks: readonly MeterTick[] | undefined
  tone: 'muted' | undefined
  forecastCaption: string | undefined
  startCaption: ReactNode
  endCaption: ReactNode
  readingAt: 'fill' | 'start' | undefined
  shell: Shell
}) {
  const { label, min, max, format, zones, shell } = props
  const describedId = useId()
  const model = modelBar(props)
  const compact = shell.row
  const hosted = useContext(VisualSlotContext) !== null
  // A host that already shows the value as its hero (StatCard, a strip cell) owns the reading: a
  // marked track keeps its marker and labels but does not print the number a second time, and a
  // stops track prints it only on request. `reading` overrides either way. A consumer's own
  // `startCaption` is not the reading and still renders.
  const marked = model.markerPct !== undefined
  const readingOn = props.markerReading ?? (model.zoneLabels.length > 0 && !hosted)
  const start =
    compact || (marked && !readingOn && props.startCaption === undefined)
      ? null
      : startCaptionText(model, props.startCaption)
  const anchored = marked && start !== null
  const trackHidden =
    props.track === false &&
    model.parts.length === 1 &&
    props.segments === undefined &&
    props.target === undefined &&
    model.ticks.length === 0
  const hasParts = model.partCaptions.length > 0
  // A scale's start figure: a Meter with marks or a target labels where its track begins, with its
  // `format`, unless the consumer opted out (`startCaption={null}`) or already labelled that end.
  const zoned = zones !== undefined && zones.length > 0
  const labelled = model.ticks.filter((t) => t.label !== undefined)
  const startFigure =
    !compact &&
    !zoned &&
    props.startCaption !== null &&
    (model.ticks.length > 0 || model.targetPct !== undefined) &&
    !labelled.some((t) => t.pct <= 0)
  const tickLabels: TickMark[] = compact
    ? []
    : [
        ...(startFigure
          ? [
              {
                key: 'start',
                pct: 0,
                label: format(min),
                caption: undefined,
                text: '',
              } satisfies TickMark,
            ]
          : []),
        ...labelled,
      ]
  const zoneLabels = compact ? [] : model.zoneLabels
  // On a zoned track the zone names own the row below; the figures at its two ends sit above the
  // track, where nothing else competes for them. Every other tick label stays with the names.
  const isEnd = (t: TickMark) => t.pct <= 0 || t.pct >= 100
  const aboveTicks = zoneLabels.length > 0 ? tickLabels.filter(isEnd) : tickLabels
  const belowTicks = zoneLabels.length > 0 ? tickLabels.filter((t) => !isEnd(t)) : []
  const describedBy =
    model.describedByText === null ? {} : ({ 'aria-describedby': describedId } as const)

  // The caption row, in flow order. The target's caption sits at its tick unless the consumer
  // supplied an end caption (theirs goes at the end, as written).
  const endOverride = props.endCaption !== undefined
  const targetHere = !endOverride && model.targetPct !== undefined && model.endText !== null
  const end = compact ? null : endOverride ? props.endCaption : model.endText
  const items: CaptionItem[] = compact
    ? []
    : [
        ...(start !== null && !anchored
          ? [
              {
                key: 'start',
                node: glue(start),
                // The reading sits at its fill's end (clamped inside the track); `readingAt="start"` keeps the old start edge.
                ...(props.readingAt !== 'start' &&
                  model.fillEndPct !== undefined && {
                    pct: model.fillEndPct,
                    align: 'end' as const,
                  }),
              } satisfies CaptionItem,
            ]
          : []),
        ...(model.forecastText !== null
          ? [
              {
                key: 'forecast',
                node: glue(model.forecastText),
                drop: 2,
                // The reading ends at the boundary, the forecast begins there.
                ...(props.readingAt !== 'start' && start !== null && { align: 'start' as const }),
                ...(model.boundaryPct !== undefined && { pct: model.boundaryPct }),
              } satisfies CaptionItem,
            ]
          : []),
        ...(compact
          ? []
          : model.ticks.flatMap((t) =>
              t.caption === undefined
                ? []
                : [
                    {
                      key: `tick${t.key}`,
                      node: glue(t.caption),
                      pct: t.pct,
                      drop: 1,
                    } satisfies CaptionItem,
                  ],
            )),
        ...(end !== null
          ? [
              {
                key: 'end',
                node: glue(end),
                end: true,
                ...(targetHere && { target: true }),
                ...(targetHere && model.targetPct !== undefined
                  ? { pct: model.targetPct }
                  : { edge: 'end' as const }),
              } satisfies CaptionItem,
            ]
          : []),
      ]

  const root = rootProps(shell)
  return (
    <div {...root} className={root.className}>
      {aboveTicks.length > 0 && <LabelRow zones={[]} ticks={aboveTicks} />}
      <div
        className={cx(classes.trackBox, trackHidden && classes.trackHidden)}
        data-meter-track-hidden={trackHidden ? '' : undefined}
        aria-label={label}
        {...ariaValues(props.reading, min, max, format)}
        {...describedBy}
      >
        <div
          className={classes.track}
          data-meter-track
          {...(model.stopsCss !== undefined && {
            'data-meter-stops': '',
            // theme-allow hidden-inline-style — the gradient is the consumer's colour data
            style: { '--basalt-stops': model.stopsCss } as CSSProperties,
          })}
        >
          {zones?.map(
            (z, i) =>
              model.markerPct !== undefined && (
                <div
                  key={i}
                  className={classes.zone}
                  data-meter-zone={z.label}
                  {...(i > 0 &&
                    zones[i - 1]?.tone === 'muted' &&
                    z.tone === 'muted' && { 'data-meter-zone-seam': '' })}
                  style={zoneStyle(z, i, zones.length, min, model.span)}
                />
              ),
          )}
          {model.parts.map((p, i) => (
            <div
              key={i}
              className={cx(classes.fill, p.forecast && classes.forecastFill)}
              data-meter-fill={p.forecast ? 'forecast' : 'committed'}
              {...(p.seam && { 'data-meter-seam': '' })}
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
      {zoneLabels.length > 0 && <LabelRow zones={zoneLabels} ticks={belowTicks} />}
      {anchored && <ZoneReading pct={model.markerPct ?? 0}>{start}</ZoneReading>}
      {model.describedByText !== null && (
        <VisuallyHidden id={describedId} className={classes.summary}>
          {model.describedByText}
        </VisuallyHidden>
      )}
      {hasParts && <PartCaptions captions={model.partCaptions} />}
      {items.length > 0 && <CaptionRow items={items} />}
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
