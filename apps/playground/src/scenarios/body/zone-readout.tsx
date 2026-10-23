/**
 * A zone readout that names the zone in text (argo UPSTREAM strength review). The word is
 * `VX.status.good` text (solved to AA); the fill-only `VX.status.excellent` colours the swatch.
 * `basalt/status-fill-as-text` steers to this split.
 */
import { Box, Group, Skeleton, Stack, Text } from '@mantine/core'
import { Meter, Section } from 'basalt-ui'
import { VX } from 'basalt-ui/tokens'
import { queryFor } from '../shot-state'
import type { ScenarioProps } from '../shot-state'
import { INOL_DEFINITION, INOL_GAP, INOL_NEXT, STRENGTH_ERROR } from './body-data'

/** The INOL scale the readout sits on: the productive range is 0.6 to 1.0 (INOL_DEFINITION). */
const ZONES = [
  { from: 0, to: 0.6, label: 'Below' },
  { from: 0.6, to: 1, label: 'Productive' },
  { from: 1, to: 1.4, label: 'Above' },
] as const

const ZONE = { name: 'Productive', inol: 0.84, lift: 'Squat' } as const

export function BodyZoneReadout({ shotState }: ScenarioProps) {
  const query = queryFor(shotState === 'loading' ? undefined : shotState, STRENGTH_ERROR)
  return (
    <Box data-shot="zone-readout">
      <Section
        title="INOL zone, this week"
        info={INOL_DEFINITION}
        empty={{
          title: INOL_GAP,
          description: INOL_NEXT,
        }}
        {...(query !== undefined && { query })}
      >
        {shotState === 'loading' ? (
          <Skeleton h={22} maw={320} />
        ) : (
          <Stack gap="xs">
            <Group gap="xs" wrap="nowrap" align="center">
              <Box aria-hidden w={10} h={10} bg={VX.status.excellent} bdrs="50%" flex="none" />
              <Text fw={600} c={VX.status.good}>
                {ZONE.name}
              </Text>
              <Text c="dimmed" fz={VX.text.sm}>
                {ZONE.lift} · INOL {ZONE.inol.toFixed(2)}
              </Text>
            </Group>
            <Meter
              label={`${ZONE.lift} INOL this week on the below, productive and above scale`}
              value={ZONE.inol}
              min={0}
              max={1.4}
              reading={false}
              zones={ZONES}
              format={(v) => v.toFixed(2)}
            />
          </Stack>
        )}
      </Section>
    </Box>
  )
}
