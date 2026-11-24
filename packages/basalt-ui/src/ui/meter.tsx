import { Meter as BaseMeter } from '@base-ui/react/meter'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { useId } from 'react'
import type { ComponentProps, CSSProperties, ReactElement } from 'react'
import { cn } from '../core/cn'
import { NON_FINITE, useFormat } from '../core/format'
import type { MeterSpec, MeterZone, Tone } from '../core/ports'

/**
 * The `Meter` cva table: a bar and a readout line under it. Without `zones`, `tone` colors the
 * fill (default `neutral`); with zones each zone brings its own tone and `tone` is not read.
 *
 * @example
 * meterVariants({ tone: 'good' }) // class string for a non-`Meter` element
 */
export const meterVariants = cva('flex w-full flex-col gap-1', {
  variants: {
    tone: {
      neutral: '**:data-fill:bg-muted-foreground',
      accent: '**:data-fill:bg-brand-fill',
      good: '**:data-fill:bg-good',
      warn: '**:data-fill:bg-warn',
      bad: '**:data-fill:bg-bad',
      info: '**:data-fill:bg-info',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const meterParts = ['meter'] as const

/** One class string per tone, written out so the scanner sees each. */
const ZONE_FILL: Record<Tone, string> = {
  neutral: 'fill-muted-foreground/25',
  accent: 'fill-brand-fill/25',
  good: 'fill-good/30',
  warn: 'fill-warn/30',
  bad: 'fill-bad/30',
  info: 'fill-info/30',
}

const ZONE_WORD: Record<Tone, string> = {
  neutral: 'text-muted-foreground',
  accent: 'text-brand',
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
  info: 'text-info',
}

export type MeterProps = Omit<
  ComponentProps<'div'>,
  'className' | 'children' | 'role' | 'defaultValue' | 'color'
> &
  MeterSpec &
  VariantProps<typeof meterVariants> & {
    /** Layout only (`max-w-xs`, `mt-2`). Height belongs to the table. */
    className?: string
    /**
     * One or two values marked across the track, each with its `format`ted number under it: a
     * range's two ends or one limit.
     */
    ticks?: readonly [number] | readonly [number, number]
    /** Why the meter reads as it does, one muted line under the readout ("70 % under 0.40"). */
    cause?: string
  }

type Segment = { zone: MeterZone; start: number; end: number }

/** The zones as `[start, end]` fractions of the scale; the last one runs to `max`. */
function segmentsOf(zones: readonly MeterZone[], min: number, max: number): Segment[] {
  const span = max - min
  return zones.map((zone, index) => {
    const from = index === 0 ? min : (zones[index - 1]?.to ?? min)
    const to = index === zones.length - 1 ? max : Math.min(zone.to, max)
    return {
      zone,
      start: Math.min(1, Math.max(0, (from - min) / span)),
      end: Math.min(1, Math.max(0, (to - min) / span)),
    }
  })
}

/** The zone a value falls in: the first whose `to` reaches it, else the last. */
const zoneOf = (zones: readonly MeterZone[], value: number): MeterZone =>
  zones.find((zone) => value <= zone.to) ?? zones[zones.length - 1]!

/** A tick label near an end aligns to that end, so it never leaves the track's width. */
const edgeOf = (fraction: number): 'start' | 'middle' | 'end' =>
  fraction < 0.1 ? 'start' : fraction > 0.9 ? 'end' : 'middle'

const TICK_ALIGN = {
  start: 'translate-x-0',
  middle: '-translate-x-1/2',
  end: '-translate-x-full',
} as const

const pct = (fraction: number): string => `${fraction * 100}%`

/**
 * A gauge for a value on a scale. With `zones` the track is tinted by zone, a marker sits at the
 * value and the active zone's word is printed under it, so a verdict is never color alone; every
 * zone must carry a `label`. Without zones it is a neutral bar. `label` names the meter for
 * assistive tech, `format` prints the value (default the page locale's number) and `caption` the
 * words after it that name it on screen ("US$13.89 spent", "of 150 listed"). `ticks` mark a range's
 * ends or a limit on the track, `cause` says why in a line under the readout. The track is 8 px and
 * the readout line 16 px under a 4 px gap, so a meter is 28 px (a tick row adds 20, a `cause` its
 * lines); a `StatCard` `height` below that clips the readout, so a meter in its chart slot sets
 * `height={28}` at least. A list of meters
 * joins one `useChartFocus` through the seam: the list spreads `focus.target`, each meter
 * `focus.item(i)`, and the page renders `focus.live` once.
 *
 * @useWhen a value sits on a scale with named zones (a training load, a quota) and the zone is the message
 * @neverWhen the value is progress toward a goal (use Progress) or a trend (use Sparkline)
 * @example
 * <Meter
 *   label="Training load"
 *   value={1.35}
 *   max={2}
 *   zones={[
 *     { to: 0.8, tone: 'info', label: 'Detraining' },
 *     { to: 1.3, tone: 'good', label: 'Optimal' },
 *     { to: 2, tone: 'bad', label: 'Overreaching' },
 *   ]}
 * />
 */
export function Meter({
  label,
  value,
  min = 0,
  max,
  zones,
  format: formatValue,
  caption,
  ticks,
  cause,
  tone,
  className,
  ...props
}: MeterProps): ReactElement {
  const intl = useFormat()
  const causeId = useId()
  const present = typeof value === 'number' && Number.isFinite(value)
  const print = (v: number): string => (formatValue ?? intl.number)(v)
  const text = present ? print(value) : NON_FINITE
  const said = caption === undefined ? text : `${text} ${caption}`
  const span = max - min
  const at = (v: number): number => (span > 0 ? Math.min(1, Math.max(0, (v - min) / span)) : 0)
  const fraction = present && span > 0 ? Math.min(1, Math.max(0, (value - min) / span)) : 0
  const active = present && zones !== undefined ? zoneOf(zones, value) : undefined
  const marker = Math.min(0.99, Math.max(0.01, fraction))
  return (
    <BaseMeter.Root
      {...props}
      aria-label={label}
      value={present ? value : min}
      min={min}
      max={max}
      aria-describedby={cause === undefined ? undefined : causeId}
      getAriaValueText={() => (active ? `${said}, ${active.label}` : said)}
      data-slot="meter"
      className={cn(meterVariants({ tone }), className)}
    >
      <div className="relative">
        <BaseMeter.Track className="relative block h-2 w-full overflow-hidden rounded-full bg-selected">
          {zones === undefined ? (
            present && <BaseMeter.Indicator data-fill="" className="block h-full rounded-full" />
          ) : (
            <svg
              className="absolute inset-0 size-full"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {segmentsOf(zones, min, max).map(({ zone, start, end }) => (
                <rect
                  key={zone.label}
                  x={pct(start)}
                  width={pct(end - start)}
                  height="100%"
                  className={ZONE_FILL[zone.tone]}
                />
              ))}
              {present && (
                <line
                  x1={pct(marker)}
                  x2={pct(marker)}
                  y1="0"
                  y2="100%"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                  className="stroke-foreground"
                />
              )}
            </svg>
          )}
        </BaseMeter.Track>
        {ticks?.map((tick) => (
          <span
            key={tick}
            data-meter-tick=""
            aria-hidden="true"
            style={{ '--tick': pct(at(tick)) } as CSSProperties}
            className="absolute -inset-y-0.5 left-(--tick) w-px -translate-x-1/2 bg-foreground"
          />
        ))}
      </div>
      {ticks !== undefined && (
        <div
          aria-hidden="true"
          className="relative h-lh text-xs text-muted-foreground tabular-nums"
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              data-meter-tick-label=""
              style={{ '--tick': pct(at(tick)) } as CSSProperties}
              className={cn(
                'absolute left-(--tick) whitespace-nowrap',
                TICK_ALIGN[edgeOf(at(tick))],
              )}
            >
              {print(tick)}
            </span>
          ))}
        </div>
      )}
      <div data-readout="" className="flex items-baseline justify-between gap-2 text-xs">
        {active ? (
          <span className={cn('font-medium', ZONE_WORD[active.tone])}>{active.label}</span>
        ) : (
          <span />
        )}
        <span className="min-w-0 text-end text-muted-foreground">
          <span className="tabular-nums">{text}</span>
          {caption !== undefined && <span data-meter-caption=""> {caption}</span>}
        </span>
      </div>
      {cause !== undefined && (
        <p id={causeId} data-meter-cause="" className="m-0 text-xs text-muted-foreground">
          {cause}
        </p>
      )}
    </BaseMeter.Root>
  )
}
