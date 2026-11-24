import { useMemo } from 'react'
import type { ReactElement } from 'react'
import { useFormat } from 'basalt-ui'
import { DataPanel } from 'basalt-ui/cards'
import type { Empty, Phase } from 'basalt-ui/cards'
import { Bars, ChartCard, Lines, useChartFocus } from 'basalt-ui/charts'
import type { ChartFocus, ChartFigure } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { N75_SERIES } from '../../../demo/series'
import type { ScenarioProps, ShotState } from '../../shot-state'
import { buildFixture } from './fixture'
import type { Fixture, Inquiry, Verdict } from './fixture'

type VerdictItem = { key: Verdict; label: string; count: number }
type Format = ReturnType<typeof useFormat>

const VERDICT_LABEL: Record<Verdict, string> = {
  legit: 'Legit',
  spam: 'Spam',
  marketing: 'Marketing',
}
const VERDICTS = ['legit', 'spam', 'marketing'] as const

// Three sources, so three retries: one shared function would draw one Retry for the page.
const retryFunnel = (): undefined => undefined
const retryTraffic = (): undefined => undefined
const retryInquiries = (): undefined => undefined

function phaseOf(shotState: ShotState | undefined, message: string, retry: () => void): Phase {
  if (shotState === 'loading') return 'loading'
  if (shotState === 'error') return { tag: 'error', message, retry }
  return 'ready'
}

function emptyOf(shotState: ShotState | undefined, cause: string): Empty | null {
  return shotState === 'empty' ? { cause } : null
}

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length

const oneDecimal = { minimumFractionDigits: 1, maximumFractionDigits: 1 } as const

type Reading = Omit<ChartFigure, 'unit'>

/** Every slot a ready figure draws, held with empty values so the frame keeps its height. */
const HELD: Reading = {
  value: '',
  delta: { value: '', polarity: 'neutral', label: '' },
  period: '',
  periodMono: true,
  status: { tone: 'neutral', label: '' },
}

const figureOf = (unit: string, reading: Reading | null): ChartFigure => ({
  unit,
  ...(reading ?? HELD),
})

function share(f: Format, part: number, whole: number): string {
  return whole === 0 ? '\u2014' : f.percent(part / whole, oneDecimal)
}

function FunnelCard({ fx, shotState }: { fx: Fixture; shotState: ShotState | undefined }) {
  const f = useFormat()
  const phase = phaseOf(shotState, 'No step counts arrived from the visit counter.', retryFunnel)
  const ready = phase === 'ready' && shotState !== 'empty'
  const steps = fx.steps
  const site = steps[0]?.count ?? 0
  const sent = steps[3]?.count ?? 0
  const focus = useChartFocus(steps, {
    announce: (s) => `${s.name}: ${f.number(s.count)} of ${f.number(site)}`,
  })
  const days = fx.days
  const rate = fx.total / days.reduce((sum, d) => sum + d.visitors, 0)
  const figure = figureOf(
    'of visitors',
    ready
      ? {
          value: site === 0 ? null : f.percent(sent / site, oneDecimal),
          delta:
            site === 0
              ? undefined
              : {
                  value: `${f.number((sent / site - rate) * 100, { ...oneDecimal, signDisplay: 'exceptZero' })} pts`,
                  polarity: 'up-good',
                  label: `vs 90-day rate, ${f.percent(rate, oneDecimal)}`,
                },
          period: f.date(fx.funnelDay, 'day'),
          periodMono: true,
          status: {
            tone: 'neutral',
            label: focus.readout(
              site === 0
                ? 'Nobody came that day'
                : `${share(f, site - (steps[1]?.count ?? 0), site)} leave at the site`,
              (s) => `${s.name}: ${f.number(s.count)} of ${f.number(site)}`,
            ),
          },
        }
      : null,
  )
  const stepRate = (from: number, to: number): string =>
    ready ? share(f, steps[to]?.count ?? 0, steps[from]?.count ?? 0) : ''
  return (
    <ChartCard
      title="Visitors who send a request"
      subtitle="The four steps of one day"
      info="Share of the day's arrivals who sent the request. Higher is better."
      phase={phase}
      empty={emptyOf(
        shotState,
        'Nobody was counted on this day. The funnel fills when the tracker reports a first visit.',
      )}
      figure={figure}
      footer={[
        { label: 'Started a form', value: stepRate(1, 2) },
        { label: 'Sent after starting', value: stepRate(2, 3) },
      ]}
      height="tall"
      chart={(box) => (
        <Bars
          label="Funnel steps for one day"
          height={box.height}
          data={steps}
          x={{ value: (s) => s.name }}
          y={{ title: 'Reached' }}
          focus={focus}
          tooltip={false}
          cursor="n75-funnel"
          series={[
            {
              mark: 'bar',
              key: 'count',
              label: 'Reached',
              color: N75_SERIES.step,
              y: (s) => s.count,
              format: (v) => f.number(v),
              highlight: (s) => s.key === 'sent',
              values: (v, s) =>
                s.key === 'site' || site === 0
                  ? f.number(v)
                  : `${f.number(v)} \u00b7 ${f.percent(v / site, oneDecimal)}`,
            },
          ]}
        />
      )}
    />
  )
}

