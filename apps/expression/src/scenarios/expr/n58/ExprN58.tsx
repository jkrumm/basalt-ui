import { useFormat } from 'basalt-ui'
import { CartesianChart, ChartCard, Lines, useChartFocus } from 'basalt-ui/charts'
import { text } from '@tanstack/charts/text'
import { DataPanel } from 'basalt-ui/cards'
import { Alert } from 'basalt-ui/ui/alert'
import { Button } from 'basalt-ui/ui/button'
import { BASALT } from 'basalt-ui/tokens'
import type { Phase } from 'basalt-ui/cards'
import type { Delta, Verdict as FigureStatus } from 'basalt-ui/cards'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { CREDIT_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import {
  DAY,
  NOW,
  POOLS,
  hourRows,
  poolRows,
  poolViews,
  sourceViews,
  spendRows,
  variantOf,
} from './fixture'
import type { HourRow, PoolId, PoolKey, PoolRow, PoolView, SourceId, Verdict } from './fixture'

type PoolLine = {
  id: PoolId
  name: string
  verdict: Verdict
  sub: string
  left: number | null
}
type SourceLine = {
  id: SourceId
  name: string
  pool: string
  weekUsd: number
  changePct: number | null
  machine: string
  model: string
}

const pools = col<PoolLine>()
const POOL_COLUMNS = [
  pools.entity('name', { header: 'Pool', sub: (r) => r.sub, sortable: false, priority: 1 }),
  pools.status('verdict', {
    header: 'Outlook',
    options: ['out', 'empty', 'unspent', 'early'],
    labels: { out: 'Runs out', empty: 'Empty', unspent: 'Unspent', early: 'Too early' },
    tone: (v) => (v === 'out' || v === 'empty' ? 'bad' : 'neutral'),
    sortable: false,
    priority: 1,
  }),
  pools.money('left', { header: 'Unspent', currency: 'USD', sortable: false, priority: 2 }),
]

const sources = col<SourceLine>()
const SOURCE_COLUMNS = [
  sources.entity('name', {
    header: 'Source',
    sub: (r) => `${r.machine}, ${r.model}`,
    subMono: true,
    sortable: false,
    priority: 1,
  }),
  sources.money('weekUsd', { header: 'Week', currency: 'USD', sortable: false, priority: 1 }),
  sources.delta('changePct', {
    header: 'Change',
    polarity: 'neutral',
    unit: '%',
    sortable: false,
    priority: 2,
  }),
  sources.text('pool', { header: 'Billed to', sortable: false, priority: 3 }),
]

const POOL_KEYS: readonly Exclude<PoolId, 'batch'>[] = ['team', 'research']
const WEEK_TICKS: readonly Date[] = Array.from(
  { length: 7 },
  (_, i) => new Date(NOW - (NOW % DAY) - (6 - i) * DAY),
)
const SPEND_CAP = 1
const LEAD = 'Review bot'
const REST = 'Other sources'
const HELD_DELTA: Delta = { value: '', polarity: 'neutral', label: '' }

export function ExprN58Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const variant = variantOf(fixture)
  const ready = shotState === undefined
  const phase: Phase =
    shotState === 'loading' ? 'loading' : shotState === 'error' ? { tag: 'error' } : 'ready'
  const rows = shotState === 'empty' ? [] : spendRows(variant)
  const views = poolViews(rows)
  const dayRows = poolRows(views)
  const hours = hourRows(rows)
  const sourceList = sourceViews(rows)

  const day = (ms: number): string => f.date(ms, 'short', { year: undefined })
  const usd = (v: number): string => f.money(v, 'USD', { maximumFractionDigits: 0 })
  const usdHour = (v: number): string => f.money(v, 'USD')
  const clock = (d: Date): string =>
    `${f.date(d, 'weekday')} ${f.time(d, { hour: '2-digit', minute: '2-digit', hour12: false })}`

  const poolFocus = useChartFocus(dayRows, {
    announce: (d) =>
      POOL_KEYS.map((id) => {
        const v = d[id]
        return v === null
          ? null
          : `${POOLS.find((p) => p.id === id)?.name ?? id} ${Math.round(v)} %`
      })
        .filter((s) => s !== null)
        .join(', ')
        .replace(/^/, `Day ${d.day}: `),
  })
  const sourceFocus = useChartFocus(hours, {
    announce: (d) => `${clock(d.at)}: ${LEAD} ${usdHour(d.review)}, ${REST} ${usdHour(d.others)}`,
  })

  const lead = views.find((v) => v.verdict === 'empty') ?? views.find((v) => v.verdict === 'out')
  const top = sourceList[0]
  const total = rows.length === 0 ? 0 : views.reduce((s, v) => s + v.spent, 0)
  const size = POOLS.reduce((s, p) => s + p.size, 0)
  const weekTotal = sourceList.reduce((s, v) => s + v.weekUsd, 0)
  const capped = hours
    .flatMap((h) => [
      { at: h.at, usd: h.review },
      { at: h.at, usd: h.others },
    ])
    .filter((p) => p.usd > SPEND_CAP)
    .sort((a, b) => b.usd - a.usd)
  const worst = capped[0]

  const poolLines: PoolLine[] = views.map((v) => ({
    id: v.pool.id,
    name: v.pool.name,
    verdict: v.verdict,
    sub:
      v.verdict === 'early'
        ? `${Math.round(v.usedPct)} % of ${usd(v.pool.size)}, ${v.dataHours} h of data`
        : `${Math.round(v.usedPct)} % of ${usd(v.pool.size)}, to ${day(v.pool.end)}`,
    left: v.leftAtEnd,
  }))
  const sourceLines: SourceLine[] = sourceList.map((v) => ({
    id: v.source.id,
    name: v.source.name,
    pool: v.poolName,
    weekUsd: v.weekUsd,
    changePct: v.changePct === null ? null : Math.round(v.changePct),
    machine: v.machine,
    model: v.model,
  }))

  const poolTable = useDataTable({
    id: 'credit-pools',
    label: 'Outlook table',
    columns: POOL_COLUMNS,
    data: poolLines,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  const sourceTable = useDataTable({
    id: 'credit-sources',
    label: 'Weekly ranking',
    columns: SOURCE_COLUMNS,
    data: sourceLines,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })

  /** What a pool's outlook says after its name, and the short form a narrow plot keeps. */
  const tailOf = (v: PoolView): { tail: string; short: string } => {
    if (v.verdict === 'empty')
      return { tail: `empty since ${day(v.emptyAt ?? NOW)}`, short: 'empty' }
    if (v.verdict === 'out') return { tail: `out ${day(v.emptyAt ?? NOW)}`, short: 'out' }
    return {
      tail: `${usd(v.leftAtEnd ?? 0)} left at expiry`,
      short: `${usd(v.leftAtEnd ?? 0)} left`,
    }
  }
  const sentence = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1)
  const named = (v: PoolView, t: string): string => `${v.pool.name}, ${t}`
  const outlook = (v: PoolView): string => named(v, tailOf(v).tail)

  const poolSeries = views
    .filter((v) => v.verdict !== 'early')
    .flatMap((v) => {
      const id = v.pool.id === 'research' ? 'research' : 'team'
      const proj: PoolKey = `${id}Proj`
      const line = {
        mark: 'line' as const,
        key: id,
        label: v.pool.name,
        color: CREDIT_SERIES[id],
        y: (d: PoolRow) => d[id],
        format: (n: number) => `${Math.round(n)} %`,
        gaps: 'connect' as const,
        ...(id === 'team' ? { weight: 'strong' as const } : {}),
      }
      const carried = {
        mark: 'line' as const,
        key: proj,
        label: v.pool.name,
        color: CREDIT_SERIES[id],
        y: (d: PoolRow) => d[proj],
        dash: true,
        parent: id,
        legend: false as const,
        tooltip: false as const,
        gaps: 'connect' as const,
      }
      return v.verdict === 'out' || v.verdict === 'unspent' ? [line, carried] : [line]
    })

  /** Where each drawn pool's answer is written: the end of its line, in cycle days and percent. */
  const answers = views.flatMap((v) => {
    if (v.verdict === 'early') return []
    const { tail, short } = tailOf(v)
    const unspent = v.verdict === 'unspent'
    return [
      {
        key: v.pool.id,
        text: unspent ? named(v, short) : sentence(tail),
        short: sentence(short),
        x: unspent ? 30 : ((v.emptyAt ?? NOW) - v.pool.start) / DAY,
        y: unspent ? ((v.pool.size - (v.leftAtEnd ?? 0)) / v.pool.size) * 100 : 100,
      },
    ]
  })

  const sourceSeries = [
    {
      mark: 'line' as const,
      key: 'review',
      label: LEAD,
      color: CREDIT_SERIES.review,
      y: (d: HourRow) => d.review,
      format: (v: number) => usdHour(v),
      weight: 'strong' as const,
    },
    {
      mark: 'line' as const,
      key: 'others',
      label: REST,
      color: CREDIT_SERIES.others,
      y: (d: HourRow) => d.others,
      format: (v: number) => usdHour(v),
    },
  ]

  const earlier = lead?.earlierRate ?? null
  const leadDelta: Delta | undefined =
    lead?.verdict === 'out' && earlier !== null && earlier > 0
      ? {
          value: `+${Math.round((lead.rate / earlier - 1) * 100)} %`,
          polarity: 'up-bad',
          label: 'vs before',
        }
      : undefined
  const leadStatus: FigureStatus | undefined = lead
    ? {
        tone: 'bad',
        label: `${Math.round((lead.pool.end - (lead.emptyAt ?? lead.pool.end)) / DAY)} days early`,
      }
    : undefined
  const topDelta: Delta | undefined =
    top && top.changePct !== null
      ? {
          value: `${top.changePct >= 0 ? '+' : '\u2212'}${Math.abs(Math.round(top.changePct))} %`,
          polarity: 'neutral',
          label: 'vs 4 days before',
        }
      : undefined

  return (
    <Page area="expr-n58">
      <PageBar title="API credit, cycle to date" />
      {/* cycle-expression-13: each frame draws its own error arm and the kit offers no page-level error source, so one banner holds the shared cause and the one Retry and the frames pass no retry */}
      {shotState === 'error' ? (
        <Alert tone="bad" title="Could not load the figures">
          <p className="m-0">The billing API did not answer.</p>
          <Button variant="secondary" size="sm" onClick={() => undefined}>
            Retry
          </Button>
        </Alert>
      ) : null}
      <div className="@container">
        <div className="grid gap-4 @wide:grid-cols-2">
          <div className="flex flex-col gap-4">
            <ChartCard
              title="Pool use before expiry"
              subtitle="Share used by day; dashed carries the last 3 days on"
              phase={phase}
              empty={
                rows.length === 0
                  ? { cause: 'No spend yet this cycle. Lines start with the first bill.' }
                  : null
              }
              height="tall"
              figure={{
                value: ready ? (lead ? outlook(lead) : 'All pools last') : '',
                delta: ready ? leadDelta : HELD_DELTA,
                status: ready ? leadStatus : { tone: 'neutral', label: '' },
              }}
              footer={[
                { label: `Spent of ${usd(size)}`, value: ready ? usd(total) : '' },
                {
                  label: 'Carried on',
                  value: ready ? (lead ? `${usd(lead.rate * 24)} a day` : 0) : '',
                },
              ]}
              chart={() => (
                <CartesianChart
                  label="Used share by day"
                  data={dayRows}
                  focus={poolFocus}
                  x={{
                    value: (d) => d.day,
                    domain: [0, 30],
                    ticks: [0, 10, 20, 30],
                    title: 'Cycle day, expiry at 30',
                    format: (x) => String(Math.round(Number(x) * 10) / 10),
                  }}
                  tooltip={{ formatHeader: (d) => `Day ${Math.round(d.day * 10) / 10}` }}
                  y={{ domain: { floor: 0, ceil: 100, pad: 0.04 }, title: 'Used, %' }}
                  series={poolSeries}
                  refLines={[
                    { value: 100, color: CREDIT_SERIES.limit, dashed: true },
                    { value: 30, axis: 'x', color: CREDIT_SERIES.limit, dashed: true },
                  ]}
                  marks={CartesianChart.custom<PoolRow>((plot) => {
                    // cycle-expression-13: no kit end label that carries a custom end value, so each pool's answer is a text mark at its line's end, offset by hand (chartLabels.place dropped the Research label next to the Team one); the Team caption is dropped on a narrow plot, where the hero says the date
                    const shown = answers.filter((a) => a.key !== 'team' || plot.plotWidth > 400)
                    return [
                      text(shown, {
                        x: (a) => a.x,
                        y: (a) => a.y,
                        text: (a) => (plot.plotWidth > 400 ? a.text : a.short),
                        dx: (a) => (a.key === 'team' ? 8 : -8),
                        dy: (a) => (a.key === 'team' ? 10 : -6),
                        anchor: (a) => (a.key === 'team' ? 'start' : 'end'),
                        fill: BASALT.ink,
                        fontSize: BASALT.text.micro,
                      }),
                    ]
                  })}
                />
              )}
            />
            <DataPanel
              title="Pools"
              subtitle="A projection needs 24 hours of data"
              phase={phase}
              empty={
                rows.length === 0
                  ? { cause: 'Nothing is set up. Add one to see its outlook.' }
                  : null
              }
              bodySize={{ rows: 4 }}
              body={() => (
                <DataTable
                  table={poolTable}
                  height="fill"
                  focusSeries={{ focus: poolFocus, key: (r) => r.id }}
                />
              )}
            />
          </div>
          <div className="flex flex-col gap-4">
            <ChartCard
              title="Spend by source"
              subtitle="Dollars an hour, past week, UTC"
              phase={phase}
              empty={
                rows.length === 0
                  ? { cause: 'No charge this week. Check that billing reports in.' }
                  : null
              }
              height="tall"
              figure={{
                value: ready && top ? `${top.source.name}, ${usd(top.weekUsd)}` : '',
                delta: ready ? topDelta : HELD_DELTA,
                period:
                  ready && top
                    ? `${Math.round((top.weekUsd / weekTotal) * 100)} % of all spend`
                    : '',
              }}
              footer={[
                { label: 'Total', value: ready ? usd(weekTotal) : '' },
                {
                  label: `Over ${usdHour(SPEND_CAP)}`,
                  value: ready
                    ? worst
                      ? `${clock(worst.at)}${capped.length > 1 ? ` +${capped.length - 1}` : ''}`
                      : 0
                    : '',
                  mono: true,
                },
              ]}
              chart={() => (
                <Lines
                  label="Hourly dollars of the leader and the rest"
                  data={hours}
                  focus={sourceFocus}
                  x={{
                    value: (d) => d.at,
                    ticks: WEEK_TICKS,
                    format: (x) => (x instanceof Date ? f.date(x, 'weekday') : String(x)),
                  }}
                  y={{
                    domain: ([lo, hi]) => [lo, Math.min(hi, SPEND_CAP)],
                    title: 'Dollars',
                    format: (v) => usdHour(v),
                  }}
                  series={sourceSeries}
                  naming="endLabels"
                />
              )}
            />
            <DataPanel
              title="Sources"
              subtitle="Largest first"
              phase={phase}
              empty={
                rows.length === 0
                  ? { cause: 'No rows to rank yet. They appear once something bills.' }
                  : null
              }
              bodySize={{ rows: 6 }}
              body={() => (
                <DataTable
                  table={sourceTable}
                  height="fill"
                  focusSeries={{
                    focus: sourceFocus,
                    key: (r) => (r.id === 'review' ? 'review' : 'others'),
                  }}
                />
              )}
            />
          </div>
        </div>
      </div>
    </Page>
  )
}
