/**
 * Calibration seed — expected failing item: Craft 4 (no accent on chrome; the active tab underline
 * takes ink, SPEC § 6.12). Defect: the active underline is pinned to the accent colour. Pinned
 * explicitly so the seed stays defective after the theme closes the leak. Tab labels and panel copy
 * are clean.
 */
import { Box, Tabs, Text } from '@mantine/core'
import { Section } from 'basalt-ui'
import { VX } from 'basalt-ui/tokens'

export function CalibrateAccentTab() {
  return (
    <Box data-shot="calibrate-accent-tab">
      <Section title="Spend, 1–16 Oct (€)">
        <Tabs defaultValue="project" color={VX.accent}>
          <Tabs.List>
            <Tabs.Tab value="project">By project</Tabs.Tab>
            <Tabs.Tab value="model">By model</Tabs.Tab>
            <Tabs.Tab value="day">By day</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="project" pt="sm">
            <Text size="sm">
              Search leads at €412; the other five projects spent €828 together.
            </Text>
          </Tabs.Panel>
          <Tabs.Panel value="model" pt="sm">
            <Text size="sm">The large model is 46 % of spend; the small model 18 %.</Text>
          </Tabs.Panel>
          <Tabs.Panel value="day" pt="sm">
            <Text size="sm">The busiest day was 14 Oct at €96; the quietest 11 Oct at €31.</Text>
          </Tabs.Panel>
        </Tabs>
      </Section>
    </Box>
  )
}
