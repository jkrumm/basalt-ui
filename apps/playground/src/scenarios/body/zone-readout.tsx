/**
 * A zone readout that names the zone in text (argo UPSTREAM strength review). The word is
 * `VX.status.good` text (solved to AA); the fill-only `VX.status.excellent` colours the swatch.
 * `basalt/status-fill-as-text` steers to this split.
 */
import { Box, Group, Skeleton, Text } from '@mantine/core'
import { Section } from 'basalt-ui'
import { VX } from 'basalt-ui/tokens'
import { queryFor } from '../shot-state'
import type { ScenarioProps } from '../shot-state'
import { STRENGTH_ERROR } from './body-data'

const ZONE = { name: 'Productive', inol: 0.84, lift: 'Squat' } as const

export function BodyZoneReadout({ shotState }: ScenarioProps) {
  const query = queryFor(shotState === 'loading' ? undefined : shotState, STRENGTH_ERROR)
  return (
    <Box data-shot="zone-readout">
      <Section
        title="INOL zone"
        empty={{
          title: 'No zone to read',
          description: 'INOL needs at least two sessions per lift in this window.',
        }}
        {...(query !== undefined && { query })}
      >
        {shotState === 'loading' ? (
          <Skeleton h={22} maw={320} />
        ) : (
          <Group gap="xs" wrap="nowrap" align="center">
            <Box aria-hidden w={10} h={10} bg={VX.status.excellent} bdrs="50%" flex="none" />
            <Text fw={600} c={VX.status.good}>
              {ZONE.name}
            </Text>
            <Text c="dimmed" fz={VX.text.sm}>
              {ZONE.lift} · INOL {ZONE.inol.toFixed(2)} this week
            </Text>
          </Group>
        )}
      </Section>
    </Box>
  )
}
