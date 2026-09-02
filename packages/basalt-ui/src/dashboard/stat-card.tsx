/**
 * StatCard — the KPI atom (docs/DESIGN-SPEC.md §5, docs/CONTROLS-SPEC.md §2.2): a panel +
 * shadow-card + card-radius card (spacing xs/sm inset, no min-height — the content states the
 * height, ~88-96px for the title/hero/trend shape). The header composes
 * `WidgetHeader tier="widget"` — title/icon/value/delta/deltaPeriod all render through it, on the
 * shared hero-metric row under the title. `actions` (e.g. a ghost "..." menu trigger) is wrapped in
 * `CtlSlot tier="widget"` — the 24px ActionIcon step the 28px widget header row can hold, not the
 * 30px `ctl` tier, which used to grow the row and knock a card with a kebab 2px out of line with the
 * card beside it. `StatCard` is Mantine-coupled (`src/dashboard/`), unlike `ChartCard`, so it can
 * mount the slot at all; `ChartCard` writes the same `data-basalt-tier="widget"` marker by hand.
 *
 * `sparklinePlacement` decides where the trend visual sits: `'bleed'` (default) keeps the historic
 * full-width row beneath the hero value, bled past the card's own inset padding; `'right'` sits it
 * beside the hero row, the reference-design look. Below `sm`, `'right'` collapses back to the
 * `'bleed'` layout — CSS only, no JS branch (`stat-card.module.css`).
 *
 * `info` and `subtitle` are forwarded to that same `WidgetHeader`, and a hero KPI usually wants
 * both: `value` is typed `string`, so the unit and the basis have nowhere else to go — `subtitle`
 * carries them as a muted line, and `info` puts "how this number is computed" behind the glyph
 * beside the title instead of inside the heading's accessible name.
 *
 * `src/dashboard` stays @visx-free — `sparkline` is a plain `ReactNode` slot, never a chart import
 * here. Pass a `LineSparkline`/`BarSparkline` from `basalt-ui/charts` at the call site.
 *
 * `query` hands the card's pending/error/empty branch to `QueryState` at the `'section'` tier,
 * rendered under the header rather than over it — the title row is chrome and must not flicker.
 *
 * `tone` marks the card as past a threshold with an accent rail down its leading edge. It exists
 * because `value` is typed `string`: without it, a card whose number has crossed a threshold reads
 * exactly as calm as one that hasn't, and the only way out from the consumer side is to wrap the
 * card in a hand-rolled positioned `<Box>` — which is a second card idiom in the app, drawn by code
 * the guard has no way to recognize as one. The rail is the largest signal available without
 * touching the value's own type: full card height, overlaying the card's edge rather than adding to
 * it, so layout is unchanged. `undefined` renders nothing at all — absence of a reading is neither a
 * good one nor a bad one, and must never be tinted. `'good'` is a deliberate positive verdict, never
 * the meaning of omission: it exists for the threshold where the calm number IS the finding (zero
 * downtime over the window), and a card that has measured nothing must not be able to reach green by
 * leaving the prop off.
 *
 * @example
 * import { StatCard } from 'basalt-ui'
 * import { LineSparkline } from 'basalt-ui/charts'
 *
 * // `sparkline` is a RENDER PROP over the slot's measured box, so full-bleed is genuinely the
 * // card's width — no `useChartSize` wrapper component, no hardcoded pixel value.
 * <StatCard
 *   title="Active Users"
 *   value="12,483"
 *   delta={4.2}
 *   sparkline={({ width, height }) => <LineSparkline data={history} width={width} height={height} />}
 * />
 *
 * @example
 * // The reference-design look — sparkline beside the hero value row instead of bled below it. The
 * // slot is a fixed 72×26 there, so the render prop still receives the box it should draw into.
 * <StatCard
 *   title="Active Users"
 *   value="12,483"
 *   delta={4.2}
 *   sparklinePlacement="right"
 *   sparkline={({ width, height }) => (
 *     <BarSparkline data={history} width={width} height={height} ariaLabel="Active users trend" />
 *   )}
 * />
 *
 * @example
 * // A hero card: the unit on its own muted line, the method behind the info glyph.
 * <StatCard
 *   title="Training load"
 *   value="412"
 *   subtitle="TSS · 7-day rolling"
 *   info="Sum of per-session TSS over the last 7 days, Garmin-reported."
 * />
 *
 * @example
 * // Past a threshold — an accent rail down the leading edge, value untouched.
 * <StatCard title="Downtime" value="29 min" tone="bad" />
 *
 * @example
 * // The earned zero — a measured value worth asserting, not a card that merely has no reading.
 * <StatCard title="Downtime · last 24h" value="0 min" tone="good" />
 *
 * @example
 * // The honest gate. A zero can be synthesized as well as measured — a downtime figure derived
 * // from outage rows reads 0 both when probes ran clean AND when no probe cycle was ingested at
 * // all, because a dead collector opens no outage row either. `tone` is a positive assertion
 * // about a reading, so the gate belongs on whether a reading exists, not on whether the number
 * // happens to be defined — those are separate facts. Gate on measured coverage instead:
 * <StatCard
 *   title="Downtime · last 24h"
 *   value={`${downtimeMinutes} min`}
 *   tone={hasCoverage ? (downtimeMinutes === 0 ? 'good' : 'bad') : undefined}
 * />
 */
