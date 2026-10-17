/**
 * StatCard — the metric card (docs/waves/design-parity/SPEC.md § 6.1): a panel + shadow-card +
 * card-radius card (inset `cardInsetY`/`cardInsetX`, no min-height) holding, top to bottom,
 *
 *  1. the CAPTION row — `title` as a mono uppercase `micro` faint label, the optional `info` glyph,
 *     `qualifier` right-aligned (period, target or source; it takes its own line UNDER the caption,
 *     left-aligned, when the card is too narrow for both), and the `actions` slot;
 *  2. the VALUE row — the hero figure (`kpi`, mono 500), `unit` inline at `sm` muted on the same
 *     baseline, then the delta (text only — see `DeltaBadge`) and its muted `deltaPeriod`;
 *  3. the FOOT — the `sparkline` visual (22 px, bled to the card's side edges) and one muted `sm`
 *     `subtitle` line under it (a source or "as of", never a restatement of the caption).
 *
 * Exactly three type sizes: `micro` (caption, qualifier, delta period), `sm` (unit, delta, footer)
 * and the hero. The foot reserves the height of a visual plus a footer line whenever either is
 * present, so cards in one grid row share a footprint with or without a visual.
 *
 * `StatCard` renders this anatomy itself (it no longer goes through `WidgetHeader`, whose head-font
 * title is `ChartCard`'s and the section headers'). `InfoGlyph` and `DeltaBadge` are the shared parts.
 *
 * `sparklinePlacement` decides where the trend visual sits: `'bleed'` (default) puts it in the foot,
 * full card width; `'right'` sits it beside the `breakdown` rows below the value row, a fixed 72×22
 * slot. In a card narrower than 480px, `'right'` collapses back to the `'bleed'` layout — CSS only.
 *
 * `src/dashboard` stays chart-free — `sparkline` is a plain `ReactNode` slot (or a render prop over
 * the slot's measured box), never a chart import here. Pass `<Sparkline>` from `basalt-ui/charts` at
 * the call site: its defaults (end dot in the line neutral, 1.5 stroke, no axes) are made for this slot.
 *
 * `query` drives the card's branches at the card's own footprint: pending shows a skeleton (caption,
 * value bar, visual slot — never a spinner), failed-with-no-data replaces the value row with the
 * `QueryState` error (one sentence + Retry), and an empty result replaces it with one muted line
 * (`emptyText`). `loading` shows the same skeleton with no query at all. The caption row stays put
 * in every branch.
 *
 * `tone` states a threshold verdict as a status dot plus a short word on the caption row (`OK`,
 * `Watch`, `Over`), with the full phrase for assistive tech. The dot carries the colour and the word
 * the meaning, so the verdict never rides on colour alone. It exists because `value` is typed
 * `string`: without it, a card whose number has crossed a threshold reads exactly as calm as one
 * that hasn't. A coloured edge stripe is not the form — it reads as generic dashboard decoration
 * (Wave 34). `undefined` renders nothing at all — absence of a reading is neither a good one nor a
 * bad one, and must never be tinted. `'good'` is a deliberate positive verdict, never the meaning
 * of omission: it exists for the threshold where the calm number IS the finding (zero
 * downtime over the window), and a card that has measured nothing must not be able to reach green by
 * leaving the prop off.
 *
 * @example
 * import { StatCard } from 'basalt-ui'
 * import { Sparkline } from 'basalt-ui/charts'
 *
 * // `sparkline` is a RENDER PROP over the slot's measured box, so full-bleed is genuinely the
 * // card's width — no measuring wrapper component, no hardcoded pixel value.
 * <StatCard
 *   title="Active users"
 *   qualifier="30 days"
 *   value="12,483"
 *   delta={4.2}
 *   deltaPeriod="MoM"
 *   subtitle="Source: events table"
 *   sparkline={(size) => <Sparkline ariaLabel="Active users" data={history} {...size} />}
 * />
 *
 * @example
 * // The unit inline, the method behind the info glyph.
 * <StatCard
 *   title="Training load"
 *   qualifier="7-day rolling"
 *   value="412"
 *   unit="TSS"
 *   info="Sum of per-session TSS over the last 7 days, Garmin-reported."
 * />
 *
 * @example
 * // A pending card with no query: the skeleton at the card's own footprint.
 * <StatCard title="Active users" value="—" loading sparkline={() => null} />
 *
 * @example
 * // Past a threshold — a status dot and the word "Over" on the caption row, value untouched.
 * <StatCard title="Downtime" value="29 min" tone="bad" />
 *
 * @example
 * // The honest gate. A zero can be synthesized as well as measured — a downtime figure derived
 * // from outage rows reads 0 both when probes ran clean AND when no probe cycle was ingested at
 * // all, because a dead collector opens no outage row either. `tone` is a positive assertion
 * // about a reading, so the gate belongs on whether a reading exists, not on whether the number
 * // happens to be defined — those are separate facts. Gate on measured coverage instead:
 * <StatCard
 *   title="Downtime"
 *   qualifier="24 h"
 *   value={`${downtimeMinutes} min`}
 *   tone={hasCoverage ? (downtimeMinutes === 0 ? 'good' : 'bad') : undefined}
 * />
 */
