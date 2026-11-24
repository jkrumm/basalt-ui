import { CircleCheck, CircleDashed, SearchCheck, TriangleAlert } from 'lucide-react'
import { DataPanel, StatCell, StatGroup } from 'basalt-ui/cards'
import type { Delta, Phase } from 'basalt-ui/cards'
import { useChartFocus } from 'basalt-ui/charts'
import { useFormat } from 'basalt-ui'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import type { ScenarioProps } from '../../shot-state'
import { checksFor } from './fixture'
import type { Cadence, Check, CheckStatus, CostClass } from './fixture'

const STATUS_OPTIONS = [
  'found',
  'failed',
  'skipped',
  'never',
  'clean',
] as const satisfies readonly CheckStatus[]
const STATUS_LABEL: Record<CheckStatus, string> = {
  found: 'Found work',
  failed: 'Failed',
  skipped: 'Skipped',
  never: 'Never run',
  clean: 'Clean',
}
const STATUS_TONE: Record<CheckStatus, 'accent' | 'bad' | 'neutral'> = {
  found: 'accent',
  failed: 'bad',
  skipped: 'neutral',
  never: 'neutral',
  clean: 'neutral',
}
const COST_LABEL: Record<CostClass, string> = {
  file: 'File',
  tool: 'Tool',
  make: 'Make',
  agent: 'Agent',
}
const CADENCE_LABEL: Record<Cadence, string> = { daily: 'Daily', weekly: 'Weekly' }

const c = col<Check>()
const COLUMNS = [
  c.entity('id', { header: 'Check', mono: true, priority: 1, width: 'content' }),
  c.status('status', {
    header: 'Result',
    options: STATUS_OPTIONS,
    labels: STATUS_LABEL,
    tone: (value) => STATUS_TONE[value],
    priority: 1,
    card: 'value',
  }),
  c.text('detail', { header: 'Detail', priority: 2, card: 'subtitle' }),
  c.meter('findings', { header: 'Findings', max: 12, priority: 2, card: 'meta' }),
  c.meter('ageDays', { header: 'Days since last run', max: 90, priority: 2, card: 'detail' }),
  c.text('cost', { header: 'Cost class', labels: COST_LABEL, priority: 3, card: 'detail' }),
  c.text('cadence', { header: 'Cadence', labels: CADENCE_LABEL, priority: 3, card: 'detail' }),
]

const count = (rows: readonly Check[], ...statuses: CheckStatus[]): number =>
  rows.filter((r) => statuses.includes(r.status)).length

const announce = (row: Check): string =>
  `${row.id}: ${STATUS_LABEL[row.status]}${
    row.findings === null ? '' : `, ${row.findings} to fix`
  }${row.ageDays === null ? ', never run' : `, last run ${row.ageDays} d ago`}`

export function ExprN86Scenario({ shotState, fixture }: ScenarioProps) {
  const { percent } = useFormat()
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? {
            tag: 'error',
            message: 'The results did not load: the store did not answer.',
            retry: () => undefined,
          }
        : 'ready'
  // The strip owns the message and the retry; the table keeps its own frame without repeating them.
  const tablePhase: Phase = typeof phase === 'object' ? { tag: 'error' } : phase
  const rows = shotState === 'empty' ? [] : checksFor(fixture)
  const settled = phase === 'ready'
  const ready = settled && rows.length > 0
  const focus = useChartFocus(rows, { announce })
  const table = useDataTable({
    id: 'n86-checks',
    label: 'Sweep results',
    columns: COLUMNS,
    data: ready ? rows : undefined,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    phase: tablePhase,
    bodyRows: 17,
    phone: 'columns',
  })

  const share = (n: number): Delta => ({
    value: settled ? percent(rows.length === 0 ? 0 : n / rows.length) : '',
    polarity: 'neutral',
    label: 'of all',
  })
  const findings = rows.reduce((sum, r) => sum + (r.findings ?? 0), 0)
  const failed = count(rows, 'failed')

  return (
    <Page area="expr-n86">
      <PageBar title="Hygiene checks" />
      <StatGroup variant="cards" label="Result counts">
        <StatCell
          icon={CircleCheck}
          title="Clean"
          value={settled ? count(rows, 'clean') : null}
          delta={share(count(rows, 'clean'))}
          phase={phase}
        />
        <StatCell
          icon={SearchCheck}
          title="Found work"
          value={settled ? count(rows, 'found') : null}
          delta={share(count(rows, 'found'))}
          status={
            ready && findings > 0 ? { tone: 'accent', label: `${findings} findings` } : undefined
          }
          phase={phase}
        />
        <StatCell
          icon={TriangleAlert}
          title="Skipped or failed"
          value={settled ? count(rows, 'skipped', 'failed') : null}
          delta={share(count(rows, 'skipped', 'failed'))}
          status={ready && failed > 0 ? { tone: 'bad', label: `${failed} failed` } : undefined}
          phase={phase}
        />
        <StatCell
          icon={CircleDashed}
          title="Never run"
          value={settled ? count(rows, 'never') : null}
          delta={share(count(rows, 'never'))}
          phase={phase}
        />
      </StatGroup>
      <DataPanel
        title="Latest results"
        subtitle="Work first, then clean"
        phase={tablePhase}
        empty={
          rows.length === 0
            ? {
                cause:
                  'Nothing is set up for this project. Add one to the weekly sweep and it appears here.',
              }
            : null
        }
        bodySize={{ rows: 18, cardHeight: 33 }}
        body={() => <DataTable table={table} focus={focus} />}
      />
      {focus.live}
    </Page>
  )
}