import { Box, Card, VisuallyHidden } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { WidgetHeader } from '../widget-header'
import type {
  WidgetHeaderDeltaProps,
  WidgetHeaderMetricProps,
  WidgetHeaderTitleProps,
} from '../widget-header'
import { CtlSlot } from '../theme'
import { VX } from '../tokens'
import { cx } from '../common/props'
import type { BasaltProps, SlotStylesProps, Tone } from '../common/props'
import { QueryState } from './query-state'
import type { QueryStateLike } from './query-state'
import classes from './stat-card.module.css'

/**
 * A threshold verdict on the card's value. `undefined` is never tinted — see the module docblock.
 * Alias of the common `Tone` vocabulary (audit A13) — byte-identical, kept as its own name so a
 * consumer's existing `StatCardTone` reference never breaks.
 */
export type StatCardTone = Tone

/**
 * The four boxes `StatCard` paints, and the whole styling seam it offers (`common/props.ts`).
 * `value` is not its own slot: the hero number is painted by `WidgetHeader`'s internal metrics row,
 * which does not yet accept a slot class of its own.
 */
export type StatCardSlot = 'root' | 'header' | 'body' | 'sparkline'

/**
 * One row of a {@link StatCardProps.breakdown} — the two or three parts a hero number is made of.
 *
 * `value` is a pre-formatted `string` for the same reason the hero's is: the card cannot know the
 * locale, the currency or the precision the number was measured at. `tone` marks ONE row as past a
 * threshold and is the same vocabulary as the card's own `tone`, so a row saying `bad` and a rail
 * saying `bad` are the same claim at two scales; omitting it is untinted, never `'good'`.
 */
export type StatCardBreakdownRow = {
  readonly label: string
  readonly value: string
  readonly tone?: StatCardTone
}

/**
 * The `'right'` placement's slot width, in px — a flex BASIS, not a fixed size. 72 is the reference
 * KPI card's trend width and the slot asks for exactly that; when the hero row needs the space (a
 * long formatted value plus a delta badge in a 4-up grid) the slot is the side that yields, because
 * the number is the card's content and the trend qualifies it. The render prop is handed the
 * MEASURED width either way, so the bars are drawn at the width they actually got — the previous
 * fixed 72 painted over the value instead.
 */
const SPARKLINE_RIGHT_WIDTH = 72
/** The `'right'` placement's slot height — sized to the hero row it sits beside, not to the card. */
const SPARKLINE_RIGHT_HEIGHT = 26

/**
 * The measured box a `sparkline` render prop receives.
 *
 * A `LineSparkline`/`BarSparkline` takes `width`/`height` as NUMBERS (they are SVG attributes — an
 * svg cannot size itself from CSS and then scale its scales), so "full bleed" was never expressible
 * as a `ReactNode`: the caller had to guess a pixel width, or write its own `useChartSize` wrapper
 * component. Four consumers wrote that wrapper; two of them hardcoded a width and drew a sparkline
 * that stopped short of the card edge on every viewport but the one they built on.
 */
export type StatCardSparklineSize = {
  width: number
  height: number
}