import { Card, VisuallyHidden } from '@mantine/core'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  BreakdownSkeleton,
  CaptionRow,
  FooterSkeleton,
  Foot,
  ValueSkeleton,
  VisualSkeleton,
  rightSlotStyle,
} from './stat-card-parts'
import type {
  WidgetHeaderDeltaProps,
  WidgetHeaderMetricProps,
  WidgetHeaderTitleProps,
} from './widget-header'
import { DeltaBadge } from './delta-badge'
import { cx } from '../common/props'
import type { BasaltProps, SlotStylesProps, Tone } from '../common/props'
import { ErrorState, QueryState, resolveQueryBranch } from './query-state'
import type { QueryBranch, QueryStateLike } from './query-state'
import classes from './stat-card.module.css'

/**
 * The boxes `StatCard` paints, and the whole styling seam it offers (`common/props.ts`).
 * `value` is not its own slot: the hero number is painted inside the `header` box.
 */
export type StatCardSlot = 'root' | 'header' | 'body' | 'sparkline'

/**
 * One row of a {@link StatCardProps.breakdown} — the two or three parts a hero number is made of.
 *
 * `value` is a pre-formatted `string` for the same reason the hero's is: the card cannot know the
 * locale, the currency or the precision the number was measured at. `tone` marks ONE row as past a
 * threshold and is the same vocabulary as the card's own `tone`, so a row saying `bad` and a dot
 * saying `bad` are the same claim at two scales; omitting it is untinted, never `'good'`.
 */
export type StatCardBreakdownRow = {
  readonly label: string
  readonly value: string
  readonly tone?: Tone
}

/**
 * The `'right'` placement's slot width, in px — a flex BASIS, not a fixed size. 72 is the reference
 * KPI card's trend width and the slot asks for exactly that; when the value row needs the space (a
 * long formatted value plus a delta in a 4-up grid) the slot is the side that yields, because the
 * number is the card's content and the trend qualifies it. The render prop is handed the MEASURED
 * width either way, so the bars are drawn at the width they actually got.
 */
const SPARKLINE_RIGHT_WIDTH = 72
/** The sparkline slot's height in both placements (SPEC § 6.2: 26 → 22). */
const SPARKLINE_HEIGHT = 22

/**
 * The measured box a `sparkline` render prop receives.
 *
 * An SVG sparkline takes `width`/`height` as NUMBERS (they are SVG attributes — an
 * svg cannot size itself from CSS and then scale its scales), so "full bleed" was never expressible
 * as a `ReactNode`: the caller had to guess a pixel width, or write its own measuring wrapper
 * component. Four consumers wrote that wrapper; two of them hardcoded a width and drew a sparkline
 * that stopped short of the card edge on every viewport but the one they built on.
 */
export type StatCardSparklineSize = {
  width: number
  height: number
}

/**
 * Measures a slot and re-measures on resize. Plain `ResizeObserver`: `src/dashboard/**` is
 * Mantine-coupled and chart-FREE (see the module doc).
 *
 * The `undefined` guard is for the test DOM — happy-dom ships no `ResizeObserver`, and the one-shot
 * measure above it is what keeps a mounted card rendering its sparkline there.
 */
