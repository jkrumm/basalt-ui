/**
 * Calibration — known-good board (SPEC § 8.5). Expected: every rubric item PASSES.
 * A metric card with a sparkline, a unit line stating the basis, and the period in its title, beside
 * a compact table of recent days (many rows, several attributes: the catalogue's table row), both
 * inside the month-to-date window. As clean as today's basalt allows; there is deliberately no `delta`, because today's `DeltaBadge` still carries a fill and would seed a
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
import {
  MODEL_KEYS,
  MODEL_LABEL,
  MTD_DAYS,
  MTD_EUR,
  MTD_TOTALS,
  WINDOW_LABEL,
  fmtDay,
  fmtEur,
} from './spend-data'
import type { DayRow } from './spend-data'

const col = createColumnHelper<DayRow>()
const eurCell = { align: 'right', numeral: true } as const
const columns = [
  col.accessor('date', { header: 'Day', cell: (c) => fmtDay(c.getValue()) }),
  ...MODEL_KEYS.map((key) =>
    col.accessor(key, {
      header: MODEL_LABEL[key],
      cell: (c) => fmtEur(c.getValue()),
      meta: eurCell,
    }),
  ),
  col.accessor('total', {
    header: 'Total',
    cell: (c) => fmtEur(c.getValue()),
    meta: eurCell,
  }),
]

const RECENT_DAYS = MTD_DAYS.slice(-5).toReversed()

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
        <Section title="Daily spend by model, last 5 days (€)">
          <BasaltDataTable data={RECENT_DAYS} columns={columns} />
        </Section>
      </Box>
    </Stack>
  )
}
