/**
 * Calibration seed — expected failing item: Craft 3 (no empty region of 40 % or more of the height).
 * Defect: a metric card forced to 320px tall with no sparkline or breakdown, so its lower half is
 * empty. Title, unit, period and tooltip are clean.
 */
import { Box } from '@mantine/core'
import { StatCard } from 'basalt-ui'

export function CalibrateEmptyHalf() {
  return (
    <Box data-shot="calibrate-empty-half" h={320}>
      <StatCard
        title="Spend, 1–16 Oct"
        value="€1,240"
        info="All projects and models, in EUR."
        style={{ height: '100%' }}
      />
    </Box>
  )
}