function useSlotWidth(active: boolean): {
  ref: (node: HTMLDivElement | null) => void
  width: number
} {
  const [width, setWidth] = useState(0)
  // State, not a ref: the slot mounts and unmounts with the card's branch (skeleton → figure), so
  // the effect must re-run when the node itself changes, not only when `active` does.
  const [node, setNode] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
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
  }, [active, node])

  return { ref: setNode, width }
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
  Omit<WidgetHeaderTitleProps, 'subtitle'> &
  Omit<WidgetHeaderMetricProps, 'value'> &
  WidgetHeaderDeltaProps & {
    /** Pre-formatted hero figure (mono `kpi`, weight 500, ink). Required here, unlike on
     * `WidgetHeader`: see the type's own doc. */
    value: string
    /**
     * Right-aligned on the caption row, `micro` muted: the period, target or source the figure is
     * measured over (`30 days`, `target 99.9%`). Wraps under the caption when the card is too narrow
     * for both. Not a restatement of the caption.
     */
    qualifier?: string
    /**
     * One muted `sm` line in the foot, under the visual: a source or "as of"
     * (`Source: events table`, `as of 14:02`), never a restatement of the caption. It was a line
     * under the title before; the old placement has no replacement — put the text in `qualifier`
     * (period/target) or `info` (method).
     */
    subtitle?: string
    /**
     * Shows the skeleton at the card's own footprint (caption stays, value bar, visual slot) without
     * a query — for a streamed or suspended value. With a `query` the pending branch shows it by
     * itself. No spinner ever renders inside a card.
     */
    loading?: boolean
    /** The one muted line the empty branch shows in place of the figure. Say why it is empty.
     * Default `No data for this period`. */
    emptyText?: string
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
     * The async result behind the number. Supplied, the card picks its body from it, at the card's
     * own footprint and with the caption row untouched:
     *
     *  - pending → the skeleton (caption, value bar, visual slot), never a spinner;
     *  - error with no data → `QueryState`'s error at the `'section'` tier: one sentence and Retry;
     *  - empty (`[]`, `{ data: [] }`, or idle with no data) → one muted line, {@link emptyText};
     *  - data → the figure, with `breakdown` behind `QueryState`. A failed background refetch shows
     *    its "cached data" banner over the breakdown only; the figure path adds no banner.
     *
     * The BRANCH is basalt's; the number is not — `value` is still whatever you formatted.
     *
     * @example
     * <StatCard title="Active users" value={q.data ? fmt(q.data.count) : '—'} query={q} />
     */
    query?: QueryStateLike<unknown>
    /**
     * Optional trend visual. Either a node, or a RENDER PROP receiving the slot's measured box.
     *
     * Prefer the render prop for any SVG sparkline: those take numeric `width`/`height`
     * (SVG attributes), so a plain node has to hardcode a width, and a hardcoded width is not
     * full-bleed on any viewport but the one it was typed on. With `sparklinePlacement="bleed"` the
     * measured width is the card's own inner width including the bled inset, 22 px tall; with
     * `'right'` it is the 72×22 slot (see {@link SPARKLINE_RIGHT_WIDTH} for why the width is a basis).
     *
     * A render prop is a sanctioned pattern here, so `react/no-unstable-nested-components` is
     * configured with `allowAsProps` in the shipped preset. Spread the size (`{...size}`) into the
     * chart.
     *
     * @example
     * sparkline={(size) => <Sparkline ariaLabel="Active users" data={history} {...size} />}
     */
    sparkline?: ReactNode | ((size: StatCardSparklineSize) => ReactNode)
    /** Where `sparkline` sits. `'bleed'` (default) is the foot, full card width, bled to the side
     * edges; `'right'` sits it beside the `breakdown` rows. Collapses to `'bleed'` in a card narrower
     * than 480px. */
    sparklinePlacement?: 'bleed' | 'right'
    /** Caption-row right slot (e.g. a ghost "..." menu trigger) — wrapped in `CtlSlot tier="widget"`,
     * so a raw `ActionIcon` with no `size` lands on the 24px step the caption row holds (C1/C5). */
    actions?: ReactNode
    /** Threshold verdict — a status dot plus a short word (`OK` / `Watch` / `Over`) on the caption
     * row, with the full phrase for assistive tech. Omitting it is NOT `'good'`: omitted covers a
     * reading that is fine AND one that is absent, and stays untinted so a card with nothing
     * measured can never render green. Pass `'good'` only to assert a measured value that has
     * earned the verdict. */
    tone?: Tone
  }