function VerdictCard({
  fx,
  shotState,
  items,
  focus,
}: {
  fx: Fixture
  shotState: ShotState | undefined
  items: readonly VerdictItem[]
  focus: ChartFocus<VerdictItem>
}) {
  const f = useFormat()
  const phase = phaseOf(
    shotState,
    'The filter that sorts inquiries did not respond.',
    retryInquiries,
  )
  const ready = phase === 'ready' && shotState !== 'empty'
  const junk = fx.counts.spam + fx.counts.marketing
  const figure = figureOf(
    'spam or marketing',
    ready
      ? {
          value: f.number(junk),
          status: { tone: 'neutral', label: `${share(f, junk, fx.total)} of the total` },
          period: focus.readout(
            'last 90 days',
            (v) => `${v.label}: ${f.number(v.count)} of ${f.number(fx.total)}`,
          ),
        }
      : null,
  )
  return (
    <ChartCard
      title="Inquiries by verdict"
      subtitle="As sorted by the inbox filter"
      info="What the filter made of each message sent through the page."
      phase={phase}
      empty={emptyOf(
        shotState,
        'Nothing has arrived. Check that the form still posts to the inbox.',
      )}
      figure={figure}
      footer={[
        { label: 'Total', value: ready ? f.number(fx.total) : '' },
        { label: 'Previous period', value: ready ? f.number(fx.previous) : '' },
      ]}
      height="tall"
      chart={(box) => (
        <Bars
          label="Counts by verdict"
          height={box.height}
          data={items}
          x={{ value: (v) => v.label }}
          y={{ title: 'Inquiries' }}
          focus={focus}
          tooltip={false}
          cursor="n75-verdict"
          series={[
            {
              mark: 'bar',
              key: 'count',
              label: 'Count',
              color: N75_SERIES.inquiries,
              y: (v) => v.count,
              format: (v) => f.number(v),
              values: true,
            },
          ]}
        />
      )}
    />
  )
}

