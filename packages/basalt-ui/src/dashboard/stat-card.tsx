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
 */
import { Card, Group } from '@mantine/core'
import type { ReactNode } from 'react'
import { DeltaBadge } from './delta-badge'
import { VX } from '../tokens'

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
}

export function StatCard({ label, value, delta, deltaPeriod, sparkline, menu }: StatCardProps) {
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
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--vx-space-stat-card-gap)',
        overflow: 'hidden',
      }}
    >
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
