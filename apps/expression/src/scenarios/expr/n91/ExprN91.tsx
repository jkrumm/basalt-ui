import {
  Braces,
  Coins,
  FileX,
  Hourglass,
  History,
  Library,
  TriangleAlert,
  Unlink,
  WifiOff,
} from 'lucide-react'
import { useFormat } from 'basalt-ui'
import { BarList, DataPanel, StatCell, StatGroup } from 'basalt-ui/cards'
import type { Delta, Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, Sparkline, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar, PageSummary } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { alpha, BASALT } from 'basalt-ui/tokens'
import { N91_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { DAY_MS, NOW, REASONS, buildLibrary, variantOf } from './fixture'
import type { BillCause, Day, Entry, Kind } from './fixture'

const KIND_LABEL: Readonly<Record<Kind, string>> = {
  transport: 'Transport error',
  model: 'Model error',
  waiting: 'Waiting',
  older: 'Older schema',
  orphaned: 'Orphaned',
  unreadable: 'Unreadable',
}
const KINDS = Object.keys(KIND_LABEL) as Kind[]
const KIND_ICON = {
  transport: WifiOff,
  model: Braces,
  waiting: Hourglass,
  older: History,
  orphaned: Unlink,
  unreadable: FileX,
} as const satisfies Record<Kind, unknown>
const KIND_TONE = {
  transport: 'bad',
  model: 'bad',
  orphaned: 'bad',
  unreadable: 'bad',
  older: 'accent',
  waiting: 'neutral',
} as const satisfies Record<Kind, string>

const BILL_OF: Readonly<Record<Kind, BillCause | null>> = {
  waiting: 'waiting',
  transport: 'retry',
  model: 'retry',
  older: 'schema',
  orphaned: null,
  unreadable: null,
}

const REASON_LABEL: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(REASONS).map(([key, reason]) => [key, reason.label]),
)

const c = col<Entry>()
const COLUMNS = [
  c.entity('title', {
    header: 'Entry',
    priority: 1,
    sub: (e) => e.id,
    subMono: true,
    filter: 'text',
  }),
  c.status('kind', {
    header: 'State',
    priority: 1,
    card: 'value',
    options: KINDS,
    labels: KIND_LABEL,
    tone: (kind) => KIND_TONE[kind],
    icon: (e) => KIND_ICON[e.kind],
    filter: 'multi',
  }),
  c.text('reason', { header: 'Reason', priority: 2, card: 'detail', labels: REASON_LABEL }),
  c.money('bill', { header: 'Bill', currency: 'USD', priority: 2, card: 'meta' }),
  c.relativeTime('at', { header: 'Last attempt', priority: 3, mono: true, card: 'detail' }),
]

const HELD: Delta = { value: '', polarity: 'neutral', label: '' }
const retryModel = (): void => undefined
const retryUsage = (): void => undefined

const weekBase = (n: number): string => `vs ${n} a week ago`
const signed = (n: number): string => (n === 0 ? '0' : `${n > 0 ? '+' : '−'}${Math.abs(n)}`)

function phaseOf(shotState: ScenarioProps['shotState'], retry: () => void, message: string): Phase {
  if (shotState === 'loading') return 'loading'
  if (shotState === 'error') return { tag: 'error', retry, message }
  return 'ready'
}

/** The peak failure day is capped only when one day would flatten the rest. */
function failureCap(failedPerDay: readonly number[]): number | undefined {
  const sorted = [...failedPerDay].sort((a, b) => a - b)
  const typical = sorted[Math.floor(sorted.length * 0.75)] ?? 0
  const peak = sorted.at(-1) ?? 0
  return peak > 4 * Math.max(typical, 1) ? Math.max(typical, 1) * 3 : undefined
}

