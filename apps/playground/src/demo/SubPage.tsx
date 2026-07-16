import type { CSSProperties } from 'react'
import { Stack, Text, Paper, Group, Badge } from '@mantine/core'
import { StatCard } from 'basalt-ui'
import { VX } from 'basalt-ui/tokens'

// Matches the shipped ChartCard/SettingsSection title style (head font, 88% stretch, weight 550,
// VX.text.md) so this hand-rolled title reads as the SAME card chrome as the shipped composites.
const titleStyle: CSSProperties = {
  fontFamily: 'var(--basalt-font-head)',
  fontStretch: '88%',
  fontWeight: 550,
  fontSize: VX.text.md,
  color: VX.ink,
}

export type SubPageStat = {
  key: string
  label: string
  value: string
  delta?: number
}

export type SubPageProps = {
  title: string
  description: string
  range?: string | undefined
  /** A small, real KPI panel (via the shipped `StatCard`) — proves the sub-route renders live
   * data, not a placeholder. Keep it to a couple of stats; this is not a second dashboard. */
  stats: readonly SubPageStat[]
}

export function SubPage({ title, description, range, stats }: SubPageProps) {
  return (
    <Stack gap="md">
      <Paper py="xs" px="sm">
        <Group justify="space-between" mb="xs">
          <Text style={titleStyle}>{title}</Text>
          {range ? (
            <Badge size="sm" variant="light">
              {range}
            </Badge>
          ) : null}
        </Group>
        <Text size="sm" c="dimmed">
          {description}
        </Text>
      </Paper>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {stats.map((stat) => (
          <StatCard
            key={stat.key}
            label={stat.label}
            value={stat.value}
            {...(stat.delta !== undefined && { delta: stat.delta })}
          />
        ))}
      </div>
    </Stack>
  )
}
