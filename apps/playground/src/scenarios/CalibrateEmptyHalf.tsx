/**
 * Calibration seed — expected failing item: Craft 3 (no empty region of 40 % or more of the height).
 * Defect: a metric card forced to 320px tall with no sparkline or breakdown, so its lower half is
 * empty. Title, unit, period and tooltip are clean.
 */
import { Box } from '@mantine/core'
import { StatCard } from 'basalt-ui'
import { MTD_EUR, WINDOW_LABEL } from './spend-data'
import { fmtEur } from './fixture-utils'

export function CalibrateEmptyHalf() {
  return (
    <Box data-shot="probe-6" h={320}>
      <StatCard
        title={`Spend, ${WINDOW_LABEL}`}
        value={fmtEur(MTD_EUR)}
        info="All projects and models, in EUR."
        style={{ height: '100%' }}
      />
    </Box>
  )
}