export function ExprN91Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const lib = buildLibrary(variantOf(fixture))
  const none = shotState === 'empty'
  const modelPhase = phaseOf(shotState, retryModel, 'The library index did not answer.')
  const usagePhase = phaseOf(shotState, retryUsage, 'The usage log did not answer.')
  const ready = modelPhase === 'ready' && usagePhase === 'ready'
  const usd = (n: number): string => f.money(n, 'USD')
  const usdSigned = (n: number): string =>
    n === 0 ? usd(0) : `${n > 0 ? '+' : '−'}${usd(Math.abs(n))}`

  const rows = none ? [] : lib.entries
  const days = lib.days
  const quiet = lib.spent === 0 && days.every((d) => d.cache === null)
  const noEntries = {
    cause: 'The library is empty. Import something to begin.',
  }
  const noSweep = {
    cause: 'No sweep has run yet. Start one to fill this chart.',
  }
  const noPrice = { cause: 'No entry is priced yet. Enrich one to set the price.' }

  const entryFocus = useChartFocus(rows, {
    announce: (e) =>
      `${e.id}: ${KIND_LABEL[e.kind]}${e.bill === null ? '' : `, bills ${usd(e.bill)}`}`,
  })
  const cacheText = (d: Day): string => (d.cache === null ? 'none' : f.percent(d.cache))
  const dayFocus = useChartFocus(days, {
    announce: (d) => `${f.date(d.at, 'day')}: ${usd(d.spend)} spent, ${cacheText(d)} cached`,
  })

  const table = useDataTable({
    id: 'library-entries',
    label: 'Unfinished entries',
    columns: COLUMNS,
    data: rows,
    getRowId: (e) => e.id,
    mode: { kind: 'client' },
    phase: modelPhase,
    bodyRows: 9,
    phone: 'columns',
    now: NOW,
    empty: none ? noEntries : null,
  })

  const billRows =
    lib.bills === null
      ? []
      : [
          {
            key: 'waiting',
            label: KIND_LABEL.waiting,
            value: lib.bills.waiting,
            color: N91_SERIES.waiting,
          },
          { key: 'retry', label: 'Retries', value: lib.bills.retry, color: N91_SERIES.retry },
          {
            key: 'schema',
            label: KIND_LABEL.older,
            value: lib.bills.schema,
            color: N91_SERIES.schema,
          },
        ]
  const spark = days.map((d) => d.enriched)
  const failedPerDay = days.map((d) => d.failed)
  const billed = lib.billTotal
  const spend7Start = days[days.length - 7]?.at
  const rest7 =
    spend7Start === undefined
      ? ''
      : `${f.date(spend7Start, 'day')} to ${f.date(days[days.length - 1]?.at ?? spend7Start, 'day')}`
  const idle = days.find((d) => d.cache === null)

  return (
    <Page area="expr-n91">
      <PageBar title="Library enrichment" />
      {modelPhase === 'ready' ? (
        <PageSummary
          sentence={
            none
              ? 'Nothing to count yet'
              : lib.lagMin === 0
                ? 'Counts match the sweep'
                : `Counts trail the sweep by ${lib.lagMin} min`
          }
        />
      ) : (
        <PageSummary phase={modelPhase} />
      )}
      <StatGroup variant="cards" label="Enrichment pass">
        <StatCell
          icon={Library}
          label="Enriched"
          value={ready ? lib.enriched : undefined}
          unit={ready ? `of ${f.number(lib.total)} entries` : undefined}
          delta={
            ready
              ? {
                  value: signed(lib.enriched - lib.weekAgo.enriched),
                  polarity: 'up-good',
                  label: weekBase(lib.weekAgo.enriched),
                }
              : HELD
          }
          chart={(box) => (
            <Sparkline series={spark} height={box.height} label="Running total enriched each day" />
          )}
          rows={[
            { label: KIND_LABEL.waiting, value: ready ? lib.waiting : '' },
            { label: KIND_LABEL.older, value: ready ? lib.older : '' },
          ]}
          phase={modelPhase}
          empty={none ? noEntries : null}
        />
        <StatCell
          icon={TriangleAlert}
          label="Failed"
          value={ready ? lib.failed : undefined}
          delta={
            ready
              ? {
                  value: signed(lib.failed - lib.weekAgo.failed),
                  polarity: 'up-bad',
                  label: weekBase(lib.weekAgo.failed),
                }
              : HELD
          }
          chart={(box) => (
            <Sparkline
              series={failedPerDay}
              cap={failureCap(failedPerDay)}
              height={box.height}
              label="Failures each day"
            />
          )}
          rows={[
            { label: KIND_LABEL.transport, value: ready ? lib.transport : '' },
            { label: KIND_LABEL.model, value: ready ? lib.model : '' },
          ]}
          phase={modelPhase}
          empty={none ? noEntries : null}
        />
        <StatCell
          icon={Coins}
          label="Still to bill"
          value={ready && billed !== null ? usd(billed) : undefined}
          delta={
            ready && billed !== null && lib.spent > 0
              ? {
                  value: usdSigned(billed - lib.spent),
                  polarity: 'neutral',
                  label: 'vs spent so far',
                }
              : HELD
          }
          meter={{
            label: 'Pass progress by cost',
            value: ready && billed !== null ? lib.spent : null,
            max: ready && billed !== null ? lib.spent + billed : 1,
            format: usd,
          }}
          rows={[
            {
              label: 'Mean price',
              value:
                ready && lib.priceEach !== null
                  ? f.money(lib.priceEach, 'USD', { maximumFractionDigits: 3 })
                  : '',
            },
            { label: 'Unpriced, left out', value: ready ? lib.unpriced : '' },
          ]}
          phase={usagePhase}
          empty={none ? noEntries : lib.billTotal === null ? noPrice : null}
        />
      </StatGroup>

      <div className="grid gap-3 @wide:grid-cols-2">
        <div className="flex flex-col gap-3">
          <BarList
            title="Why entries fail"
            subtitle="Failed or unreachable"
            phase={modelPhase}
            empty={
              none
                ? noEntries
                : lib.reasons.length === 0
                  ? { cause: 'Nothing has failed. Causes show here when something does.' }
                  : null
            }
            bodyRows={7}
            items={lib.reasons.map((r) => ({
              key: r.key,
              label: REASONS[r.key].label,
              value: r.count,
              parts: { [REASONS[r.key].kind]: r.count },
            }))}
            series={[
              { key: 'transport', label: KIND_LABEL.transport, color: N91_SERIES.transport },
              { key: 'model', label: KIND_LABEL.model, color: N91_SERIES.model },
              { key: 'unreachable', label: 'Unreachable', color: N91_SERIES.unreachable },
            ]}
            focusItems={{ focus: entryFocus, holds: (row, e) => e.reason === row.key }}
          />
          <BarList
            title="Bill by cause"
            subtitle="A schema change bills again"
            phase={usagePhase}
            empty={none ? noEntries : lib.bills === null ? noPrice : null}
            bodyRows={3}
            legend={false}
            format={usd}
            items={billRows.map((r) => ({
              key: r.key,
              label: r.label,
              value: r.value,
              parts: { [r.key]: r.value },
            }))}
            series={billRows.map((r) => ({ key: r.key, label: r.label, color: r.color }))}
            focusItems={{ focus: entryFocus, holds: (row, e) => BILL_OF[e.kind] === row.key }}
          />
        </div>
        <ChartCard
          title="Spend and cache hits by day"
          subtitle="Last 30 UTC days"
          phase={usagePhase}
          empty={none ? noEntries : quiet ? noSweep : null}
          height="tall"
          figure={
            ready
              ? {
                  value: usd(lib.spend7),
                  delta: {
                    value: usdSigned(lib.spend7 - lib.spendPrev7),
                    polarity: 'neutral',
                    label: `vs ${usd(lib.spendPrev7)} before`,
                  },
                  period: dayFocus.readout(
                    rest7,
                    (d) => `${f.date(d.at, 'day')}  ${usd(d.spend)}  ${cacheText(d)}`,
                  ),
                  periodMono: true,
                }
              : { value: null, delta: HELD, period: '', periodMono: true }
          }
          panes={[
            {
              chart: (box) => (
                <CartesianChart
                  label="US dollars billed each day"
                  data={days}
                  height={box.height}
                  focus={dayFocus}
                  tooltip={false}
                  x={{ value: (d) => d.at }}
                  y={{ title: 'US dollars', format: (v) => usd(v) }}
                  series={[
                    {
                      mark: 'bar',
                      key: 'spend',
                      label: 'Spend',
                      color: N91_SERIES.spend,
                      y: (d) => d.spend,
                      format: (v) => usd(v),
                      values: true,
                    },
                  ]}
                />
              ),
            },
            {
              chart: (box) => (
                <CartesianChart
                  label="Cache served each day"
                  data={days}
                  height={box.height}
                  focus={dayFocus}
                  tooltip={false}
                  x={{ value: (d) => d.at }}
                  y={{
                    title: 'Share of reads',
                    domain: [0, 1],
                    format: (v) => f.percent(v),
                  }}
                  series={[
                    {
                      mark: 'line',
                      key: 'cache',
                      label: 'Hit rate',
                      color: N91_SERIES.cache,
                      y: (d) => d.cache,
                      format: (v) => f.percent(v),
                    },
                  ]}
                  zones={
                    idle === undefined
                      ? []
                      : [
                          {
                            axis: 'x',
                            from: idle.at,
                            to: new Date(idle.at.getTime() + DAY_MS),
                            fill: alpha(BASALT.inkMuted, 0.12),
                            label: 'No reads',
                          },
                        ]
                  }
                />
              ),
            },
          ]}
        />
      </div>

      <DataPanel
        title="Work left"
        subtitle={entryFocus.readout(
          'Everything not enriched or out of date',
          (e) => `${e.id}: ${KIND_LABEL[e.kind]}${e.bill === null ? '' : `, bills ${usd(e.bill)}`}`,
        )}
        phase={modelPhase}
        empty={none ? noEntries : null}
        bodySize={{ rows: 10 }}
        body={() => <DataTable table={table} focus={entryFocus} />}
      />
      {entryFocus.live}
    </Page>
  )
}
