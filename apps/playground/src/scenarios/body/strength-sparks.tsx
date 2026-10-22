/** Per-lift INOL sparklines with a productive band and a PR reference (argo UPSTREAM Wave 50). */
import { Box, Group, Stack, Text } from '@mantine/core'
import { StatGroup } from 'basalt-ui'
import type { StatStripCell } from 'basalt-ui'
import { ChartCard, Sparkline } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'
import { cardStateProps, noop } from '../shot-state'
import type { ScenarioProps } from '../shot-state'
import { STRENGTH_ERROR } from './body-data'

/** INOL per session; the productive range is 0.6–1.0. */
const INOL_BAND = { from: 0.6, to: 1 } as const

const INOL_LIFTS = [
  {
    id: 'squat',
    name: 'Squat',
    note: 'in range',
    data: [0.62, 0.7, 0.78, 0.74, 0.85, 0.9, 0.82, 0.88],
  },
  {
    id: 'bench',
    name: 'Bench press',
    note: 'above',
    data: [0.9, 1.05, 1.2, 1.15, 1.3, 1.4, 1.25, 1.35],
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    note: 'below',
    data: [0.35, 0.4, 0.3, 0.45, 0.38, 0.42, 0.33, 0.4],
  },
] as const

/** e1RM history per lift; the PR is the best of it, and the first line starts on it. */
const LIFTS: readonly { id: string; name: string; data: readonly number[] }[] = [
  { id: 'squat', name: 'Squat', data: [142.5, 140, 136, 138, 134, 131, 133, 129, 127, 130] },
  { id: 'press', name: 'Overhead press', data: [58, 60, 59, 62, 64, 63, 66, 67, 69, 71] },
]

const fmtInol = (v: number): string => v.toFixed(2)
const fmtKg = (v: number): string => `${v.toFixed(1)} kg`

const INOL_EMPTY = 'No sessions logged in this window. INOL needs at least two sessions per lift.'

function InolSparks({ shotState }: ScenarioProps) {
  return (
    <Box data-shot="inol-sparks">
      <ChartCard
        title="INOL per lift"
        info="Intensity-weighted volume per session. The band marks the productive range, 0.6 to 1.0."
        {...cardStateProps(shotState, STRENGTH_ERROR, 'content', INOL_EMPTY)}
      >
        <Stack gap="xs">
          {INOL_LIFTS.map((lift) => (
            <Group key={lift.id} gap="md" wrap="nowrap" justify="space-between">
              <Text size="sm">{lift.name}</Text>
              <Group gap="xs" wrap="nowrap">
                <Sparkline
                  ariaLabel={`${lift.name} INOL, ${lift.note} the productive range`}
                  data={lift.data}
                  width={120}
                  height={28}
                  color={VX.line}
                  band={INOL_BAND}
                  format={fmtInol}
                />
                <Text size="sm" w={40} ta="right">
                  {fmtInol(lift.data.at(-1) ?? 0)}
                </Text>
              </Group>
            </Group>
          ))}
        </Stack>
      </ChartCard>
    </Box>
  )
}

function LiftPrStrip({ shotState }: ScenarioProps) {
  const state: StatStripCell['state'] =
    shotState === 'empty'
      ? { kind: 'empty', reason: INOL_EMPTY }
      : shotState === 'error'
        ? { kind: 'error', error: new Error(STRENGTH_ERROR), onRetry: noop }
        : undefined
  const cells: StatStripCell[] = LIFTS.map((lift) => {
    const pr = Math.max(...lift.data)
    return {
      key: lift.id,
      caption: lift.name,
      value: fmtKg(lift.data.at(-1) ?? 0).replace(' kg', ''),
      unit: 'kg e1RM',
      visual: (
        <Sparkline
          ariaLabel={`${lift.name} e1RM, last ${lift.data.length} sessions`}
          data={lift.data}
          height={28}
          color={VX.line}
          format={fmtKg}
          reference={pr}
          referenceLabel="PR"
        />
      ),
      footer: `PR ${fmtKg(pr)}`,
      loading: shotState === 'loading',
      ...(state !== undefined && { state }),
    }
  })
  return (
    <Box data-shot="lift-pr-spark">
      <StatGroup variant="strip" label="Lifts against their PR" cols={2} cells={cells} />
    </Box>
  )
}

export function BodyStrengthSparks(props: ScenarioProps) {
  return (
    <Stack gap="sm">
      <InolSparks {...props} />
      <LiftPrStrip {...props} />
    </Stack>
  )
}
