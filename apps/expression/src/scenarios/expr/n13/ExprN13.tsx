import { text } from '@tanstack/charts/text'
import { useFormat } from 'basalt-ui'
import type { Delta, Empty, FootFacts, Phase } from 'basalt-ui/cards'
import { StatCard } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, Sparkline, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar, PageSummary, Section } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { BASALT } from 'basalt-ui/tokens'
import type { ScenarioProps } from '../../shot-state'
import { isFixtureName, loadRows, MONTHS } from './fixture'
import type { Row } from './fixture'

const CURRENCY = 'EUR'
const GREW = { light: BASALT.bad, dark: BASALT.bad }
const MINOR = { light: BASALT.inkMuted, dark: BASALT.inkMuted }
const FELL = { light: BASALT.good, dark: BASALT.good }
/** A rise under this share of the largest is drawn neutral: the red marks the charges that matter. */
const MINOR_SHARE = 0.2
const FLAT_DOMAIN: [number, number] = [-10, 50]
const EMPTY: Empty = {
  cause: 'No recurring charges tracked yet.',
  action: { label: 'Import a bank statement', onClick: () => undefined },
}
const STAT_EMPTY: Empty = { cause: 'Nothing to total yet.' }
const CHART_EMPTY: Empty = { cause: 'Changes appear once a charge has a price history.' }
const c = col<Row>()

function phaseOf(shotState: ScenarioProps['shotState']): Phase {
  if (shotState === 'loading') return 'loading'
  if (shotState === 'error') {
    return {
      tag: 'error',
      message: 'The charges service did not answer.',
      retry: () => undefined,
    }
  }
  return 'ready'
}

