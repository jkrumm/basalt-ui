/**
 * Calibration — known-good board (SPEC § 8.5). Expected: every rubric item PASSES.
 * A single metric card: a sparkline, a unit line stating the basis and the period in its title. As
 * clean as today's basalt allows; there is deliberately no `delta`, because today's `DeltaBadge`
 * still carries a fill and would seed a defect this board must not have.
 *
 * It is ONE component on purpose. Today's basalt has no clean part-of-whole or ranked primitive: a
 * parts table fails Expression 4 or 1 (a whole as a table, a time series as a table), so a richer
 * known-good board waits for Wave 33/34. No `info`/`subtitle` either: a subtitle folds into
 * WidgetHeader's info glyph on a short card, whose focus ring/tooltip crowd the title at 390 (a
 * basalt finding, see calibration.md). The board has NO hover/tooltip target and nothing focusable
 * by design, so those states are `not-declared`, never failures.
 *
 * Route id: `probe-3` (neutral on purpose; the id → seed map lives in docs only).
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
