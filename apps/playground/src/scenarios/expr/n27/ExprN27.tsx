import type { ReactElement } from 'react'
import { useFormat } from 'basalt-ui'
import { DataPanel, StatCard } from 'basalt-ui/cards'
import type { Empty, Phase } from 'basalt-ui/cards'
import { Sparkline, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import type { Tone } from 'basalt-ui/cards'
import { Num } from 'basalt-ui/ui/num'
import type { ScenarioProps } from '../../shot-state'
import { loadFixture, VERDICT_ORDER } from './fixture'
import type { Row, VerdictName } from './fixture'

const c = col<Row>()

const TONES: Record<VerdictName, Tone> = {
  Slid: 'bad',
  Better: 'good',
  Steady: 'neutral',
  'No reading': 'neutral',
}

const EMPTY: Empty = {
  cause: 'No health measure has a value yet. They appear after the first weekly run.',
}

const minus = (text: string): string => text.replace('-', '\u2212')

function directionText(row: Row): string {
  return row.direction === 'lower' ? 'Lower is better' : 'Higher is better'
}

function changeText(row: Row): string {
  if (row.toward === null) return 'no reading'
  if (row.toward === 0) return 'same as last week'
  return `${Math.abs(row.toward)}% ${row.toward > 0 ? 'better' : 'worse'} than last week`
}

export function ExprN27Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const f = useFormat()
  const fx = loadFixture(fixture)
  const rows = shotState === 'empty' ? [] : fx.rows
  const ready = shotState === undefined

  const valueText = (row: Row): string =>
    row.now === null
      ? 'not measured'
      : `${row.prefix}${f.number(row.now, { minimumFractionDigits: row.digits, maximumFractionDigits: row.digits })}${row.unit}`
  const focus = useChartFocus(rows, {
    announce: (row) => `${row.name}: ${valueText(row)}, ${changeText(row)}`,
  })

  const table = useDataTable({
    id: 'factory-health',
    label: 'Factory health measures',
    columns: [
      c.entity('name', {
        header: 'Measure',
        priority: 1,
        sub: (row) =>
          row.now === null
            ? `${directionText(row)}. Not measured, ${row.missing}`
            : directionText(row),
      }),
      // owner-review-1: the number kind takes one unit and one digit count per column, and these rows each carry their own
      c.custom('now', {
        header: 'This week',
        priority: 1,
        card: 'value',
        sortValue: (row) => row.now,
        render: (row) =>
          row.now === null ? (
            <Num value={null} />
          ) : (
            <span className="tabular-nums">
              {row.prefix}
              <Num
                value={row.now}
                format={{ minimumFractionDigits: row.digits, maximumFractionDigits: row.digits }}
              />
              {row.unit}
            </span>
          ),
      }),
      c.status('verdict', {
        header: 'Verdict',
        priority: 3,
        // owner-review-1: group.by takes a column, so the group's verdict is also a column that repeats its header
        card: 'hidden',
        options: VERDICT_ORDER,
        tone: (verdict) => TONES[verdict],
      }),
      c.delta('toward', { header: 'Better by', polarity: 'up-good', unit: '%', priority: 1 }),
      c.spark('trend', {
        header: 'Last 12 weeks',
        priority: 2,
        label: 'Weekly value',
        render: (row, box) => (
          <Sparkline
            series={row.trend}
            height={box.height}
            cap={row.cap}
            label={`${row.name}, weekly value`}
          />
        ),
      }),
    ],
    data: rows,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    group: { by: 'verdict' },
  })

  const phase: Phase = ready
    ? 'ready'
    : shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The measures service did not answer.' }
        : 'ready'
  const panelPhase: Phase = typeof phase === 'object' ? { ...phase, retry: () => undefined } : phase

  const counted = shotState === undefined
  const verdictRows = (verdict: VerdictName): readonly Row[] =>
    rows.filter((row) => row.verdict === verdict)
  const slid = verdictRows('Slid')
  const better = verdictRows('Better')
  const steady = verdictRows('Steady').length
  const unmeasured = verdictRows('No reading').length
  const readout = (verdict: VerdictName, rest: string): string =>
    focus.readout(rest, (row) =>
      row.verdict === verdict ? `${row.name}: ${valueText(row)}, ${changeText(row)}` : rest,
    )
  const worst = slid[0]
  const best = better[0]
  const change = (row: Row | undefined): string =>
    row?.toward == null ? 'None' : minus(f.number(row.toward, { signDisplay: 'exceptZero' })) + '%'
  const countDelta = (now: number, last: number, polarity: 'up-good' | 'up-bad') =>
    counted
      ? {
          value: minus(f.number(now - last, { signDisplay: 'exceptZero' })),
          polarity,
          label: 'vs last week',
        }
      : undefined

  return (
    <Page area="expr-n27">
      <PageBar title="Factory health" />
      <div className="grid items-start gap-3 p-3 @wide:grid-cols-4">
        <div className="grid gap-3">
          <StatCard
            title="Measures that slid"
            subtitle={`${fx.nowLabel} so far, against ${fx.lastLabel}`}
            info="Measures that moved the wrong way against last week. Fewer is better."
            phase={phase}
            value={counted ? fx.slid.now : null}
            unit={counted ? `of ${rows.length}` : undefined}
            delta={countDelta(fx.slid.now, fx.slid.last, 'up-bad')}
            sub={
              counted
                ? readout('Slid', worst === undefined ? 'Nothing slid' : `Worst: ${worst.name}`)
                : '\u00a0'
            }
            chart={() =>
              counted ? (
                <Sparkline
                  series={fx.slid.byWeek}
                  height={56}
                  label="Measures that slid each week"
                />
              ) : null
            }
            xLabels={counted ? fx.axisLabels : undefined}
            footer={[
              { label: 'Worst change', value: counted ? change(worst) : '' },
              { label: 'Steady', value: counted ? steady : '' },
            ]}
          />
          <StatCard
            title="Measures that got better"
            subtitle="Same week, same base"
            info="Measures that moved the right way against last week. More is better."
            phase={phase}
            value={counted ? fx.better.now : null}
            unit={counted ? `of ${rows.length}` : undefined}
            delta={countDelta(fx.better.now, fx.better.last, 'up-good')}
            sub={
              counted
                ? readout(
                    'Better',
                    best === undefined ? 'Nothing got better' : `Best: ${best.name}`,
                  )
                : '\u00a0'
            }
            chart={() =>
              counted ? (
                <Sparkline
                  series={fx.better.byWeek}
                  height={56}
                  label="Measures that got better each week"
                />
              ) : null
            }
            xLabels={counted ? fx.axisLabels : undefined}
            footer={[
              { label: 'Best change', value: counted ? change(best) : '' },
              { label: 'Not measured', value: counted ? unmeasured : '' },
            ]}
          />
        </div>
        <div className="@wide:col-span-3">
          <DataPanel
            title="Health measures"
            subtitle="One point a week, newest on the right"
            info="Better by is the change against last week in the better direction: a fall in a lower-is-better measure counts as better."
            phase={panelPhase}
            empty={shotState === 'empty' ? EMPTY : null}
            bodySize={{ rows: fx.rows.length + VERDICT_ORDER.length - 1 }}
            body={() => <DataTable table={table} focus={focus} />}
          />
        </div>
      </div>
    </Page>
  )
}
