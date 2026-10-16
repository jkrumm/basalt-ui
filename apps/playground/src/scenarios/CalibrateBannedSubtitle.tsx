/**
 * Calibration seed — expected failing item: Communication 1 (banned filler, SPEC § 8.4). Defect: the
 * subtitle narrates the UI ("Here you can see … at a glance"). Title, value, unit and period are
 * clean.
 */
import { Box } from '@mantine/core'
import { StatCard } from 'basalt-ui'
import { MTD_EUR, WINDOW_LABEL, fmtEur } from './spend-data'

export function CalibrateBannedSubtitle() {
  return (
    <Box data-shot="calibrate-banned-subtitle">
      <StatCard
        title={`Spend, ${WINDOW_LABEL}`}
        value={fmtEur(MTD_EUR)}
        subtitle="Here you can see your spend at a glance"
        info="All projects and models, in EUR."
      />
    </Box>
  )
}
