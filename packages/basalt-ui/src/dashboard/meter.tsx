/**
 * Meter — one bounded quantity on a track: progress to a target, a committed/forecast split, a
 * part-of-a-whole strip (`segments`), or a single headline ratio as a `ring`. Choose it for "how far
 * along is this against a limit"; choose `BarList` for a ranking and a chart for a trend. An HTML/CSS
 * primitive, not a chart kind (no scale, axis or tooltip).
 *
 * Colour law: a plain `value` bar's fill is neutral (`--vx-muted` at a strength that holds 3:1 on
 * the track; `tone="ink"` for full ink); `segments` and `zones` keep their own fills. `color` is
 * for a VERDICT only (over budget, below target) and is a status colour the consumer passes;
 * categorical `segments` take the consumer's series colours. Committed vs forecast is the same neutral at two strengths — never colour alone: a
 * tick marks the boundary and a caption names the forecast. A value past `max` clamps the fill at the
 * track end; the caption still states the real value.
 *
 * `zones` (bar only) draws the track as contiguous bands (neutral at stepped strengths unless a zone
 * passes a status colour) and the reading becomes a MARKER on the track, not a fill. Each zone is
 * named under the band at its start, the one holding the value (`from` inclusive) in ink and a
 * heavier weight; names that would collide wrap as a list instead. The fit is measured in the
 * browser, so server markup shows the band and the list may appear after mount. Use it for a
 * reading judged against ranges.
 *
 * Every state (bar, ring, empty, loading) carries `data-basalt-meter` on its root. That attribute is
 * the contract with `StatCard`: a Meter passed as its `sparkline` visual makes the slot size to content
 * and keep the card's inline inset (both placements) instead of the sparkline's fixed height and bleed.
 *
 * Categorical `segments` (no `forecast` part) are captioned one per part — swatch, name, value — under
 * the track and the default start caption is dropped (an explicit `startCaption` still shows);
 * committed/forecast keeps the reading plus the forecast caption.
 *
 * @example
 * import { Meter } from 'basalt-ui'
 *
 * // Spend against a budget: past the target the end caption states the overage.
 * <Meter label="Monthly spend" value={512} max={600} target={450} color="var(--vx-status-bad)" format={usd} />
 * // Training load as a zone band with a marker: the zones are named under the band, "Optimal" in ink.
 * <Meter
 *   label="Training load"
 *   max={1000}
 *   value={612}
 *   zones={[
 *     { from: 0, to: 300, label: 'Low' },
 *     { from: 300, to: 750, label: 'Optimal' },
 *     { from: 750, to: 1000, label: 'High' },
 *   ]}
 * />
 * // A readiness score on its 0–100 scale (its contributors: <BarList max={100} … secondary="Good" />).
 * <Meter label="Recovery" value={72} max={100} />
 * <Meter
 *   label="Course progress"
 *   max={120}
 *   segments={[{ value: 70, label: 'Done' }, { value: 25, label: 'Planned', forecast: true }]}
 * />
 * <Meter shape="ring" label="Cache hit rate" value={87} max={100} format={(v) => `${v}%`} />
 */
import { useContext } from 'react'
import type { ReactNode } from 'react'
import type { BasaltProps } from '../common/props'
import { VX } from '../tokens'
import { isReading, normalizeSegments, segmentReading, spanOf } from './meter-model'
import type { MeterSegment, MeterTick, MeterZone } from './meter-model'
import { MeterBar, MeterEmpty, MeterLoading, MeterRing } from './meter-parts'
import { asText } from './scale'
import { VisualSlotContext } from './visual-slot'

type Common = BasaltProps & {
  /** Accessible name (`aria-label`). Required: a meter without one is announced as a bare number. */
  label: string
  /** Track start. Default 0. */
  min?: number
  /** Track end. Default 100. */
  max?: number
  /** Formats values in captions and the accessible text. Default: the number as written. */
  format?: (value: number) => string
  /** Renders a skeleton with the meter's footprint. */
  loading?: boolean
  /** Muted line shown when there is no reading; none by default (the reading is `—`). The track stays so the footprint holds. */
  emptyText?: string
}

type BarCommon = Common & {
  shape?: 'bar'
  /** Target position; draws a tick and states it in the end caption (with the overage past it). */
  target?: number
  /**
   * More marks on the track (cut-offs, a window mean). Each is drawn at `at`; a `label` is captioned
   * above the track, or on a zoned Meter in the zone-name row (the end ticks at the row's ends); a
   * `caption` sits under the track, centred on the mark and clamped inside it. A label that would
   * collide with another hides. A tick outside `[min, max]` is dropped, not clamped. All are listed
   * in the accessible description. Works with `value`, `zones`, `segments` and `target`.
   *
   * Given `ticks` (or a `target`), a plain or segmented bar also labels where its track starts: the
   * start figure `format(min)`, above the track. `startCaption={null}` drops it.
   */
  ticks?: readonly MeterTick[]
  /**
   * `'muted'` (default for a plain `value` bar; `segments` and `zones` keep their fills): a
   * non-verdict fill (a load, not a verdict) in `--vx-muted` at a strength that holds 3:1 against
   * the track in both schemes — the ink fill is near-white in dark. `'ink'` restores the full-ink
   * `--vx-line` fill. A `color` wins over both.
   */
  tone?: 'muted' | 'ink'
  /**
   * `'row'`: in-line use — a track one text line tall and no caption rows (reading, target, forecast,
   * zone and tick captions). Categorical `segments` keep their per-part captions (swatch, name, value)
   * so the parts stay named. The label stays as `aria-label`; the described-by text keeps the rest.
   * Put the value beside it in your own layout.
   */
  size?: 'row'
  /**
   * Start caption (default: the formatted reading). `null` drops it, and the start figure that
   * `ticks`/`target` add above the track; zone labels stay.
   */
  startCaption?: ReactNode
  /**
   * End caption (default: `Target <target>` with the Meter's `format`, drawn at the target's tick
   * rather than the track end when it fits). `null` drops it; zone labels stay.
   */
  endCaption?: ReactNode
  /**
   * The reading printed at the marker of a zoned bar. Default `true`, and `false` inside a basalt host
   * (`StatCard`, a strip cell's `visual`) that already states the value. Pass `false` when YOUR
   * headline states it: the marker stays and keeps its `aria-valuenow` / `aria-valuetext`. Pass `true`
   * to print it inside a host. A `stops` track prints it only when `true`.
   */
  reading?: boolean
}