/**
 * Measures a slot and re-measures on resize. Plain `ResizeObserver`, not `useChartSize`:
 * `src/dashboard/**` is Mantine-coupled and @visx-FREE (see the module doc), and `useChartSize`
 * wraps `@visx/responsive`.
 *
 * The `undefined` guard is for the test DOM — happy-dom ships no `ResizeObserver`, and the one-shot
 * measure above it is what keeps a mounted card rendering its sparkline there.
 */
function useSlotWidth(active: boolean): {
  ref: (node: HTMLDivElement | null) => void
  width: number
} {
  const [width, setWidth] = useState(0)
  const nodeRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = nodeRef.current
    if (!active || node === null) return
    const measure = () => {
      setWidth(node.getBoundingClientRect().width)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [active])

  return {
    ref: (node) => {
      nodeRef.current = node
    },
    width,
  }
}

/** The rail's width, in px. Wide enough to read as a deliberate mark at a glance, narrow enough
 * that it cannot be mistaken for the card's own edge. */
const TONE_RAIL_WIDTH = 3

const TONE_LABEL: Record<StatCardTone, string> = {
  good: 'Within the good threshold',
  warn: 'Past the warning threshold',
  bad: 'Past the severe threshold',
}

/**
 * `StatCard` re-publishes three NAMED `WidgetHeader` slices (`WidgetHeaderTitleProps` /
 * `WidgetHeaderMetricProps` / `WidgetHeaderDeltaProps`, audit B #2) rather than re-declaring the
 * props one by one — which is how `count` came to be missing here and `unit` missing on `Section`,
 * with nothing in either type saying whether that was a decision.
 *
 * Two deliberate departures from the slices, and they are the whole omission list:
 *
 *  - **`value` is REQUIRED.** A KPI card with no number is an empty box; on `WidgetHeader` the same
 *    prop is optional because a section heading legitimately has none.
 *  - **`count` is not taken.** It is the table/list count (law C11) and a KPI card is neither.
 *
 * `Section` and `ChartCard` still cut their own ad-hoc subsets; both should move onto these same
 * three slices.
 */
export type StatCardProps = BasaltProps &
  SlotStylesProps<StatCardSlot> &
  WidgetHeaderTitleProps &
  Omit<WidgetHeaderMetricProps, 'value'> &
  WidgetHeaderDeltaProps & {
    /** Pre-formatted KPI value string (mono ~24px, weight 600, ink) — the hero-row value. Required
     * here, unlike on `WidgetHeader`: see the type's own doc. */
    value: string
    /**
     * The parts the hero number is made of — compact rows under it, one line each, no hairlines.
     *
     * It exists because three consumers wanted a KPI card that also SPLITS its number (revenue by
     * channel, uptime by probe) and the only shapes basalt offered were a `subtitle` (one muted line,
     * no second column) and a table. Both hand-rolled a card instead — which is the fork
     * `shadow-basalt-export` reports as a `HeroCard`.
     *
     * Deliberately not a table and deliberately unruled: the divider law puts a hairline between
     * OPTION rows and nowhere else (`docs/CONTROLS-SPEC.md` §2.1), and a KPI card that draws three
     * of them stops reading as one card. Keep it to two or three rows — past that the card is a
     * table, and a table is `BasaltDataTable` in a `Section`.
     */
    breakdown?: readonly StatCardBreakdownRow[]
    /**
     * The async result behind the number. Supplied, the card renders its pending / error / empty
     * branch through {@link QueryState} at the `'section'` tier, INSIDE the card body and directly
     * under the header — so the title, the icon and the info glyph stay put while the reading below
     * them resolves. Omitted, the card renders exactly as it always has (audit B #3).
     *
     * It exists because the alternative every consumer wrote is the four-way switch `QueryState`
     * exists to delete, and got it wrong in the direction that renders "no data" over a 500. The
     * BRANCH is basalt's; the number is not — `value` is still whatever you formatted, so pass a
     * placeholder (`'—'`) while the query is pending rather than a stale one.
     *
     * @example
     * <StatCard title="Active users" value={q.data ? fmt(q.data.count) : '—'} query={q} />
     */
    query?: QueryStateLike<unknown>
    /**
     * Optional trend visual. Either a node, or a RENDER PROP receiving the slot's measured box.
     *
     * Prefer the render prop for anything from `basalt-ui/charts`: those take numeric `width`/`height`
     * (SVG attributes), so a plain node has to hardcode a width, and a hardcoded width is not
     * full-bleed on any viewport but the one it was typed on. With `sparklinePlacement="bleed"` the
     * measured width is the card's own inner width including the bled inset; with `'right'` it is the
     * fixed 72×26 slot (see {@link SPARKLINE_RIGHT_WIDTH} for why that one is not measured).
     *
     * @example
     * sparkline={({ width, height }) => <BarSparkline data={history} width={width} height={height} />}
     */
    sparkline?: ReactNode | ((size: StatCardSparklineSize) => ReactNode)
    /** Where `sparkline` sits. `'bleed'` (default) is today's full-width row bled to the card edges;
     * `'right'` sits it beside the hero value row. Collapses to `'bleed'` below `sm`. */
    sparklinePlacement?: 'bleed' | 'right'
    /** Header-right slot (e.g. a ghost "..." menu trigger) — wrapped in `CtlSlot tier="widget"`, so a
     * raw `ActionIcon` with no `size` lands on the 24px step the 28px header row holds (C1/C5). */
    actions?: ReactNode
    /** Threshold verdict — draws an accent rail down the card's leading edge and announces itself to
     * assistive tech. Omitting it is NOT `'good'`: omitted covers a reading that is fine AND one that
     * is absent, and stays untinted so a card with nothing measured can never render green. Pass
     * `'good'` only to assert a measured value that has earned the verdict. */
    tone?: StatCardTone
  }