function TrafficCard({ fx, shotState }: { fx: Fixture; shotState: ShotState | undefined }) {
  const f = useFormat()
  const phase = phaseOf(
    shotState,
    'Daily counts are missing: no figures were reported.',
    retryTraffic,
  )
  const ready = phase === 'ready' && shotState !== 'empty'
  const days = fx.days
  const recent = mean(days.slice(-30).map((d) => d.visitors))
  const before = mean(days.slice(0, -30).map((d) => d.visitors))
  const busiest = days.reduce((a, b) => (b.visitors > a.visitors ? b : a))
  const views = days.reduce((sum, d) => sum + d.views, 0)
  const visitors = days.reduce((sum, d) => sum + d.visitors, 0)
  const figure = figureOf(
    'a day on average',
    ready
      ? {
          value: f.number(recent, { maximumFractionDigits: 0 }),
          delta: {
            value: f.percent(recent / before - 1, {
              signDisplay: 'exceptZero',
              maximumFractionDigits: 0,
            }),
            polarity: 'up-good',
            label: 'vs the 60 days before',
          },
          period: 'last 30 days',
        }
      : null,
  )
  return (
    <ChartCard
      title="Daily traffic"
      subtitle="Daily, zeros kept"
      info="People who came that day; a view is every page they opened."
      phase={phase}
      empty={emptyOf(
        shotState,
        'Nobody was counted in this window. Check that the tracker snippet is on the site.',
      )}
      figure={figure}
      footer={[
        { label: 'Busiest day', value: ready ? f.date(busiest.at, 'day') : '', mono: true },
        {
          label: 'Views per visit',
          value: ready
            ? f.number(views / visitors, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
            : '',
        },
      ]}
      height="short"
      chart={(box) => (
        <Lines
          label="Traffic for each day"
          height={box.height}
          data={days}
          x={{
            value: (d) => d.at,
            format: (x) => f.date(new Date(x), 'short'),
            tickFormat: (x) => f.date(new Date(x), 'day'),
          }}
          y={{ title: 'Per day' }}
          cursor="n75-traffic"
          refLines={[
            {
              axis: 'x',
              value: fx.quietDay,
              color: N75_SERIES.rule,
              dashed: true,
              label: 'Zero visits',
            },
          ]}
          series={[
            {
              mark: 'line',
              key: 'visitors',
              label: 'Visitors',
              color: N75_SERIES.visitors,
              weight: 'strong',
              y: (d) => d.visitors,
              format: (v) => f.number(v),
            },
            {
              mark: 'line',
              key: 'views',
              label: 'Views',
              color: N75_SERIES.views,
              weight: 'quiet',
              y: (d) => d.views,
              format: (v) => f.number(v),
            },
          ]}
        />
      )}
    />
  )
}

const inquiry = col<Inquiry>()

function InquiryTable({
  rows,
  focus,
  phase,
  empty,
}: {
  rows: readonly Inquiry[]
  focus: ChartFocus<VerdictItem>
  phase: Phase
  empty: Empty | null
}) {
  const table = useDataTable({
    id: 'n75-inquiries',
    label: 'Inquiry log',
    columns: [
      inquiry.entity('id', { header: 'Inquiry', mono: true, sub: (r) => r.sender, priority: 1 }),
      inquiry.text('topic', { header: 'Message', priority: 2 }),
      inquiry.status('verdict', {
        header: 'Verdict',
        options: VERDICTS,
        labels: VERDICT_LABEL,
        filter: 'multi',
        priority: 1,
      }),
      inquiry.date('at', { header: 'Received', mono: true, priority: 2 }),
    ],
    data: rows,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase,
    empty,
  })
  return (
    <DataTable
      table={table}
      height="fill"
      focusItems={{ focus, holds: (row, item) => row.verdict === item.key }}
    />
  )
}

function InquiryPanel({
  fx,
  shotState,
  focus,
}: {
  fx: Fixture
  shotState: ShotState | undefined
  focus: ChartFocus<VerdictItem>
}) {
  const phase = phaseOf(shotState, 'The inbox returned no rows.', retryInquiries)
  const ready = phase === 'ready' && shotState !== 'empty'
  const empty = emptyOf(shotState, 'No rows yet. Verdicts appear here as messages arrive.')
  return (
    <DataPanel
      title="Inquiry list"
      subtitle={ready ? `Newest ${fx.rows.length} of ${fx.total}` : 'Newest first'}
      phase={phase}
      empty={empty}
      bodySize={{ rows: 9 }}
      body={() => <InquiryTable rows={fx.rows} focus={focus} phase={phase} empty={empty} />}
    />
  )
}

export function ExprN75Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const fx = useMemo(() => buildFixture(fixture), [fixture])
  const items = useMemo<readonly VerdictItem[]>(
    () => VERDICTS.map((key) => ({ key, label: VERDICT_LABEL[key], count: fx.counts[key] })),
    [fx],
  )
  const focus = useChartFocus(items, {
    announce: (v) => `${v.label}: ${v.count} of ${fx.total}`,
  })
  return (
    <Page area="expr-n75">
      <PageBar title="Charter request page" />
      <CardGrid min="regular">
        <FunnelCard fx={fx} shotState={shotState} />
        <VerdictCard fx={fx} shotState={shotState} items={items} focus={focus} />
      </CardGrid>
      <TrafficCard fx={fx} shotState={shotState} />
      <InquiryPanel fx={fx} shotState={shotState} focus={focus} />
    </Page>
  )
}
