import type { ReactElement } from 'react'
import { Group, Stack, Text } from '@mantine/core'
import { ChartCard, Sparkline } from '../../../src/charts'
import { StatGroup } from '../../../src/index'

/** A lift's e1RM history that opens at its best: the line starts on the `PR` reference. */
const FROM_PR = [92, 90, 86, 88, 84, 80, 78, 76, 72, 70, 71, 69]
/** The same shape rising to its best: the line ends on the reference. */
const TO_PR = [60, 62, 61, 66, 70, 72, 75, 80, 84, 88, 90, 92]

/** argo's e1RM histories (invented values, the same shape): the first line starts on its PR. */
const SQUAT = [142.5, 140, 136, 138, 134, 131, 133, 129, 127, 130]
const PRESS = [58, 60, 59, 62, 64, 63, 66, 67, 69, 71]
const INOL_BAND = { from: 0.6, to: 1 } as const
const INOL = {
  squat: [0.62, 0.7, 0.78, 0.74, 0.85, 0.9, 0.82, 0.88],
  bench: [0.9, 1.05, 1.2, 1.15, 1.3, 1.4, 1.25, 1.35],
  deadlift: [0.35, 0.4, 0.3, 0.45, 0.38, 0.42, 0.33, 0.4],
}

/** Wave 43: argo's lift strip, a `PR` reference over a line that starts (or ends) on it. */
export function W43SparkFixture(): ReactElement {
  return (
    <>
      <div data-testid="w43-spark" style={{ width: 358 }}>
        <StatGroup
          variant="strip"
          label="Lifts"
          cols={2}
          cells={[
            {
              key: 'start',
              caption: 'Squat',
              value: '92',
              unit: 'kg',
              visual: (
                <Sparkline
                  ariaLabel="Squat e1RM"
                  data={FROM_PR}
                  height={28}
                  reference={92}
                  referenceLabel="PR"
                />
              ),
            },
            {
              key: 'end',
              caption: 'Press',
              value: '92',
              unit: 'kg',
              visual: (
                <Sparkline
                  ariaLabel="Press e1RM"
                  data={TO_PR}
                  height={28}
                  reference={92}
                  referenceLabel="PR"
                />
              ),
            },
          ]}
        />
      </div>
      <div data-testid="w43-spark-wide">
        <StatGroup
          variant="strip"
          label="Lifts against their PR"
          cols={2}
          cells={[
            {
              key: 'squat',
              caption: 'Squat',
              value: '130.0',
              unit: 'kg e1RM',
              visual: (
                <Sparkline
                  ariaLabel="Squat e1RM"
                  data={SQUAT}
                  height={28}
                  reference={142.5}
                  referenceLabel="PR"
                />
              ),
            },
            {
              key: 'press',
              caption: 'Overhead press',
              value: '71.0',
              unit: 'kg e1RM',
              visual: (
                <Sparkline
                  ariaLabel="Press e1RM"
                  data={PRESS}
                  height={28}
                  reference={71}
                  referenceLabel="PR"
                />
              ),
            },
          ]}
        />
      </div>
      <div data-testid="w43-inol" style={{ width: 1100 }}>
        <ChartCard title="INOL per lift">
          <Stack gap="xs">
            {Object.entries(INOL).map(([name, data]) => (
              <Group key={name} data-lift={name} gap="md" wrap="nowrap" justify="space-between">
                <Text size="sm">{name}</Text>
                <Group gap="xs" wrap="nowrap">
                  <Sparkline
                    ariaLabel={`${name} INOL`}
                    data={data}
                    width={120}
                    height={28}
                    band={INOL_BAND}
                  />
                  <Text size="sm" w={40} ta="right">
                    {data.at(-1)}
                  </Text>
                </Group>
              </Group>
            ))}
          </Stack>
        </ChartCard>
      </div>
    </>
  )
}
