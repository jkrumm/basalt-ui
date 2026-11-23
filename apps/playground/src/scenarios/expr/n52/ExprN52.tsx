/**
 * expr-n52: is this month running faster than usual, and how much income is left once the bills
 * still due are paid. One chart card holds the answer (the figure, its signed distance from the
 * usual pace, the line of money already spent and due against the income rule); the bills table
 * beside it joins the chart's focus by day. See DESIGN.md for the question, the parts and the table
 * of what joins what.
 */
import { text } from '@tanstack/charts/text'
import { useFormat } from 'basalt-ui'
import { DataPanel } from 'basalt-ui/cards'
import type { Delta, Empty, Phase } from 'basalt-ui/cards'
import { Bars, CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT } from 'basalt-ui/tokens'
import { MONTH_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { CURRENCY, PAYDAY, TODAY, DAYS_IN_MONTH, monthNamed, summarize } from './fixture'
import type { Bill, Day } from './fixture'

const noop = (): void => undefined
const c = col<Bill>()

const DAY_CAP = 300
const BILLS_NONE = 'Nothing is scheduled. A new bill appears here once added.'

type Label = { key: string; text: string; day: number; value: number; priority: number }

export function ExprN52Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const month = monthNamed(fixture)
  const s = summarize(month)
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: 'The bank sync did not answer.' }
        : 'ready'
  const ready = phase === 'ready' && shotState !== 'empty'

  const eur = (n: number): string => {
    const text = f.money(Math.abs(n), CURRENCY, { maximumFractionDigits: 0 })
    return n < 0 ? `\u2212${text}` : text
  }
  const signed = (n: number): string => (n > 0 ? `+${eur(n)}` : eur(n))
  const deltaOf = (ahead: number): Delta => ({
    value: ahead === 0 ? eur(0) : signed(ahead),
    polarity: ahead === 0 ? 'neutral' : 'up-good',
    label: 'vs usual',
  })
  const leftAt = (d: Day): number => month.income - (d.committed ?? d.spent ?? 0)

  const focus = useChartFocus(month.days, {
    announce: (d) =>
      d.spent === null
        ? `${f.date(d.date, 'short', { year: undefined })}: ${eur(d.committed ?? 0)} with what is due, ${eur(leftAt(d))} remaining`
        : `${f.date(d.date, 'short', { year: undefined })}: ${eur(d.spent)} spent, ${eur(d.usual)} median`,
  })

  const table = useDataTable({
    columns: [
      c.entity('name', {
        header: 'Bill',
        sub: (b) => f.date(b.due, 'short', { year: undefined }),
        subMono: true,
        priority: 1,
      }),
      c.money('amount', { header: 'Amount', currency: CURRENCY, priority: 1 }),
    ],
    id: 'n52-due',
    label: 'Payments due',
    data: month.bills,
    getRowId: (b) => b.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: 4,
    phone: 'scroll',
    empty: billsEmpty(shotState, month.bills.length),
  })

  const restDelta = deltaOf(s.usual - s.spent)
  const dayDelta = (ahead: number): Delta => ({
    value: ahead === 0 ? eur(0) : signed(Math.round(ahead)),
    polarity: ahead === 0 ? 'neutral' : 'up-bad',
    label: 'vs usual day',
  })
  const oneOffFact =
    month.oneOff === null
      ? 'No one-off purchase'
      : `Without the one-off, ${eur(Math.abs(s.paceWithoutOneOff))} ${s.paceWithoutOneOff <= 0 ? 'under' : 'over'}`

  const end = month.days[DAYS_IN_MONTH - 1]?.committed ?? 0
  const top = Math.max(month.income, end, s.spent)

  return (
    <Page area="expr-n52">
      <PageBar title="Household budget, November" />
      <CardGrid min="regular">
        {/* cycle-expression-12: ChartCard height="fill" collapses when the grid stacks; a floor on the cell keeps the stacked plot tall, and the row stretch still fills it. */}
        <div className="grid min-h-144">
          <ChartCard
            title="Spending pace"
            subtitle={ready ? oneOffFact : 'Cumulative'}
            phase={phase}
            empty={
              shotState === 'empty'
                ? { cause: 'No spending is logged this month. Import a statement to see the pace.' }
                : null
            }
            height="fill"
            figure={
              ready
                ? {
                    // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n52, kept as its builder left it: its figure follows focus, built before figure-readout
                    value: focus.readout(eur(s.left), (d) => eur(leftAt(d))),
                    unit: focus.readout('left after bills', (d) =>
                      d.day <= TODAY ? 'remaining so far' : 'remaining after due dates',
                    ),
                    // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n52, kept as its builder left it: its figure follows focus, built before figure-readout
                    delta: focus.readout<Delta>(restDelta, (d) =>
                      d.spent === null ? restDelta : deltaOf(d.usual - d.spent),
                    ),
                    period: focus.readout(`Day ${TODAY} of ${DAYS_IN_MONTH}`, (d) =>
                      f.date(d.date, 'short', { year: undefined }),
                    ),
                    periodMono: focus.datum !== null,
                  }
                : { value: null }
            }
            footer={[
              { label: 'Spent so far', value: ready ? eur(s.spent) : '' },
              { label: 'Bills still due', value: ready ? eur(s.billsDue) : '' },
            ]}
            chart={(box) => (
              <CartesianChart
                label="Cumulative spending in November against the six-month median, with what is due and the income"
                data={month.days}
                height={box.height}
                focus={focus}
                tooltip={false}
                x={{
                  value: (d) => d.day,
                  ticks: [1, 5, 10, 15, 20, 25, 30],
                  format: (x) => String(x),
                  title: 'November',
                }}
                y={{
                  title: 'Euro, running total',
                  domain: { floor: 0, ceil: top, pad: 0.1 },
                  format: (v) =>
                    f.money(v, CURRENCY, { notation: 'compact', maximumFractionDigits: 1 }),
                }}
                series={[
                  {
                    mark: 'line',
                    key: 'usual',
                    label: 'Median of six months',
                    color: MONTH_SERIES.usual,
                    weight: 'quiet',
                    y: (d) => d.usual,
                    format: eur,
                  },
                  {
                    mark: 'line',
                    key: 'committed',
                    label: 'Plus what is due',
                    color: MONTH_SERIES.committed,
                    dash: true,
                    curve: 'stepAfter',
                    y: (d) => d.committed,
                    format: eur,
                  },
                  {
                    mark: 'line',
                    key: 'spent',
                    label: 'Spent',
                    color: MONTH_SERIES.spent,
                    weight: 'strong',
                    y: (d) => d.spent,
                    format: eur,
                  },
                  {
                    mark: 'dot',
                    key: 'oneoff',
                    label: 'One-off purchase',
                    color: MONTH_SERIES.committed,
                    y: (d) => d.oneOff,
                    format: eur,
                  },
                ]}
                refLines={[
                  {
                    value: month.income,
                    color: MONTH_SERIES.income,
                    label: `Income ${eur(month.income)}`,
                  },
                  {
                    axis: 'x',
                    value: PAYDAY,
                    color: MONTH_SERIES.payday,
                    dashed: true,
                    label: 'Payday',
                  },
                ]}
                marks={CartesianChart.custom<Day>((plot) => {
                  const labels: Label[] = [
                    {
                      key: 'pace',
                      text: `${signed(s.spent - s.usual)} vs usual`,
                      day: TODAY,
                      value: s.spent,
                      priority: 2,
                    },
                    {
                      key: 'left',
                      text: s.left < 0 ? `${eur(-s.left)} short` : `${eur(s.left)} left`,
                      day: 28,
                      value: s.left < 0 ? end : (end + month.income) / 2,
                      priority: 3,
                    },
                  ]
                  const oneOffDay =
                    month.oneOff === null ? undefined : month.days[month.oneOff.day - 1]
                  if (month.oneOff !== null && oneOffDay?.oneOff != null) {
                    labels.push({
                      key: 'oneoff',
                      // cycle-expression-12: a label that does not fit the plot is dropped, so the phone width asks for the short form by hand.
                      text:
                        plot.plotWidth < 400
                          ? eur(month.oneOff.amount)
                          : `${month.oneOff.name} ${eur(month.oneOff.amount)}`,
                      day: month.oneOff.day,
                      value: oneOffDay.oneOff,
                      priority: 4,
                    })
                  }
                  const byKey = new Map(labels.map((l) => [l.key, l]))
                  const { placed } = chartLabels.place(
                    labels.map((l) => ({
                      key: l.key,
                      text: l.text,
                      x: plot.x(l.day) ?? 0,
                      y: plot.y(l.value),
                      priority: l.priority,
                      size: BASALT.text.micro,
                      weight: 500,
                    })),
                    { width: plot.plotWidth, height: plot.plotHeight },
                    { gap: BASALT.dotR + 3 },
                  )
                  return [
                    text(placed, {
                      x: (l) => byKey.get(l.key)?.day ?? 0,
                      y: (l) => byKey.get(l.key)?.value ?? 0,
                      text: (l) => l.text,
                      dx: (l) => l.dx,
                      dy: (l) => l.dy,
                      anchor: (l) => l.textAnchor,
                      fill: BASALT.ink,
                      fontSize: BASALT.text.micro,
                    }),
                  ]
                })}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-4">
          <DataPanel
            title="Upcoming bills"
            subtitle="Due by Nov 30"
            phase={phase}
            empty={billsEmpty(shotState, month.bills.length)}
            bodySize={{ rows: 6 }}
            body={() => (
              <DataTable table={table} focusItems={{ focus, holds: (b, d) => d.day === b.day }} />
            )}
          />
          <ChartCard
            title="Spending per day"
            subtitle={ready ? `Scale cut at ${eur(DAY_CAP)}` : 'Per day'}
            phase={phase}
            empty={shotState === 'empty' ? { cause: 'Nothing to chart yet.' } : null}
            height="short"
            figure={
              ready
                ? {
                    // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n52, kept as its builder left it: its figure follows focus, built before figure-readout
                    value: focus.readout(eur(s.perDay), (d) => eur(d.daily ?? 0)),
                    unit: focus.readout('a day', () => 'that day'),
                    // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n52, kept as its builder left it: its figure follows focus, built before figure-readout
                    delta: focus.readout<Delta>(dayDelta(s.perDay - s.usualPerDay), (d) =>
                      dayDelta(
                        d.daily === null ? s.perDay - s.usualPerDay : d.daily - d.usualDaily,
                      ),
                    ),
                  }
                : { value: null }
            }
            footer={[
              { label: 'Biggest day', value: ready ? eur(s.biggestDay) : '' },
              { label: 'Days with nothing', value: ready ? s.emptyDays : '' },
            ]}
            chart={(box) => (
              <Bars
                label="Euros spent on each day so far"
                data={month.days}
                height={box.height}
                focus={focus}
                tooltip={false}
                x={{
                  value: (d) => d.day,
                  ticks: [1, 5, 10, 15, 20, 25, 30],
                  format: (x) => String(x),
                }}
                y={{
                  domain: [0, DAY_CAP],
                  format: (v) => f.money(v, CURRENCY, { maximumFractionDigits: 0 }),
                }}
                series={[
                  {
                    mark: 'bar',
                    key: 'daily',
                    label: 'That day',
                    color: MONTH_SERIES.spent,
                    y: (d) => d.daily,
                    format: eur,
                  },
                ]}
              />
            )}
          />
        </div>
      </CardGrid>
      {focus.live}
    </Page>
  )
}

function billsEmpty(shotState: ScenarioProps['shotState'], bills: number): Empty | null {
  if (shotState === 'empty') return { cause: BILLS_NONE }
  if (bills > 0) return null
  return { cause: BILLS_NONE }
}
