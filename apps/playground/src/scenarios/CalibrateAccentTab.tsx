/**
 * Calibration seed — expected failing item: Craft 4 (no accent on chrome; the active tab underline
 * takes ink, SPEC § 6.12). Defect: the active underline is pinned to the accent colour. Pinned
 * explicitly so the seed stays defective after the theme closes the leak. Tab labels and panel copy
 * are clean.
 *
 * Route id: `probe-4` (neutral on purpose; the id → seed map lives in docs only).
 */
import { Box, Tabs, Text } from '@mantine/core'
import { Section } from 'basalt-ui'
import { VX } from 'basalt-ui/tokens'
import {
  MODELS_MTD,
  MTD_DAYS,
  PROJECTS_MTD,
  WINDOW_LABEL,
  fmtDay,
  fmtEur,
  fmtShare,
} from './spend-data'

const [topProject, ...otherProjects] = PROJECTS_MTD
const [topModel] = MODELS_MTD
const bottomModel = MODELS_MTD.at(-1)
const busiest = MTD_DAYS.toSorted((a, b) => b.total - a.total)[0]
const quietest = MTD_DAYS.toSorted((a, b) => a.total - b.total)[0]
const othersEur = otherProjects.reduce((sum, p) => sum + p.spend, 0)

export function CalibrateAccentTab() {
  return (
    <Box data-shot="probe-4">
      <Section title={`Spend, ${WINDOW_LABEL} (€)`}>
        <Tabs defaultValue="project" color={VX.accent}>
          <Tabs.List>
            <Tabs.Tab value="project">By project</Tabs.Tab>
            <Tabs.Tab value="model">By model</Tabs.Tab>
            <Tabs.Tab value="day">By day</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="project" pt="sm">
            <Text size="sm">
              {topProject?.label} leads at {fmtEur(topProject?.spend ?? 0)}; the other{' '}
              {otherProjects.length} projects spent {fmtEur(othersEur)} together.
            </Text>
          </Tabs.Panel>
          <Tabs.Panel value="model" pt="sm">
            <Text size="sm">
              {topModel?.label} is {fmtShare(topModel?.share ?? 0)} of spend; {bottomModel?.label}{' '}
              {fmtShare(bottomModel?.share ?? 0)}.
            </Text>
          </Tabs.Panel>
          <Tabs.Panel value="day" pt="sm">
            <Text size="sm">
              The busiest day was {busiest && fmtDay(busiest.date)} at {fmtEur(busiest?.total ?? 0)}
              ; the quietest {quietest && fmtDay(quietest.date)} at {fmtEur(quietest?.total ?? 0)}.
            </Text>
          </Tabs.Panel>
        </Tabs>
      </Section>
    </Box>
  )
}
