/** The body Weight cell: a no-goal low–high Meter read at the track start (argo UPSTREAM Wave 53). */
import { Box, Stack } from '@mantine/core'
import { Meter, StatGroup } from 'basalt-ui'
import type { StatStripCell } from 'basalt-ui'
import { VX } from 'basalt-ui/tokens'
import { noop, retryCopy } from '../shot-state'
import type { ScenarioProps } from '../shot-state'

const LOW = 72.3
const HIGH = 78.9
const kg = (v: number): string => `${v.toFixed(1)} kg`
const FLAT = [
  { at: LOW, color: VX.line },
  { at: HIGH, color: VX.line },
]

const weightMeter = (value: number, readingAt: 'start' | 'fill') => (
  <Meter
    label="Current weight within the window's lowest and highest weigh-in"
    value={value}
    min={LOW}
    max={HIGH}
    format={kg}
    readingAt={readingAt}
    stops={FLAT}
    startCaption={`low ${kg(LOW)}`}
    endCaption={`high ${kg(HIGH)}`}
    tone="muted"
  />
)

const strip = (anchor: string, visual: StatStripCell['visual'], props: ScenarioProps) => {
  const state: StatStripCell['state'] =
    props.shotState === 'empty'
      ? { kind: 'empty', reason: 'No weigh-ins in this window' }
      : props.shotState === 'error'
        ? { kind: 'error', error: new Error(retryCopy('weight source')), onRetry: noop }
        : undefined
  return (
    <Box data-shot={anchor}>
      <StatGroup
        variant="strip"
        label="Body"
        cols={3}
        cells={[
          {
            key: 'weight',
            caption: 'Weight',
            value: '72.3',
            unit: 'kg',
            visual,
            loading: props.shotState === 'loading',
            ...(state !== undefined && { state }),
          },
          { key: 'fat', caption: 'Body fat', value: '18.4', unit: '%' },
          { key: 'lean', caption: 'Lean mass', value: '59.0', unit: 'kg' },
        ]}
      />
    </Box>
  )
}

export function BodyMeterStart(props: ScenarioProps) {
  return (
    <Stack gap="md">
      {strip('weight-meter-start', weightMeter(LOW, 'start'), props)}
      {strip('weight-meter-fill-short', weightMeter(LOW + 0.2, 'fill'), props)}
    </Stack>
  )
}
