/**
 * Calibration seed — expected failing item: Communication 1 (banned filler, SPEC § 8.4). Defect: the
 * subtitle narrates the UI ("Here you can see … at a glance"). Title, value, unit and period are
 * clean.
 */
import { Box } from '@mantine/core'
import { StatCard } from 'basalt-ui'

export function CalibrateBannedSubtitle() {
  return (
    <Box data-shot="calibrate-banned-subtitle">
      <StatCard
        title="Spend, 1–16 Oct"
        value="€1,240"
        subtitle="Here you can see your spend at a glance"
        info="All projects and models, in EUR."
      />
    </Box>
  )
}