export function ExprN13Scenario({ shotState, fixture }: ScenarioProps) {
  const fmt = useFormat()
  const money = (n: number, digits = 2) =>
    fmt.money(n, CURRENCY, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${money(Math.abs(n))}`

  const phase = phaseOf(shotState)
  const isEmpty = shotState === 'empty'
  const rows =
    isEmpty || phase !== 'ready' ? [] : loadRows(isFixtureName(fixture) ? fixture : undefined)

  const total = rows.reduce((sum, r) => sum + r.perMonth, 0)
  const totals = MONTHS.map((_, i) => rows.reduce((sum, r) => sum + (r.monthly[i] ?? 0), 0))
  const first = totals[0] ?? 0
  const added = total - first
  const raised = rows.reduce((sum, r) => sum + Math.max(r.change, 0), 0)
  const grew = rows.filter((r) => r.change > 0)
  const paused = rows.filter((r) => r.perMonth === 0)
  const pct = first === 0 ? 0 : (added / first) * 100
  const delta: Delta = {
    value: `${added > 0 ? '+' : added < 0 ? '−' : ''}${Math.abs(pct).toFixed(1)}%`,
    polarity: 'up-bad',
    label: 'since Dec',
  }
  // The marks worth a word: the two biggest rises and the biggest cut.
  const big = (rows[0]?.change ?? 0) * MINOR_SHARE
  const risers = grew.slice(0, 2)
  const faller = rows.find((r) => r.change < 0)

  // Loading and error keep the loaded rows of the card with dashes; an empty card drops them.
  const showFacts = !isEmpty
  const dash = '—'
  const statFooter: FootFacts = [
    { label: 'Per year', value: rows.length === 0 ? dash : money(total * 12, 0) },
  ]
  const chartFooter: FootFacts = [
    { label: 'Raised', value: rows.length === 0 ? dash : signed(raised) },
  ]

  const focus = useChartFocus(rows, {
    announce: (r) => `${r.payee}: ${signed(r.change)} a month since December`,
  })

  const table = useDataTable({
    id: 'recurring-charges',
    label: 'Recurring charges',
    columns: [
      c.entity('payee', {
        header: 'Charge',
        sub: (r) =>
          r.perMonth === 0
            ? `${r.category} · paused`
            : r.interval === 'monthly'
              ? r.category
              : `${r.category} · ${money(r.billed)} ${r.interval}`,
      }),
      c.money('perMonth', { header: 'Per month', currency: CURRENCY }),
      // cycle-expression-4: the delta kind has no money format, so the unit sits in the header and a zero prints "0", not a dash
      c.delta('change', { header: 'Change (€)', polarity: 'up-bad', priority: 2 }),
      c.spark('trend', {
        header: '12 months',
        priority: 3,
        label: 'Cost per month, December to November',
        render: (r, box) => (
          <Sparkline
            points={r.monthly}
            height={box.height}
            label={`${r.payee}, cost per month, December to November`}
          />
        ),
      }),
    ],
    data: rows,
    phase,
    empty: isEmpty ? EMPTY : null,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })

  const summary =
    phase !== 'ready' && typeof phase === 'object'
      ? 'Charges unavailable'
      : rows.length === 0
        ? 'No recurring charges tracked'
        : grew.length === 0
          ? `No charge grew this year, ${rows.length} tracked`
          : `${grew.length} of ${rows.length} ${rows.length === 1 ? 'charge' : 'charges'} grew this year${paused.length > 0 ? `, ${paused.length} paused` : ''}`
  const summaryPhase = phase === 'loading' ? phase : 'ready'

  return (
    <Page area="recurring-charges">
      <PageBar title="Recurring charges" />
      <div className="@container flex flex-col gap-4">
        <PageSummary phase={summaryPhase} sentence={summary} />
        <div className="grid items-start gap-4 @wide:grid-cols-3">
          <div className="flex flex-col gap-4">
            <StatCard
              title="Monthly commitment"
              subtitle="Quarterly and yearly charges spread over months"
              phase={phase}
              empty={isEmpty ? STAT_EMPTY : null}
              value={rows.length === 0 ? null : money(total, 0)}
              {...(rows.length === 0 ? {} : { delta })}
              chart={(box) => (
                <Sparkline
                  points={totals}
                  height={box.height}
                  label="Total cost per month, December to November"
                  axisLabels={[MONTHS[0], MONTHS[6], MONTHS[11]]}
                  format={(v) => money(v, 0)}
                />
              )}
              {...(showFacts ? { footer: statFooter } : {})}
            />
            <ChartCard
              title="Change per charge"
              subtitle="Dec to Nov, per month"
              height="short"
              phase={phase}
              empty={isEmpty ? CHART_EMPTY : null}
              {...(isEmpty
                ? {}
                : {
                    figure: {
                      value:
                        rows.length === 0
                          ? null
                          : focus.readout(signed(added), (r) => signed(r.change)),
                      period: focus.readout('net, all charges', (r) => r.payee),
                    },
                  })}
              {...(showFacts ? { footer: chartFooter } : {})}
              chart={() => (
                <CartesianChart<Row>
                  // cycle-expression-4: a chart with `focus` is wrapped in a div that does not fill the card box, so `height="fill"` fell back to 320 px and clipped; the box is `short` (160) and the chart states it
                  height={160}
                  label="Change in monthly cost per charge since December, largest rise first"
                  data={rows}
                  x={{ value: (r) => r.payee }}
                  y={{
                    format: (v) => money(v, 0),
                    // cycle-expression-4: an all-zero extent draws a synthetic €1 top tick, so the flat case states its own domain
                    ...(rows.length > 0 && rows.every((r) => r.change === 0)
                      ? { domain: FLAT_DOMAIN }
                      : {}),
                  }}
                  series={[
                    {
                      mark: 'bar',
                      key: 'grew',
                      label: 'Grew',
                      color: GREW,
                      stack: 'change',
                      y: (r) => (r.change >= big ? r.change : null),
                    },
                    {
                      mark: 'bar',
                      key: 'other',
                      label: 'Small rise',
                      color: MINOR,
                      stack: 'change',
                      y: (r) => (r.change > 0 && r.change < big ? r.change : null),
                    },
                    {
                      mark: 'bar',
                      key: 'fell',
                      label: 'Fell',
                      color: FELL,
                      stack: 'change',
                      y: (r) => (r.change < 0 ? r.change : null),
                    },
                  ]}
                  tooltip={false}
                  focus={focus}
                  marks={CartesianChart.custom<Row>((plot) => [
                    // cycle-expression-4: no direct-label seam for a categorical bar, so the words are engine text marks at bar tops, placed by hand
                    text(
                      plot.rows('grew').filter((r) => risers.includes(r)),
                      {
                        x: (r) => r.payee,
                        y: (r) => r.change,
                        text: (r) => signed(r.change),
                        anchor: 'start',
                        dy: -6,
                        fill: BASALT.ink,
                        fontSize: BASALT.text.micro,
                      },
                    ),
                    text(
                      plot.rows('fell').filter((r) => r === faller),
                      {
                        x: (r) => r.payee,
                        y: () => 0,
                        text: (r) => signed(r.change),
                        anchor: 'end',
                        dy: -6,
                        fill: BASALT.ink,
                        fontSize: BASALT.text.micro,
                      },
                    ),
                  ])}
                />
              )}
            />
          </div>
          <div className="@wide:col-span-2">
            <Section title="Charges, biggest rise first">
              <DataTable table={table} focus={focus} />
            </Section>
          </div>
        </div>
      </div>
    </Page>
  )
}
