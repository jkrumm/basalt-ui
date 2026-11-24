import { text } from '@tanstack/charts/text'
import type { Phase } from 'basalt-ui/cards'
import { DataPanel } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import { useFormat } from 'basalt-ui'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { CHARGE_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { UNUSUAL_FROM, buildCharges, summarise, toCheck } from './fixture'
import type { Charge } from './fixture'

/** The chart's top: a charge past it is drawn on the edge with the kit's caret and its true value. */
const Y_MAX = 4
const MINUS = '\u2212'

const c = col<Charge>()
const CHECK_TONE = { 'Over 2×': 'accent', Repeat: 'accent', 'In range': 'neutral' } as const

// cycle-expression-12: a repeat charge sits at 1x inside the grey cloud, where no label stays readable, so its label hangs in the unusual band at its date
const labelAt = (d: Charge | undefined): number =>
  d === undefined ? 0 : d.flag === 'repeat' ? UNUSUAL_FROM + 0.35 : Math.min(d.ratio, Y_MAX)

const signed = (pct: number): string => `${pct < 0 ? MINUS : '+'}${Math.abs(Math.round(pct))}%`

export function ExprN51Scenario({ shotState, fixture }: ScenarioProps) {
  const fmt = useFormat()
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The card feed did not answer.', retry: () => undefined }
        : 'ready'
  const ready = phase === 'ready'
  const noCharges = shotState === 'empty'
  const charges = ready && !noCharges ? buildCharges(fixture === 'calm') : []
  const rows = toCheck([...charges])
  const sum = summarise(charges)
  const noneToCheck =
    ready && rows.length === 0
      ? {
          cause: noCharges
            ? 'Nothing to check yet.'
            : 'Every charge is under 2× and has a category.',
        }
      : null
  const money = (n: number): string => fmt.money(n, 'EUR')
  const when = (d: Date): string =>
    `${fmt.date(d, 'short', { year: undefined })}, ${fmt.time(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`

  const focus = useChartFocus(charges, {
    announce: (d) =>
      `${d.merchant}, ${when(d.at)}: ${money(d.amount)}, ${d.ratio.toFixed(1)}× the median`,
  })

  const columns = [
    c.entity('merchant', {
      header: 'Merchant',
      priority: 1,
      sub: (d) => when(d.at),
      subMono: true,
    }),
    c.money('amount', { header: 'Amount', currency: 'EUR', priority: 1 }),
    c.number('ratio', { header: 'vs usual', digits: 1, priority: 2 }),
    c.status('check', {
      header: 'Check',
      options: ['Over 2×', 'Repeat', 'In range'],
      tone: (v) => CHECK_TONE[v],
      priority: 3,
    }),
    c.text('categoryText', { header: 'Category', priority: 3 }),
  ]
  const table = useDataTable({
    id: 'expr-n51-check',
    label: 'Charges to check',
    columns,
    data: rows,
    getRowId: (d) => d.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: 14,
    empty: noneToCheck,
  })

  const restDelta = {
    value: sum.excess > 0 ? `+${money(sum.excess)}` : money(0),
    polarity: 'neutral' as const,
    label: 'over usual',
  }
  const figure = {
    value: focus.readout(ready ? String(sum.unusual) : '', (d) => money(d.amount)),
    unit: focus.readout('unusual', (d) => d.merchant),
    delta: ready
      ? focus.readout(restDelta, (d) => ({
          value: signed((d.ratio - 1) * 100),
          polarity: 'neutral' as const,
          label: 'vs usual',
        }))
      : undefined,
    period: focus.readout(ready ? `of ${charges.length} charges` : '', (d) => when(d.at)),
    periodMono: focus.datum !== null,
  }
  const footer = [
    {
      label: 'No category',
      value: ready ? `${sum.uncategorised}, ${money(Math.round(sum.uncategorisedSum))}` : '',
    },
    {
      label: 'Twice',
      value: ready ? (sum.repeated.length > 0 ? sum.repeated.join(', ') : 'None') : '',
    },
  ] as const

  return (
    <Page area="expr-n51">
      <PageBar title="Card charges, last 30 days" />
      <div className="grid gap-4 @wide:grid-cols-2">
        <ChartCard
          title="Size against the merchant's median"
          subtitle="Median over the last 12 months"
          phase={phase}
          height="tall"
          empty={
            noCharges ? { cause: 'No charges yet. They appear after the next card sync.' } : null
          }
          figure={figure}
          footer={footer}
          chart={() => (
            <CartesianChart
              label="Size of each payment as a multiple of its median"
              data={charges}
              focus={focus}
              tooltip={false}
              summary={`${sum.unusual} flagged, ${sum.uncategorised} uncategorised, of ${charges.length}`}
              x={{ value: (d) => d.at }}
              y={{
                domain: [0, Y_MAX],
                title: 'Times median',
                format: (v) => `${Math.round(v * 10) / 10}×`,
              }}
              zones={[{ from: UNUSUAL_FROM, to: Y_MAX, fill: alpha(BASALT.brand, 0.06) }]}
              refLines={[
                { value: 1, color: CHARGE_SERIES.rule },
                {
                  value: UNUSUAL_FROM,
                  color: CHARGE_SERIES.rule,
                  dashed: true,
                  label: 'Unusual from 2×',
                },
              ]}
              series={[
                // cycle-expression-12: a dot series has no ring style, so an uncategorised charge draws a larger dark dot under its own
                {
                  mark: 'dot',
                  key: 'uncategorised',
                  label: 'Uncategorised',
                  color: CHARGE_SERIES.uncategorised,
                  r: () => BASALT.dotR + 2,
                  y: (d) => (d.category === null ? d.ratio : null),
                },
                {
                  mark: 'dot',
                  key: 'inRange',
                  label: 'In range',
                  color: CHARGE_SERIES.inRange,
                  r: () => BASALT.dotR,
                  y: (d) => (d.flag === 'none' ? d.ratio : null),
                },
                {
                  mark: 'dot',
                  key: 'unusual',
                  label: 'Unusual',
                  color: CHARGE_SERIES.unusual,
                  r: () => BASALT.dotR,
                  y: (d) => (d.flag === 'none' ? null : d.ratio),
                },
              ]}
              marks={CartesianChart.custom<Charge>((plot) => {
                const flagged = plot.data.filter((d) => d.flag !== 'none')
                const byId = new Map(flagged.map((d) => [d.id, d]))
                const r = BASALT.dotR + 3
                // cycle-expression-12: the placer treats all 391 dots as walls, so a label for a charge inside the cloud finds no spot; only the flagged dots are obstacles
                const dots = flagged.flatMap((d) => {
                  const px = plot.x(d.at)
                  if (px === null) return []
                  const py = plot.y(Math.min(d.ratio, Y_MAX))
                  return [{ left: px - r, top: py - r, width: 2 * r, height: 2 * r }]
                })
                const { placed } = chartLabels.place(
                  flagged.flatMap((d) => {
                    const px = plot.x(d.at)
                    if (px === null) return []
                    return [
                      {
                        key: d.id,
                        text:
                          d.flag === 'over' && d.ratio <= Y_MAX
                            ? `${d.merchant} ${d.ratio.toFixed(1)}×`
                            : d.flag === 'repeat'
                              ? `${d.merchant} twice`
                              : d.merchant,
                        x: px,
                        // cycle-expression-12: the kit prints the true value at the caret but no name, so the label of a capped charge sits at the edge
                        y: plot.y(labelAt(d)),
                        priority: d.flag === 'repeat' ? Y_MAX + 1 : d.ratio,
                      },
                    ]
                  }),
                  { width: plot.plotWidth, height: plot.plotHeight },
                  { obstacles: dots, gap: BASALT.dotR + 3 },
                )
                return [
                  text(placed, {
                    x: (l) => byId.get(l.key)?.at ?? 0,
                    y: (l) => labelAt(byId.get(l.key)),
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
        <DataPanel
          title="Charges to check"
          subtitle="Over 2×, repeated or without a category"
          phase={phase}
          empty={noneToCheck}
          bodySize={{ height: 454 }}
          body={() => <DataTable table={table} focus={focus} height="fill" />}
        />
      </div>
    </Page>
  )
}