export function StatCard({
  title,
  icon,
  subtitle,
  info,
  value,
  unit,
  breakdown,
  query,
  delta,
  deltaPeriod,
  deltaPolarity,
  deltaFormat,
  deltaGlyph,
  sparkline,
  sparklinePlacement = 'bleed',
  actions,
  tone,
  className,
  style,
  classNames,
}: StatCardProps) {
  const isRender = typeof sparkline === 'function'
  const bleeds = sparklinePlacement === 'bleed'
  // Only a render prop needs a measurement; a plain node sizes itself.
  const slot = useSlotWidth(isRender)
  const measured: StatCardSparklineSize = { width: slot.width, height: SPARKLINE_RIGHT_HEIGHT }

  // A `<dl>`, not a table and not a stack of divs: each row IS a term and its value, which is the
  // one semantic that survives a reader meeting the card out of context.
  const breakdownRows =
    breakdown === undefined || breakdown.length === 0 ? null : (
      <dl className={classes.breakdown}>
        {breakdown.map((row) => (
          <div
            key={row.label}
            className={classes.breakdownRow}
            {...(row.tone !== undefined && { 'data-tone': row.tone })}
          >
            <dt className={classes.breakdownLabel}>{row.label}</dt>
            <dd className={classes.breakdownValue}>{row.value}</dd>
          </div>
        ))}
      </dl>
    )

  // Wraps `breakdownRows` in `QueryState` when a query is supplied — computed once, consumed by
  // whichever placement branch below actually renders it (`bleed` inside `.header`, `right` inside
  // `.metricsRow`), never both.
  const breakdownContent: ReactNode =
    query === undefined ? (
      breakdownRows
    ) : (
      <QueryState query={query} tier="section">
        {breakdownRows}
      </QueryState>
    )

  const sparklineNode: ReactNode =
    sparkline === undefined ? null : (
      <div
        ref={slot.ref}
        className={cx(
          bleeds ? classes.sparklineBleed : classes.sparklineRight,
          classNames?.sparkline,
        )}
        {...(!bleeds && {
          // CUSTOM PROPERTIES, not `flexBasis`/`height` directly. A React inline style beats every
          // stylesheet rule, so an inline `flexBasis: 72` also applied below `sm` — where `'right'`
          // collapses `.metricsRow` to a COLUMN and flex-basis is therefore the main-axis HEIGHT.
          // The mobile sparkline rendered in a 72px-tall box holding 26px of bars, which is the dead
          // band under every KPI value on a phone. Handed to CSS as values instead, the media query
          // can reset the box and the numbers still live in one place.
          style: {
            '--basalt-stat-sparkline-w': `${SPARKLINE_RIGHT_WIDTH}px`,
            '--basalt-stat-sparkline-h': `${SPARKLINE_RIGHT_HEIGHT}px`,
          } as CSSProperties,
        })}
      >
        {/* A measured slot renders nothing on the first commit (width 0) — an SVG at width 0 is a
            visible 0-width box that then jumps, which is worse than one frame of nothing. */}
        {isRender ? measured.width > 0 && sparkline(measured) : sparkline}
      </div>
    )

  return (
    <Card
      className={cx(classNames?.root, className)}
      style={{
        // Card inset = spacing xs / sm, matching every other basalt card. `overflow: hidden` clips
        // the full-bleed sparkline to the card's rounded corners; an element's own `box-shadow`
        // renders outside its border box and is NOT clipped by its own `overflow`, so the
        // shadow-card ring is unaffected (verified — only an ANCESTOR's overflow clips a
        // descendant's shadow). Mantine's Card root already sets `overflow: hidden`; this is
        // explicit for intent.
        //
        // NO `minHeight`. It was 118px, which is ~25px of dead space under a card holding a title
        // row, a hero row and a 26px trend — and it was dead space the card could not use, since the
        // body is `height: 100%` and the sparkline is `margin-top: auto`. The content is what states
        // the height now (~88-96px), and four cards in a `SimpleGrid` still match because a grid row
        // stretches its items.
        padding: 'var(--mantine-spacing-xs) var(--mantine-spacing-sm)',
        overflow: 'hidden',
        // Anchors the tone rail. Set unconditionally so a card's stacking context does not change
        // depending on whether it happens to have crossed a threshold this render.
        position: 'relative',
        ...style,
      }}
      data-tone={tone}
    >
      {tone !== undefined && (
        <>
          {/* The rail is decoration; the verdict it encodes is real information, so it is also
              stated in text for anyone who cannot see a 3px colour bar. Colour alone is never the
              only carrier of a threshold. */}
          <VisuallyHidden>{TONE_LABEL[tone]}</VisuallyHidden>
          <Box
            aria-hidden="true"
            style={{
              position: 'absolute',
              insetBlock: 0,
              insetInlineStart: 0,
              width: TONE_RAIL_WIDTH,
              // `StatCardTone`'s members are `VX.status` keys by construction, so the rail reads the
              // per-scheme `--vx-status-*` solid directly — never a hex, so it re-resolves in both
              // schemes and under a consumer's `derive` retune. Contrast against
              // `--vx-surface-panel` is measured in `theme/contrast.test.ts`.
              background: VX.status[tone],
            }}
          />
        </>
      )}

      <div className={cx(classes.body, classNames?.body)} data-placement={sparklinePlacement}>
        <div className={cx(classes.header, classNames?.header)}>
          <WidgetHeader
            tier="widget"
            title={title}
            {...(icon !== undefined && { icon })}
            {...(subtitle !== undefined && { subtitle })}
            {...(info !== undefined && { info })}
            value={value}
            {...(unit !== undefined && { unit })}
            {...(delta !== undefined && { delta })}
            {...(deltaPeriod !== undefined && { deltaPeriod })}
            {...(deltaPolarity !== undefined && { deltaPolarity })}
            {...(deltaFormat !== undefined && { deltaFormat })}
            {...(deltaGlyph !== undefined && { deltaGlyph })}
            // `tier="widget"`, not the default `ctl`: the header row this slot sits in is 28px
            // (`--vx-space-widget-header-height`) and a 30px `ctl` control grew it to 30, so a card
            // with a kebab sat 2px below a card without one in the same grid row. See
            // `theme/ctl-theme.tsx`'s `WIDGET_THEME`.
            {...(actions !== undefined && {
              actions: <CtlSlot tier="widget">{actions}</CtlSlot>,
            })}
          />

          {/* INSIDE `.header` for `bleed` ONLY (measured defect: `right` used to put the WHOLE
              header — actions included — beside the sparkline, so `.actions`' own
              `margin-inline-start: auto` resolved against wherever the sparkline began instead of
              the card's true right edge). For `right`, breakdown moves to `.metricsRow` below,
              beside the sparkline instead — `.header` now stays the FULL card width in both
              placements, so the actions slot always reaches the same edge the phone form already
              got right. */}
          {bleeds && breakdownContent}
        </div>

        {bleeds
          ? sparklineNode
          : (breakdownContent !== null || sparklineNode !== null) && (
              <div className={classes.metricsRow}>
                {breakdownContent}
                {sparklineNode}
              </div>
            )}
      </div>
    </Card>
  )
}
