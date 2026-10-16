/**
 * Calibration — known-good board (SPEC § 8.5). Expected: every rubric item PASSES.
 * A metric card with a sparkline, a unit, a stated period and a one-line definition, beside a compact
 * table of its parts, both on the one month-to-date window. As clean as today's basalt allows; there
 * is deliberately no `delta`, because today's `DeltaBadge` still carries a fill and would seed a
 * defect this board must not have.
 *
 * Table sorting is ON so the headers are focusable: the focus shot needs something Tab can reach.
 * The board has NO hover/tooltip target by design (the definition is a one-line subtitle, not a
 * tooltip), so those states are `not-declared`, never failures.
 */
import { Box, Stack } from '@mantine/core'
import { Section, StatCard } from 'basalt-ui'
import { Sparkline } from 'basalt-ui/charts'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
import {
  MONTH_LABEL,
  MTD_EUR,
  MTD_TOTALS,
  PROJECTS_MTD,
  WINDOW_LABEL,
  fmtEur,
  fmtShare,
} from './spend-data'
import type { ProjectRow } from './spend-data'

const col = createColumnHelper<ProjectRow>()
const columns = [
  col.accessor('label', { header: 'Project' }),
  col.accessor('spend', {
    header: `Spend, ${WINDOW_LABEL} (€)`,
    cell: (c) => fmtEur(c.getValue()),
    meta: { align: 'right', numeral: true },
  }),
  col.accessor('share', {
    header: 'Share',
    cell: (c) => fmtShare(c.getValue()),
    meta: { align: 'right', numeral: true },
  }),
]

const TOP_THREE = PROJECTS_MTD.slice(0, 3)

export function CalibrateGood() {
  return (
    <Stack gap="sm">
      <Box data-shot="calibrate-good-card">
        <StatCard
          title={`Spend, ${WINDOW_LABEL}`}
          value={fmtEur(MTD_EUR)}
          subtitle={`Sum of daily EUR spend across all projects and models, ${WINDOW_LABEL}, ${MONTH_LABEL}.`}
          sparkline={(size) => (
            <Sparkline
              ariaLabel={`Daily spend, ${WINDOW_LABEL}, EUR`}
              data={MTD_TOTALS}
              {...size}
            />
          )}
        />
      </Box>
      <Box data-shot="calibrate-good-table">
        <Section title={`Top 3 projects by spend, ${WINDOW_LABEL}`}>
          <BasaltDataTable data={TOP_THREE} columns={columns} />
        </Section>
      </Box>
    </Stack>
  )
}