/**
 * The value row's body per branch (loading > error > pending > empty > ready; the resolver orders the
 * query branches). The caption row above it is identical in all of them.
 */
function renderValueBody({
  pending,
  resolved,
  figure,
  emptyText,
}: {
  pending: boolean
  resolved: QueryBranch<unknown> | undefined
  figure: ReactNode
  emptyText: string
}): ReactNode {
  if (resolved === undefined) return pending ? <ValueSkeleton /> : figure
  // `loading` with a query still shows the skeleton, but a failed query is never hidden by it.
  if (pending && resolved.kind !== 'error') return <ValueSkeleton />
  switch (resolved.kind) {
    case 'pending':
      return <ValueSkeleton />
    case 'error':
      // The error state itself — not `QueryState` with nothing to wrap, which over cached-empty data
      // would draw its "cached data" banner above an empty region.
      return (
        <ErrorState
          error={resolved.error}
          title="Could not load this figure"
          tier="section"
          onRetry={() => void resolved.query.refetch()}
          retrying={resolved.query.fetchStatus === 'fetching'}
        />
      )
    case 'empty':
      return <p className={classes.empty}>{emptyText}</p>
    case 'ready':
      return figure
    default:
      return resolved satisfies never
  }
}

function renderVisualNode({
  show,
  pending,
  slot,
}: {
  show: boolean
  pending: boolean
  slot: ReactNode
}): ReactNode {
  if (!show) return null
  if (pending) return <VisualSkeleton />
  return slot
}

function renderFooterNode({
  subtitle,
  pending,
}: {
  subtitle: string | undefined
  pending: boolean
}): ReactNode {
  if (subtitle === undefined) return null
  if (pending) return <FooterSkeleton />
  return (
    <p className={classes.footer} title={subtitle}>
      {subtitle}
    </p>
  )
}

