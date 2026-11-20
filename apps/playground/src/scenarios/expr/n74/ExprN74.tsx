import { useFormat } from 'basalt-ui'
import { DataPanel } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { Bars, ChartCard, Lines, useChartFocus } from 'basalt-ui/charts'
import type { BarsSeries, LineSeries } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { N74_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { walletsNamed } from './fixture'
import { summarize } from './summary'
import type { Day, Row, Verdict } from './summary'

const noop = (): void => undefined

const VERDICT_WORD: Record<Verdict, string> = {
  most: 'Grew most',
  new: 'New',
  silent: 'Silent',
  grew: 'Grew',
  flat: 'Flat',
  fell: 'Fell',
}
const VERDICTS = ['most', 'new', 'grew', 'flat', 'fell', 'silent'] as const

const c = col<Row>()

export function ExprN74Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const wallets = shotState === 'empty' ? [] : walletsNamed(fixture)
  const s = summarize(wallets)
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: 'The usage log did not answer.' }
        : 'ready'
  const ready = phase === 'ready' && wallets.length > 0
  const usd = (v: number): string => f.money(v, 'USD', { maximumFractionDigits: 0 })
  const times = (m: number): string => `×${f.number(m, { maximumFractionDigits: m < 10 ? 1 : 0 })}`
  const ratio = (r: Row): string => (r.prev > 0 ? times(r.last / r.prev) : '')

  const focus = useChartFocus(s.rows, {
    announce: (r) =>
      `${r.id}: ${usd(r.prev)} before, ${usd(r.last)} now, ${f.number(r.tokensLast, { maximumFractionDigits: 1 })} million tokens`,
  })

  const table = useDataTable({
    id: 'expr-n74-wallets',
    label: 'Verdicts',
    columns: [
      c.entity('id', { header: 'Wallet', mono: true, sub: (r) => r.kind, priority: 1 }),
      c.status('verdict', {
        header: 'Verdict',
        options: VERDICTS,
        labels: VERDICT_WORD,
        tone: (v) => (v === 'most' || v === 'new' ? 'accent' : 'neutral'),
        priority: 1,
      }),
      c.delta('change', {
        header: 'Change',
        currency: 'USD',
        polarity: 'neutral',
        priority: 2,
        card: 'value',
      }),
      c.meter('tokensLast', {
        header: 'Tokens, millions',
        max: s.maxTokens,
        priority: 2,
        card: 'meta',
      }),
    ],
    data: ready ? s.rows : undefined,
    phase,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    bodyRows: 6,
  })

  const topCap = (() => {
    const sorted = s.rows.flatMap((r) => [r.prev, r.last]).toSorted((a, b) => b - a)
    const [first = 0, second = 0] = sorted
    return first > second * 4 ? second * 1.5 : null
  })()

  const series: BarsSeries<Row>[] = [
    {
      mark: 'bar',
      key: 'prev',
      label: 'The window before',
      color: N74_SERIES.other,
      y: (r) => r.prev,
      format: usd,
      values: true,
    },
    {
      mark: 'bar',
      key: 'last',
      label: 'This window',
      color: N74_SERIES.last,
      y: (r) => r.last,
      format: usd,
      values: (v, r) =>
        r.verdict === 'most'
          ? `${usd(v)} ${ratio(r)}`
          : r.verdict === 'new'
            ? `${usd(v)} new`
            : usd(v),
      highlight: (r) => r.verdict === 'most' || r.verdict === 'new',
    },
  ]

  const grower = s.grower
  const fresh = s.fresh[0]
  const dailySeries: LineSeries<Day>[] = [
    ...(grower
      ? [
          {
            mark: 'line' as const,
            key: 'grew',
            label: grower.id,
            color: N74_SERIES.answer,
            y: (d: Day) => d.grew,
            format: usd,
          },
        ]
      : []),
    ...(fresh
      ? [
          {
            mark: 'line' as const,
            key: 'fresh',
            label: fresh.id,
            color: N74_SERIES.answer,
            dash: true,
            y: (d: Day) => d.fresh,
            format: usd,
          },
        ]
      : []),
    {
      mark: 'line',
      key: 'rest',
      label: grower ? 'Rest' : 'Everything',
      color: N74_SERIES.last,
      y: (d: Day) => d.rest,
      format: usd,
    },
  ]
  const silent = s.silent[0]
  const toneOf = (r: Row) =>
    r.verdict === 'most' || r.verdict === 'new' ? ('accent' as const) : ('neutral' as const)
  const restStatus = grower
    ? { tone: 'accent' as const, label: VERDICT_WORD.most }
    : { tone: 'neutral' as const, label: 'None grew' }

  return (
    <Page area="expr-n74">
      <PageBar title="AI wallets, last 30 days against the 30 before" />
      <div className="@container">
        <div className="grid gap-4 @wide:grid-cols-2">
          <ChartCard
            title="Spend by wallet"
            subtitle="US dollars at API prices"
            phase={phase}
            height="tall"
            empty={
              wallets.length === 0
                ? { cause: 'Nothing has made a call yet. Bars appear after the first one.' }
                : null
            }
            legend={[
              {
                key: 'answer',
                label: 'Answers the question',
                color: N74_SERIES.answer,
                swatch: 'bar',
              },
            ]}
            figure={
              ready
                ? {
                    value: grower ? ratio(grower) : 'No growth',
                    unit: grower?.id,
                    delta: grower
                      ? {
                          value: `+${usd(grower.change)}`,
                          polarity: 'neutral',
                          label: 'vs the one before',
                        }
                      : undefined,
                    period: focus.readout(
                      grower
                        ? `${usd(grower.prev)} to ${usd(grower.last)}`
                        : `${usd(s.totalPrev)} to ${usd(s.totalLast)}`,
                      (r) => `${r.id}: ${usd(r.prev)} to ${usd(r.last)}`,
                    ),
                    status: focus.readout(restStatus, (r) => ({
                      tone: toneOf(r),
                      label: VERDICT_WORD[r.verdict],
                    })),
                  }
                : { value: null }
            }
            footer={[
              {
                label: 'New',
                value: ready ? (fresh?.id ?? 'none') : '',
                mono: fresh !== undefined,
              },
              {
                label: 'Silent',
                value: ready ? (silent?.id ?? 'none') : '',
                mono: silent !== undefined,
              },
            ]}
            chart={(box) => (
              <Bars
                label="Per wallet, two windows side by side"
                data={s.rows}
                height={box.height}
                layout="grouped"
                focus={focus}
                tooltip={false}
                x={{ value: (r) => r.id, ticks: s.rows.map((r) => r.id) }}
                y={{
                  title: 'US dollars',
                  format: usd,
                  domain: topCap === null ? { floor: 0, pad: 0.12 } : ([lo]) => [lo, topCap],
                }}
                series={series}
              />
            )}
          />
          <div className="grid gap-4">
            <DataPanel
              title="Wallets"
              subtitle="Fresh tokens, not cache reads"
              phase={phase}
              empty={
                wallets.length === 0
                  ? { cause: 'Nothing is connected. Add a key to list it.' }
                  : null
              }
              bodySize={{ rows: 7 }}
              body={() => <DataTable table={table} focus={focus} height="fill" />}
            />
            <ChartCard
              title="Spend per day"
              subtitle="The answering ones against the rest"
              phase={phase}
              empty={
                wallets.length === 0
                  ? { cause: 'No day has a call. The line starts with the first one.' }
                  : null
              }
              figure={
                ready
                  ? {
                      value: s.takeoff ? f.date(s.takeoff, 'day') : null,
                      unit: s.takeoff && grower ? `${grower.id} took off` : 'No take-off',
                    }
                  : { value: null }
              }
              footer={[
                {
                  label: 'New one begins',
                  value: ready ? (s.start ? f.date(s.start, 'day') : 'none') : '',
                  mono: s.start !== null,
                },
              ]}
              chart={(box) => (
                <Lines
                  label="Per day across both windows"
                  data={s.days}
                  height={box.height}
                  naming="endLabels"
                  x={{ value: (d) => d.at, format: (x) => f.date(new Date(x), 'day') }}
                  y={{ format: usd }}
                  refLines={[
                    {
                      axis: 'x',
                      value: s.boundary,
                      color: N74_SERIES.other,
                      dashed: true,
                      label: f.date(s.boundary, 'day'),
                    },
                  ]}
                  series={dailySeries}
                />
              )}
            />
          </div>
        </div>
      </div>
    </Page>
  )
}
