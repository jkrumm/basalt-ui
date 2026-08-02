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
 * good one nor a bad one, and must never be tinted.
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
 */
import { Box, Card, Group, VisuallyHidden } from '@mantine/core'
import type { ReactNode } from 'react'
import { DeltaBadge } from './delta-badge'
import { VX } from '../tokens'

/** A threshold verdict on the card's value. `undefined` is never tinted — see the module docblock. */
export type StatCardTone = 'warn' | 'bad'

/** The rail's width, in px. Wide enough to read as a deliberate mark at a glance, narrow enough
 * that it cannot be mistaken for the card's own edge. */
const TONE_RAIL_WIDTH = 3

const TONE_LABEL: Record<StatCardTone, string> = {
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
   * assistive tech. Omit it for a reading that is fine, and for one that is absent. */
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
        display: 'flex', // theme-allow: Card root as a flex column — Mantine Card takes no layout props
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
              background: tone === 'bad' ? VX.status.bad : VX.status.warn,
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
