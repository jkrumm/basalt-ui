/**
 * Calibration — known-good board (SPEC § 8.5). Expected: every rubric item PASSES.
 * A single metric card: a sparkline, a unit line stating the basis and the period in its title.
 * No `delta` (today's `DeltaBadge` carries a fill), no `info`/`subtitle` (on a short card it folds
 * into the info glyph), no table (today's basalt has no clean part-of-whole primitive); history in
 * docs/waves/design-parity/w31/calibration.md. No hover/tooltip target and nothing focusable, so
 * those states are `not-declared`.
 */
import { Box } from '@mantine/core'
import { StatCard } from 'basalt-ui'
import { Sparkline } from 'basalt-ui/charts'
import { MTD_EUR, MTD_TOTALS, WINDOW_LABEL, fmtEur } from './spend-data'

export function CalibrateGood() {
  return (
    <Box data-shot="probe-3">
      <StatCard
        title={`Spend, ${WINDOW_LABEL}`}
        value={fmtEur(MTD_EUR)}
        unit="EUR, all projects and models"
        sparkline={(size) => (
          <Sparkline ariaLabel={`Daily spend, ${WINDOW_LABEL}, EUR`} data={MTD_TOTALS} {...size} />
        )}
      />
    </Box>
  )
}