/**
 * One of four forms; mixing them is a compile error.
 * - Bar `value` (+ `target`, `color`): one reading on a neutral track.
 * - Bar `segments`: ordered parts that sum to the reading (committed/forecast, part of a whole).
 * - Bar `value` + `zones`: the reading is a marker against contiguous bands.
 * - Bar `value` + `stops`: the reading is a marker on one gradient track.
 * - Ring (`shape: 'ring'`) `value` (+ `color`, `target`, `ticks`): one headline ratio; no captions,
 *   segments or zones.
 */
export type MeterProps =
  | (BarCommon & {
      /** The reading. `null`/`undefined` (or non-finite) renders the empty state. */
      value?: number | null | undefined
      /** A status colour, for a verdict only. Omit for the neutral fill. */
      color?: string
      /**
       * `false` draws no track for a value with nothing to compare against (no `target`, no `ticks`):
       * the track stays in the accessibility tree and the captions remain. A `target` or `ticks` keep it.
       */
      track?: boolean
      /**
       * Draws the track as ONE gradient through these colours (the consumer's: tokens or its own
       * values, `at` in the reading's units) and the reading as a marker on it. Not a zone: no names,
       * and no labels unless `ticks` are given. Use it for a scale whose hue IS the quantity.
       */
      stops?: readonly { at: number; color: string }[]
      segments?: never
      zones?: never
    })
  | (BarCommon & {
      /** Ordered parts, accumulated from `min`; their sum is the reading. `forecast` parts render lighter. */
      segments: readonly MeterSegment[]
      /** Names the forecast beside the boundary tick (default: `Forecast: <labels>`). */
      forecastCaption?: string
      value?: never
      color?: never
      zones?: never
      stops?: never
      track?: never
    })
  | (BarCommon & {
      value?: number | null | undefined
      /**
       * Contiguous bands drawn as the track, positioned from each `from`. The reading becomes a marker
       * and each band is named under the track, the one that holds it in ink.
       */
      zones: readonly MeterZone[]
      segments?: never
      color?: never
      stops?: never
      track?: never
    })
  | (Common & {
      shape: 'ring'
      value?: number | null | undefined
      /** A status colour, for a verdict only. */
      color?: string
      /** A short radial mark at this value (a limit to compare the arc against); the value stays centred. */
      target?: number
      /** More radial marks, each at its `at`; a `label` is for the accessible text only. */
      ticks?: readonly MeterTick[]
      segments?: never
      zones?: never
      tone?: never
      size?: never
      startCaption?: never
      endCaption?: never
      reading?: never
      stops?: never
      track?: never
    })

let warnedTrack = false
/** One dev warning per page load for a track that ends at or before its start. */
function warnInvalidTrack(min: number, max: number) {
  if (warnedTrack || spanOf(min, max).valid || process.env.NODE_ENV === 'production') return
  warnedTrack = true
  console.warn(
    `[basalt] Meter: max (${max}) must be greater than min (${min}); drawing an empty track`,
  )
}

/** Muted is the default for a plain `value` bar only; `segments`/`zones` keep their fills unless asked. */
function barTone(tone: 'muted' | 'ink' | undefined, plain: boolean): 'muted' | undefined {
  if (tone === 'ink') return undefined
  return tone === 'muted' || plain ? 'muted' : undefined
}

export function Meter(props: MeterProps) {
  const { label, min = 0, max = 100, format = asText, className, style } = props
  const row = props.size === 'row'
  const shell = { className, style, row }
  const ring = props.shape === 'ring'
  warnInvalidTrack(min, max)
  const hostTone = useContext(VisualSlotContext)?.tone
  const hostColor = hostTone === undefined ? undefined : VX.status[hostTone]

  if (props.loading === true) return <MeterLoading label={label} ring={ring} shell={shell} />

  const segments = props.segments === undefined ? undefined : normalizeSegments(props.segments)
  const reading = segments === undefined ? props.value : segmentReading(segments, min)
  if (!isReading(reading) || segments?.length === 0) {
    return <MeterEmpty label={label} text={props.emptyText} ring={ring} shell={shell} />
  }

  if (props.shape === 'ring') {
    return (
      <MeterRing
        {...{ label, reading, min, max, format, shell }}
        color={props.color ?? hostColor}
        target={isReading(props.target) ? props.target : undefined}
        ticks={props.ticks}
      />
    )
  }
  const plain =
    props.segments === undefined && props.zones === undefined && props.stops === undefined
  return (
    <MeterBar
      {...{ label, reading, min, max, format, shell }}
      color={props.color ?? (props.tone === undefined && plain ? hostColor : undefined)}
      segments={segments}
      zones={props.zones}
      stops={props.stops}
      track={props.track}
      markerReading={props.reading}
      target={isReading(props.target) ? props.target : undefined}
      ticks={props.ticks}
      tone={barTone(props.tone, plain)}
      forecastCaption={props.segments === undefined ? undefined : props.forecastCaption}
      startCaption={props.startCaption}
      endCaption={props.endCaption}
    />
  )
}
