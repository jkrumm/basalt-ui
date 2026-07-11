/**
 * StatCard — the KPI atom (docs/DESIGN-SPEC.md §5): a panel + shadow-card + 10px-radius card
 * (~17/19px padding, ~142px min-height). Header row = mono uppercase micro-label + optional
 * `menu` slot (e.g. a ghost "..." trigger, consumer-owned); value row = mono ~29px value +
 * optional `DeltaBadge` (via `delta`); bottom = optional `sparkline` slot.
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
  /** Mono uppercase micro-label (docs/DESIGN-SPEC.md §3: 10.5px, tracking 0.06em, faint). */
  label: string
  /** Pre-formatted KPI value string (mono ~29px, weight 600, ink). */
  value: string
  /** Signed delta rendered via `DeltaBadge`; omit to hide the trend chip entirely. */
  delta?: number
  /** Optional trend visual — a slot; pass a `LineSparkline`/`BarSparkline` from `basalt-ui/charts`. */
  sparkline?: ReactNode
  /** Optional header-right slot (e.g. a ghost "..." menu trigger) — consumer-owned. */
  menu?: ReactNode
}

export function StatCard({ label, value, delta, sparkline, menu }: StatCardProps) {
  return (
    <Card
      style={{
        padding: '17px 19px',
        minHeight: 142,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
        <span
          style={{
            fontFamily: 'var(--basalt-font-mono)',
            fontSize: VX.text.micro,
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
        {delta !== undefined && <DeltaBadge value={delta} />}
      </Group>

      {sparkline && <div style={{ marginTop: 'auto' }}>{sparkline}</div>}
    </Card>
  )
}
