/**
 * S7 — Body and strength (stands for argo body-composition and strength-tracker). Wave 43 builds it
 * from argo `docs/design/UPSTREAM.md` § Wave 50–53: each section is one file under `body/`, owned by
 * the worker that fixes its row, so the rows land in parallel without touching each other.
 *
 *   Question: Am I trending toward my weight goal, and is my training load productive?
 *   Decision: Hold the plan, or change the load.
 *
 * Anchors for `basalt-ui shot`: every scored component carries `data-shot`.
 */
import { Stack } from '@mantine/core'
import { PageBar } from 'basalt-ui'
import { BodyE1rmCard } from './body/e1rm-card'
import { BodyMeterStart } from './body/meter-start'
import { BodySkinfoldTable } from './body/skinfold-table'
import { BodyStrengthSparks } from './body/strength-sparks'
import { BodyWeightChart } from './body/weight-chart'
import { BodyWeightStrip } from './body/weight-strip'
import { BodyZoneReadout } from './body/zone-readout'
import type { ScenarioProps } from './shot-state'

export function BodyScenario({ shotState }: ScenarioProps) {
  return (
    <Stack gap="sm" data-shot-states="empty loading error">
      <PageBar />
      <BodyWeightStrip shotState={shotState} />
      <BodyMeterStart shotState={shotState} />
      <BodyWeightChart shotState={shotState} />
      <BodyE1rmCard shotState={shotState} />
      <BodyStrengthSparks shotState={shotState} />
      <BodyZoneReadout shotState={shotState} />
      <BodySkinfoldTable shotState={shotState} />
    </Stack>
  )
}
