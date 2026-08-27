/**
 * StatCard — the KPI atom (docs/DESIGN-SPEC.md §5, docs/CONTROLS-SPEC.md §2.2): a panel +
 * shadow-card + card-radius card (spacing xs/sm inset, ~118px min-height). The header composes
 * `WidgetHeader tier="widget"` — title/icon/value/delta/deltaPeriod all render through it, on the
 * shared hero-metric row under the title. `actions` (e.g. a ghost "..." menu trigger) is wrapped in
 * `CtlSlot` — `StatCard` is Mantine-coupled (`src/dashboard/`), unlike `ChartCard`.
 *
 * `sparklinePlacement` decides where the trend visual sits: `'bleed'` (default) keeps the historic
 * full-width row beneath the hero value, bled past the card's own inset padding; `'right'` sits it
 * beside the hero row, the reference-design look. Below `sm`, `'right'` collapses back to the
 * `'bleed'` layout — CSS only, no JS branch (`stat-card.module.css`).
 *
 * `src/dashboard` stays @visx-free — `sparkline` is a plain `ReactNode` slot, never a chart import
 * here. Pass a `LineSparkline`/`BarSparkline` from `basalt-ui/charts` at the call site.
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
 * import { LineSparkline, useChartSize } from 'basalt-ui/charts'
 *
 * // `LineSparkline` takes a fixed `width` prop — genuine full-bleed means measuring the card's
 * // own width first (`useChartSize`), never a hardcoded pixel value.
 * function KpiSparkline({ data }: { data: number[] }) {
 *   const { ref, width } = useChartSize()
 *   return (
 *     <div ref={ref} style={{ width: '100%' }}>
 *       {width > 0 && <LineSparkline data={data} width={width} height={32} />}
 *     </div>
 *   )
 * }
 *
 * <StatCard
 *   title="Active Users"
 *   value="12,483"
 *   delta={4.2}
 *   sparkline={<KpiSparkline data={history} />}
 * />
 *
 * @example
 * // The reference-design look — sparkline beside the hero value row instead of bled below it.
 * <StatCard
 *   title="Active Users"
 *   value="12,483"
 *   delta={4.2}
 *   sparklinePlacement="right"
 *   sparkline={<BarSparkline data={history} width={72} height={28} ariaLabel="Active users trend" />}
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
import type { ReactNode } from 'react'
import { WidgetHeader } from '../widget-header'
import { CtlSlot } from '../theme'
import { VX } from '../tokens'
import classes from './stat-card.module.css'

/** A threshold verdict on the card's value. `undefined` is never tinted — see the module docblock. */
export type StatCardTone = 'good' | 'warn' | 'bad'

/** The rail's width, in px. Wide enough to read as a deliberate mark at a glance, narrow enough
 * that it cannot be mistaken for the card's own edge. */
const TONE_RAIL_WIDTH = 3

const TONE_LABEL: Record<StatCardTone, string> = {
  good: 'Within the good threshold',
  warn: 'Past the warning threshold',
  bad: 'Past the severe threshold',
}

export type StatCardProps = {
  /** Head-font title, rendered via `WidgetHeader tier="widget"`. */
  title: string
  /** Optional leading icon, forwarded to `WidgetHeader`. */
  icon?: ReactNode
  /** Pre-formatted KPI value string (mono ~24px, weight 600, ink) — the hero-row value. */
  value: string
  /** Signed delta rendered via `DeltaBadge`; omit to hide the trend chip entirely. */
  delta?: number
  /** Optional comparison timeframe shown after the delta (e.g. `MoM`) — forwarded to `DeltaBadge`. */
  deltaPeriod?: string
  /** Optional trend visual — a slot; pass a `LineSparkline`/`BarSparkline` from `basalt-ui/charts`. */
  sparkline?: ReactNode
  /** Where `sparkline` sits. `'bleed'` (default) is today's full-width row bled to the card edges;
   * `'right'` sits it beside the hero value row. Collapses to `'bleed'` below `sm`. */
  sparklinePlacement?: 'bleed' | 'right'
  /** Header-right slot (e.g. a ghost "..." menu trigger) — wrapped in `CtlSlot` (C1/C5). */
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
  value,
  delta,
  deltaPeriod,
  sparkline,
  sparklinePlacement = 'bleed',
  actions,
  tone,
}: StatCardProps) {
  return (
    <Card
      style={{
        // Card inset = spacing xs / sm, matching every other basalt card. `overflow: hidden` clips
        // the full-bleed sparkline to the card's rounded corners; an element's own `box-shadow`
        // renders outside its border box and is NOT clipped by its own `overflow`, so the
        // shadow-card ring is unaffected (verified — only an ANCESTOR's overflow clips a
        // descendant's shadow). Mantine's Card root already sets `overflow: hidden`; this is
        // explicit for intent.
        padding: 'var(--mantine-spacing-xs) var(--mantine-spacing-sm)',
        minHeight: 118,
        overflow: 'hidden',
        // Anchors the tone rail. Set unconditionally so a card's stacking context does not change
        // depending on whether it happens to have crossed a threshold this render.
        position: 'relative',
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

      <div className={classes.body} data-placement={sparklinePlacement}>
        <div className={classes.header}>
          <WidgetHeader
            tier="widget"
            title={title}
            {...(icon !== undefined && { icon })}
            value={value}
            {...(delta !== undefined && { delta })}
            {...(deltaPeriod !== undefined && { deltaPeriod })}
            {...(actions !== undefined && { actions: <CtlSlot>{actions}</CtlSlot> })}
          />
        </div>

        {sparkline !== undefined && (
          <div
            className={
              sparklinePlacement === 'right' ? classes.sparklineRight : classes.sparklineBleed
            }
          >
            {sparkline}
          </div>
        )}
      </div>
    </Card>
  )
}