export function StatCard({
  title,
  icon,
  info,
  qualifier,
  subtitle,
  value,
  unit,
  breakdown,
  query,
  loading = false,
  emptyText = 'No data for this period',
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
  const { ref: slotRef, width: slotWidth } = useSlotWidth(isRender)
  const resolved = query === undefined ? undefined : resolveQueryBranch(query, 'StatCard')
  const kind = resolved?.kind ?? 'ready'
  const pending = loading || kind === 'pending'
  const ready = !pending && kind === 'ready'
  const measured: StatCardSparklineSize = { width: slotWidth, height: SPARKLINE_HEIGHT }

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

  // Behind `QueryState` when a query is supplied, so an error WITH data shows its "cached data"
  // banner. Computed once, consumed by whichever placement branch below renders it, never both.
  const breakdownContent: ReactNode =
    query === undefined ? (
      breakdownRows
    ) : (
      <QueryState query={query} tier="section">
        {breakdownRows}
      </QueryState>
    )

  // Built ONLY when ready: the render prop must not run in a pending / failed / empty branch, where
  // the last measured width is stale.
  const sparklineSlot: ReactNode =
    !ready || sparkline === undefined ? null : (
      <div
        ref={slotRef}
        className={cx(
          bleeds ? classes.sparklineBleed : classes.sparklineRight,
          classNames?.sparkline,
        )}
        {...(!bleeds && { style: rightSlotStyle(SPARKLINE_RIGHT_WIDTH, SPARKLINE_HEIGHT) })}
      >
        {/* A measured slot renders nothing on the first commit (width 0) — an SVG at width 0 is a
            visible 0-width box that then jumps, which is worse than one frame of nothing. */}
        {isRender ? measured.width > 0 && sparkline(measured) : sparkline}
      </div>
    )

  const figure = (
    <div className={classes.valueRow}>
      <span className={classes.figure}>
        <span className={classes.value}>{value}</span>
        {unit !== undefined && <span className={classes.unit}>{unit}</span>}
      </span>
      {delta !== undefined && (
        <DeltaBadge
          value={delta}
          period={deltaPeriod}
          {...(deltaPolarity !== undefined && { polarity: deltaPolarity })}
          {...(deltaFormat !== undefined && { format: deltaFormat })}
          {...(deltaGlyph !== undefined && { withGlyph: deltaGlyph })}
        />
      )}
    </div>
  )

  const valueBody = renderValueBody({ pending, resolved, figure, emptyText })

  const breakdownCount = breakdown?.length ?? 0
  const hasBreakdown = breakdownCount > 0
  // `'right'` keeps its row — and the 72×22 slot in it — while pending, so the card does not jump
  // when the reading lands.
  const rightRow =
    !bleeds &&
    (ready
      ? breakdownContent !== null || sparklineSlot !== null
      : pending && (hasBreakdown || sparkline !== undefined))

  const hasBleedVisual = sparkline !== undefined && bleeds
  const visualNode = renderVisualNode({ show: hasBleedVisual, pending, slot: sparklineSlot })
  const footerNode = renderFooterNode({ subtitle, pending })

  return (
    <Card
      className={cx(classNames?.root, className)}
      style={{
        // Card inset = the `cardInsetY`/`cardInsetX` role tokens (12/16 at level 0, the `sm`/`md`
        // rungs of the spacing grid), matching every other basalt card because `ChartCard` reads
        // the SAME two vars. Below `sm` the horizontal one steps a rung down (to 12) on its own:
        // the responsive half of the ladder lives in `spaceMobileDecls` (`tokens/index.ts`), which
        // is the only home that can reach an inline style like this one.
        //
        // `overflow: hidden` clips the full-bleed sparkline to the card's rounded corners. An
        // element's own `box-shadow` renders outside its border box and is NOT clipped by its own
        // `overflow`, so the shadow-card ring is unaffected.
        //
        // NO `minHeight`: the content states the height (the foot reserves its own), and cards in a
        // grid row stretch to the tallest.
        padding: 'var(--vx-space-card-inset-y, 0.75rem) var(--vx-space-card-inset-x, 1rem)',
        overflow: 'hidden',
        // Consumers may anchor overlays (badges, menus) to the card, so it stays a positioned box.
        position: 'relative',
        // The card's own width drives its chrome (`stat-card.module.css`).
        containerType: 'inline-size',
        containerName: 'basalt-card',
        ...style,
      }}
      data-tone={tone}
    >
      <div
        className={cx(classes.body, classNames?.body)}
        data-placement={sparklinePlacement}
        {...(pending && { 'aria-busy': true })}
      >
        {pending && <VisuallyHidden>{`Loading ${title}`}</VisuallyHidden>}
        <div className={cx(classes.header, classNames?.header)}>
          <CaptionRow
            title={title}
            {...(icon !== undefined && { icon })}
            {...(info !== undefined && { info })}
            {...(qualifier !== undefined && { qualifier })}
            {...(tone !== undefined && { tone })}
            {...(actions !== undefined && { actions })}
          />

          {valueBody}

          {/* INSIDE `.header` for `bleed` ONLY (`right` puts it beside the sparkline in
              `.metricsRow`, so the header stays the full card width in both placements). */}
          {bleeds &&
            (pending
              ? hasBreakdown && <BreakdownSkeleton rows={breakdownCount} />
              : ready && breakdownContent)}
        </div>

        {rightRow && (
          <div className={classes.metricsRow}>
            {ready ? (
              <>
                {breakdownContent}
                {sparklineSlot}
              </>
            ) : (
              <>
                {hasBreakdown && <BreakdownSkeleton rows={breakdownCount} />}
                {sparkline !== undefined && (
                  <div
                    className={classes.sparklineRight}
                    style={rightSlotStyle(SPARKLINE_RIGHT_WIDTH, SPARKLINE_HEIGHT)}
                  >
                    <VisualSkeleton />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <Foot
          reserve={hasBleedVisual || subtitle !== undefined}
          visualBand={bleeds}
          visualNode={visualNode}
          footerNode={footerNode}
        />
      </div>
    </Card>
  )
}
