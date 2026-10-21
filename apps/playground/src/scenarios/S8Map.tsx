/**
 * S8 — Map (stands for argo astro's Map tab). Wave 43 builds it from argo `docs/design/UPSTREAM.md`
 * § Wave 51–52: a geographic raster on a map canvas with a key rail, a floating panel over a flush
 * card, the map's attribution control, and a page that fills the scrollport. Filled by the
 * `w43-map` worker.
 *
 *   Question: Where is the sky clear tonight?
 *   Decision: Drive out to observe, or stay home.
 */
import { Stack } from '@mantine/core'
import { PageBar } from 'basalt-ui'
import type { ScenarioProps } from './shot-state'

export function MapScenario(_props: ScenarioProps) {
  return (
    <Stack gap="sm">
      <PageBar />
    </Stack>
  )
}
