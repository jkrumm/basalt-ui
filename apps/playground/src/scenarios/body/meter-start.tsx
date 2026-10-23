/** The body Weight cell: a no-goal low–high Meter read at the track start (argo UPSTREAM Wave 53). */
import { Box } from '@mantine/core'
import { Meter, StatGroup } from 'basalt-ui'
import type { StatStripCell } from 'basalt-ui'
import { VX } from 'basalt-ui/tokens'
import { noop } from '../shot-state'
import type { ScenarioProps } from '../shot-state'
import { BODY, NO_WEIGH_INS, WEIGHT_ERROR, WEIGHT_HIGH_KG, WEIGHT_LOW_KG } from './body-data'

const LOW = WEIGHT_LOW_KG
const HIGH = WEIGHT_HIGH_KG
const kg = (v: number): string => `${v.toFixed(1)} kg`
const FLAT = [
  { at: LOW, color: VX.line },
  { at: HIGH, color: VX.line },
]

const weightMeter = (
  <Meter
    label="Current weight within the lowest and highest weigh-in of the last 60 days"
    value={BODY.weightKg}
    min={LOW}
    max={HIGH}
    format={kg}
    readingAt="start"
    stops={FLAT}
    startCaption={`60-day low ${kg(LOW)}`}
    endCaption={`60-day high ${kg(HIGH)}`}
    tone="muted"
  />
)

export function BodyMeterStart(props: ScenarioProps) {
  const state: StatStripCell['state'] =
    props.shotState === 'empty'
      ? { kind: 'empty', reason: NO_WEIGH_INS }
      : props.shotState === 'error'
        ? { kind: 'error', error: new Error(WEIGHT_ERROR), onRetry: noop }
        : undefined
  return (
    <Box data-shot="weight-meter-start">
      <StatGroup
        variant="strip"
        label="Body"
        cols={2}
        cells={[
          {
            key: 'weight',
            caption: 'Weight spread',
            qualifier: '60-day range',
            info: 'The distance between the lowest and the highest weigh-in of the last 60 days; the track marks the latest weigh-in on it. The reading itself is in the strip above.',
            value: kg(HIGH - LOW),
            visual: weightMeter,
            loading: props.shotState === 'loading',
            ...(state !== undefined && { state }),
          },
        ]}
      />
    </Box>
  )
}
