/**
 * Calibration — known-good board (SPEC § 8.5). Expected: every rubric item PASSES.
 * A metric card with a sparkline, a unit line stating the basis, and the period in its title, beside
 * a compact table of its parts that sums to the whole (an "Other projects" row), both on the one
 * month-to-date window. As clean as today's basalt allows; there
 * is deliberately no `delta`, because today's `DeltaBadge` still carries a fill and would seed a
 * defect this board must not have.
 *
 * Table sorting is ON so the headers are focusable: the focus shot needs something Tab can reach.
 * The board has NO hover/tooltip target by design, and no `info`/`subtitle` on the card (a subtitle
 * folds into WidgetHeader's info glyph on a short card, whose focus ring/tooltip crowd the title at
 * 390 — a basalt finding, see calibration.md), so those states are `not-declared`, never failures.
 *
 * Route id: `probe-3` (neutral on purpose; the id → seed map lives in docs only).
 */
import { Box, Stack } from '@mantine/core'
import { Section, StatCard } from 'basalt-ui'
import { Sparkline } from 'basalt-ui/charts'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
import { MTD_EUR, MTD_TOTALS, PROJECTS_MTD, WINDOW_LABEL, fmtEur, fmtShare } from './spend-data'

type Part = { label: string; spend: number; share: number }

const col = createColumnHelper<Part>()
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
const OTHER_SPEND = PROJECTS_MTD.slice(3).reduce((sum, p) => sum + p.spend, 0)
const ROWS: Part[] = [
  ...TOP_THREE,
  { label: 'Other projects', spend: OTHER_SPEND, share: OTHER_SPEND / MTD_EUR },
]

export function CalibrateGood() {
  return (
    <Stack gap="sm">
      <Box data-shot="probe-3-card">
        <StatCard
          title={`Spend, ${WINDOW_LABEL}`}
          value={fmtEur(MTD_EUR)}
          unit="EUR, all projects and models"
          sparkline={(size) => (
            <Sparkline
              ariaLabel={`Daily spend, ${WINDOW_LABEL}, EUR`}
              data={MTD_TOTALS}
              {...size}
            />
          )}
        />
      </Box>
      <Box data-shot="probe-3-table">
        <Section title={`Spend by project, share of all spend, ${WINDOW_LABEL}`}>
          <BasaltDataTable data={ROWS} columns={columns} />
        </Section>
      </Box>
    </Stack>
  )
}
