/**
 * Calibration — known-good board (SPEC § 8.5). Expected: every rubric item PASSES.
 * A metric card with a sparkline, a unit, a stated period and an explanatory tooltip, beside a compact
 * table of its parts. As clean as today's basalt allows; there is deliberately no `delta`, because
 * today's `DeltaBadge` still carries a fill and would seed a defect this board must not have.
 */
import { Box, Stack } from '@mantine/core'
import { Section, StatCard } from 'basalt-ui'
import { Sparkline } from 'basalt-ui/charts'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
import { LAST_30_TOTALS, PROJECTS_MTD, fmtEur, fmtShare } from './spend-data'
import type { ProjectRow } from './spend-data'

const col = createColumnHelper<ProjectRow>()
const columns = [
  col.accessor('label', { header: 'Project' }),
  col.accessor('spend', {
    header: 'Spend, 1–16 Oct (€)',
    cell: (c) => fmtEur(c.getValue()),
    meta: { align: 'right', numeral: true },
  }),
  col.accessor('share', {
    header: 'Share',
    cell: (c) => fmtShare(c.getValue()),
    meta: { align: 'right', numeral: true },
  }),
]

export function CalibrateGood() {
  return (
    <Stack gap="sm">
      <Box data-shot="calibrate-good-card">
        <StatCard
          title="Spend, last 30 days"
          value={fmtEur(LAST_30_TOTALS.reduce((a, b) => a + b, 0))}
          info="Sum of daily EUR spend across all projects and models, 17 Sep – 16 Oct 2026."
          sparkline={(size) => (
            <Box data-shot-hover data-shot-tooltip>
              <Sparkline
                ariaLabel="Daily spend, last 30 days, EUR"
                data={LAST_30_TOTALS}
                {...size}
              />
            </Box>
          )}
        />
      </Box>
      <Box data-shot="calibrate-good-table">
        <Section title="Spend by project, 1–16 Oct">
          <BasaltDataTable
            data={PROJECTS_MTD.slice(0, 3)}
            columns={columns}
            enableSorting={false}
          />
        </Section>
      </Box>
    </Stack>
  )
}
