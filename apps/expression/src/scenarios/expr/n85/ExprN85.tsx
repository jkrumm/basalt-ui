import { useFormat } from 'basalt-ui'
import { BarList, DataPanel, StatCell, StatGroup } from 'basalt-ui/cards'
import type { Delta, Empty, LegendEntry, Phase } from 'basalt-ui/cards'
import { useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { CircleDot, CirclePlus, Target, Trash2 } from 'lucide-react'
import { N85_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { ledgerFor } from './fixture'
import { HOURS_IN_MONTH, HOURS_IN_WEEK } from './fixture'
import type { OpenIssue, Row } from './fixture'

const LEGEND: readonly LegendEntry[] = [
  { key: 'gain', label: 'Closed with a gain', color: N85_SERIES.gain, swatch: 'bar' },
  { key: 'flat', label: 'Closed, figure unmoved', color: N85_SERIES.flat, swatch: 'bar' },
  { key: 'unmeasured', label: 'Closed, not measured', color: N85_SERIES.unmeasured, swatch: 'bar' },
  { key: 'dropped', label: 'Dropped', color: N85_SERIES.dropped, swatch: 'bar' },
  { key: 'open', label: 'Open', color: N85_SERIES.open, swatch: 'bar' },
]

const c = col<Row>()
const o = col<OpenIssue>()

const retry = () => undefined

// cycle-expression-17: a loading cell keeps its pill slot only through a Delta with an empty value
const HELD: Delta = { value: '', polarity: 'neutral', label: '' }

const sumOf = (
  rows: readonly Row[],
  window: Row['window'],
  key: 'opened' | 'gain' | 'dropped' | 'open',
) => rows.filter((r) => r.window === window).reduce((total, r) => total + (r[key] ?? 0), 0)

// cycle-expression-17: the formatter has no true-minus option, Intl writes a hyphen
/** A true minus, the sign Intl writes as a hyphen. */
const minus = (text: string) => text.replace('-', '\u2212')

export function ExprN85Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const ready = shotState === undefined
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The ledger did not answer.', retry }
        : 'ready'
  const ledger = ready ? ledgerFor(fixture) : undefined
  const rows = ledger?.rows ?? []
  const openIssues = ledger?.openIssues ?? []
  const filedToday = ledger?.filedToday ?? 0
  const hasRows = rows.length > 0
  const barEmpty: Empty | null =
    shotState === 'empty' ? { cause: 'Nothing opened yet. The first finding lands here.' } : null
  const tableEmpty: Empty | null =
    shotState === 'empty' ? { cause: 'No counts yet. They fill in as findings arrive.' } : null
  const openEmpty: Empty | null =
    shotState === 'empty' || (ready && openIssues.length === 0)
      ? { cause: 'Nothing to follow up.' }
      : null

  const focus = useChartFocus(rows, {
    announce: (r) =>
      `${r.loop}, ${r.windowLabel}: ${r.opened} Issues, ${r.gain ?? 'no pass record'} gained, ${r.dropped} noise, ${r.open} open`,
  })

  const opened30 = sumOf(rows, '30d', 'opened')
  const opened7 = sumOf(rows, '7d', 'opened')
  const gain30 = sumOf(rows, '30d', 'gain')
  const gain7 = sumOf(rows, '7d', 'gain')
  const dropped30 = sumOf(rows, '30d', 'dropped')
  const dropped7 = sumOf(rows, '7d', 'dropped')
  const open30 = sumOf(rows, '30d', 'open')
  const weekPace = (opened30 * 7) / 30

  const held = shotState === 'loading' || shotState === 'error'
  const noData = shotState === 'empty'
  const pts = (week: number, month: number): number | undefined =>
    opened7 === 0 || opened30 === 0 ? undefined : (week / opened7 - month / opened30) * 100
  const shareDelta = (diff: number | undefined, month: number): Delta | undefined =>
    diff === undefined
      ? undefined
      : {
          value: minus(
            `${f.number(diff, { signDisplay: 'exceptZero', maximumFractionDigits: 0 })} pts`,
          ),
          polarity: 'neutral',
          label: `vs ${f.percent(month / opened30)}`,
        }
  const openedDelta: Delta | undefined =
    opened30 === 0
      ? undefined
      : {
          value: minus(
            f.percent(opened7 / weekPace - 1, {
              signDisplay: 'exceptZero',
              maximumFractionDigits: 0,
            }),
          ),
          polarity: 'neutral',
          label: `vs ${f.number(weekPace, { maximumFractionDigits: 1 })} a week`,
        }
  const openedSub = opened30 === 0 ? 'Quiet all month' : `${opened7} in the past week`
  const shareSub = (n: number) => (opened7 === 0 ? 'None' : `${n} of ${opened7}`)
  const todayWord = filedToday === 0 ? 'None today' : `${filedToday} opened today`

  const medians = rows.flatMap((r) => (r.medianHours === null ? [] : [r.medianHours]))
  const table = useDataTable({
    id: 'n85-loops',
    label: 'Outcomes by window',
    columns: [
      c.entity('loop', { header: 'Loop', priority: 1, sortable: false, sub: (r) => r.windowLabel }),
      c.number('gain', { header: 'Gain', priority: 2, sortable: false, card: 'value' }),
      c.number('dropped', { header: 'Dropped', priority: 2, sortable: false, card: 'meta' }),
      c.meter('medianHours', {
        header: 'Median hours to close',
        max: Math.max(1, ...medians),
        priority: 2,
        sortable: false,
      }),
    ],
    data: rows,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: 8,
    phone: 'columns',
  })

  const issueTable = useDataTable({
    id: 'n85-open',
    label: 'Aging items',
    columns: [
      o.entity('id', {
        header: 'Issue',
        mono: true,
        priority: 1,
        sortable: false,
        sub: (i) => (i.filedToday ? 'Today' : null),
      }),
      o.text('loop', { header: 'Loop', priority: 2, sortable: false }),
      o.meter('hoursAgo', {
        header: 'Age in hours',
        max: Math.max(1, ...openIssues.map((i) => i.hoursAgo)),
        priority: 2,
        sortable: false,
      }),
    ],
    data: openIssues,
    getRowId: (i) => i.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: 6,
    phone: 'columns',
  })

  const items = rows.map((r) => ({
    key: r.id,
    label: `${r.loop}, ${r.windowLabel}`,
    value: r.opened,
    parts: {
      gain: r.gain ?? 0,
      flat: r.flat,
      unmeasured: r.unmeasured,
      dropped: r.dropped,
      open: r.open,
    },
  }))

  return (
    <Page area="expr-n85">
      <PageBar title="Self-improvement loops over 7 and 30 days" />
      <StatGroup variant="cards" label="Totals">
        <StatCell
          icon={CirclePlus}
          title="Opened"
          value={hasRows ? opened30 : null}
          unit="Issues"
          phase={phase}
          delta={held ? HELD : openedDelta}
          sub={held ? '' : noData ? undefined : openedSub}
        />
        <StatCell
          icon={Target}
          title="Measured gain"
          value={hasRows ? gain30 : null}
          phase={phase}
          delta={held ? HELD : shareDelta(pts(gain7, gain30), gain30)}
          sub={held ? '' : noData ? undefined : shareSub(gain7)}
        />
        <StatCell
          icon={Trash2}
          title="Dropped as noise"
          value={hasRows ? dropped30 : null}
          phase={phase}
          delta={held ? HELD : shareDelta(pts(dropped7, dropped30), dropped30)}
          sub={held ? '' : noData ? undefined : shareSub(dropped7)}
        />
        <StatCell
          icon={CircleDot}
          title="Still open"
          value={hasRows ? open30 : null}
          phase={phase}
          status={noData ? undefined : { tone: 'neutral', label: held ? '' : todayWord }}
        />
      </StatGroup>
      <div className="grid items-start gap-4 @wide:grid-cols-3">
        {/* cycle-expression-17: a list card stretches to its grid row; this wrapper keeps it at its rows' height */}
        <div>
          <BarList
            title="Outcome per loop"
            subtitle="Split by how each ended"
            phase={phase}
            empty={barEmpty}
            focus={focus}
            items={items}
            series={LEGEND}
            bodyRows={8}
          />
        </div>
        <div className="flex flex-col gap-4 @wide:col-span-2">
          <DataPanel
            title="Counts and time to close"
            subtitle="A dash means no pass record"
            phase={phase}
            empty={tableEmpty}
            bodySize={{ rows: 9 }}
            body={() => <DataTable table={table} focus={focus} height="fill" />}
          />
          <DataPanel
            title="Issues to chase"
            subtitle="Newest first"
            phase={phase}
            empty={openEmpty}
            bodySize={{ rows: 7 }}
            body={() => (
              <DataTable
                table={issueTable}
                focusItems={{
                  focus,
                  holds: (issue, row) =>
                    issue.loopId === row.loopId &&
                    issue.hoursAgo < (row.window === '7d' ? HOURS_IN_WEEK : HOURS_IN_MONTH),
                }}
                height="fill"
              />
            )}
          />
        </div>
      </div>
      {focus.live}
    </Page>
  )
}
