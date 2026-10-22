/**
 * A zone readout that names the zone in text (argo UPSTREAM strength review). The word is
 * `VX.status.good` text (solved to AA); the fill-only `VX.status.excellent` colours the swatch.
 * `basalt/status-fill-as-text` steers to this split.
 */
import { Box, Group, Text } from '@mantine/core'
import { Section } from 'basalt-ui'
import { VX } from 'basalt-ui/tokens'
import { queryFor } from '../shot-state'
import type { ScenarioProps } from '../shot-state'

const ZONE = { name: 'Productive', inol: 0.84, lift: 'Squat' } as const

export function BodyZoneReadout({ shotState }: ScenarioProps) {
  const query = queryFor(shotState, 'The strength log did not answer.')
  return (
    <Box data-shot="zone-readout">
      <Section title="INOL zone" {...(query !== undefined && { query })}>
        <Group gap="xs" wrap="nowrap" align="center">
          <Box aria-hidden w={10} h={10} bg={VX.status.excellent} bdrs="50%" flex="none" />
          <Text fw={600} c={VX.status.good}>
            {ZONE.name}
          </Text>
          <Text c="dimmed" fz={VX.text.sm}>
            {ZONE.lift} · INOL {ZONE.inol.toFixed(2)} this week
          </Text>
        </Group>
      </Section>
    </Box>
  )
}
