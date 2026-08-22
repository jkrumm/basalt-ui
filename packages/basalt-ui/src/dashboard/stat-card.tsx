/**
 * StatCard — the KPI atom (docs/DESIGN-SPEC.md §5): a panel + shadow-card + card-radius card
 * (spacing xs/sm inset, ~118px min-height). Header row = mono uppercase micro-label + optional
 * `menu` slot (e.g. a ghost "..." trigger, consumer-owned); value row = mono ~24px value +
 * optional `DeltaBadge` (via `delta`, with an optional `deltaPeriod` timeframe); bottom = optional
 * full-bleed `sparkline` slot.
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
 * import { LineSparkline } from 'basalt-ui/charts'
 *
 * <StatCard
 *   label="Active Users"
 *   value="12,483"
 *   delta={4.2}
 *   sparkline={<LineSparkline data={history} width={160} height={32} />}
 * />
 *
 * @example
 * // Past a threshold — an accent rail down the leading edge, value untouched.
 * <StatCard label="Downtime" value="29 min" tone="bad" />
 *
 * @example
 * // The earned zero — a measured value worth asserting, not a card that merely has no reading.
 * <StatCard label="Downtime · last 24h" value="0 min" tone="good" />
 *
 * @example
 * // The honest gate. A zero can be synthesized as well as measured — a downtime figure derived
 * // from outage rows reads 0 both when probes ran clean AND when no probe cycle was ingested at
 * // all, because a dead collector opens no outage row either. `tone` is a positive assertion
 * // about a reading, so the gate belongs on whether a reading exists, not on whether the number
 * // happens to be defined — those are separate facts. Gate on measured coverage instead:
 * <StatCard
 *   label="Downtime · last 24h"
 *   value={`${downtimeMinutes} min`}
 *   tone={hasCoverage ? (downtimeMinutes === 0 ? 'good' : 'bad') : undefined}
 * />
 */
import { Box, Card, Group, VisuallyHidden } from '@mantine/core'
import type { ReactNode } from 'react'
import { DeltaBadge } from './delta-badge'
import { VX } from '../tokens'

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
  /** Mono uppercase micro-label (docs/DESIGN-SPEC.md §3: 12.5px, tracking 0.06em, faint). */
  label: string
  /** Pre-formatted KPI value string (mono ~24px, weight 600, ink). */
  value: string
  /** Signed delta rendered via `DeltaBadge`; omit to hide the trend chip entirely. */
  delta?: number
  /** Optional comparison timeframe shown after the delta (e.g. `MoM`) — forwarded to `DeltaBadge`. */
  deltaPeriod?: string
  /** Optional trend visual — a slot; pass a `LineSparkline`/`BarSparkline` from `basalt-ui/charts`.
   * Rendered full-bleed to the card's left/right/bottom edges, clipped to the corner radius. */
  sparkline?: ReactNode
  /** Optional header-right slot (e.g. a ghost "..." menu trigger) — consumer-owned. */
  menu?: ReactNode
  /** Threshold verdict — draws an accent rail down the card's leading edge and announces itself to
   * assistive tech. Omitting it is NOT `'good'`: omitted covers a reading that is fine AND one that
   * is absent, and stays untinted so a card with nothing measured can never render green. Pass
   * `'good'` only to assert a measured value that has earned the verdict. */
  tone?: StatCardTone
}

export function StatCard({
  label,
  value,
  delta,
  deltaPeriod,
  sparkline,
  menu,
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
        display: 'flex', // theme-allow inline-display — Card root as a flex column; Mantine Card takes no layout props
        flexDirection: 'column',
        gap: 'var(--vx-space-stat-card-gap)',
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

      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
        <span
          style={{
            fontFamily: 'var(--basalt-font-mono)',
            fontSize: VX.text.xs,
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: VX.faint,
          }}
        >
          {label}
        </span>
        {menu}
      </Group>

      <Group align="center" gap={8} wrap="nowrap">
        <span
          style={{
            fontFamily: 'var(--basalt-font-mono)',
            fontSize: VX.text.kpi,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: VX.ink,
          }}
        >
          {value}
        </span>
        {delta !== undefined && <DeltaBadge value={delta} period={deltaPeriod} />}
      </Group>

      {sparkline && (
        <div
          style={{
            marginTop: 'auto',
            marginInline: 'calc(-1 * var(--mantine-spacing-sm))',
            marginBottom: 'calc(-1 * var(--mantine-spacing-xs))',
          }}
        >
          {sparkline}
        </div>
      )}
    </Card>
  )
}
