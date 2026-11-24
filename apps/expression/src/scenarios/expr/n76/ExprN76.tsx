import { useFormat } from 'basalt-ui'
import { BarList, DataPanel } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { Bars, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { N76_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { HOUR_MS, medianPages, snapshotOf } from './fixture'
import type { FailedItem, ItemType, PauseReason, Snapshot } from './fixture'

const TYPE_LABEL: Record<ItemType, string> = {
  tutorial: 'Tutorials',
  course: 'Courses',
  lesson: 'Lessons',
  other: 'Other',
}
const PAUSE_LABEL: Record<PauseReason, string> = {
  throttle: 'Throttle',
  breaker: 'Circuit breaker',
  recycle: 'Recycle',
}
const STATES = [
  { key: 'done', label: 'Done', color: N76_SERIES.done },
  { key: 'fetching', label: 'Fetching', color: N76_SERIES.fetching },
  { key: 'queued', label: 'Queued', color: N76_SERIES.queued },
  { key: 'paused', label: 'Paused', color: N76_SERIES.paused },
  { key: 'dead', label: 'Dead link', color: N76_SERIES.dead },
  { key: 'failed', label: 'Failed', color: N76_SERIES.failed },
] as const
const RATE_LEGEND = [
  { key: 'pages', label: 'Earlier hours', color: N76_SERIES.pages, swatch: 'bar' },
  { key: 'latest', label: 'Latest hour', color: N76_SERIES.latest, swatch: 'bar' },
] as const
/** The most a bar may reach before the kit clamps it with its caret and keeps the true value. */
const RATE_CAP = 600

const c = col<FailedItem>()
const COLUMNS = [
  c.entity('id', { header: 'Item', mono: true, priority: 1 }),
  c.text('reason', { header: 'Reason', priority: 1 }),
  c.status('kind', {
    header: 'Next step',
    priority: 2,
    options: ['failure', 'dead'],
    labels: { failure: 'Retry', dead: 'Skip' },
    tone: (kind) => (kind === 'failure' ? 'bad' : 'neutral'),
  }),
  c.text('type', { header: 'Type', priority: 3, labels: TYPE_LABEL }),
]

const retryRate = (): void => undefined
const retryItems = (): void => undefined
const retryFailed = (): void => undefined
// cycle-expression-16: a frame with no data needs a subtitle to keep its header line, and the kit has no held-subtitle slot
const HELD_SUBTITLE = '\u00a0'

function pauseWord(snap: Snapshot): string | undefined {
  if (snap.status !== 'paused') return undefined
  return snap.reason === null ? 'No reason recorded' : PAUSE_LABEL[snap.reason]
}

export function ExprN76Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const snap = snapshotOf(fixture)
  const rateSource: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The status feed did not answer.', retry: retryRate }
        : 'ready'
  const itemsSource: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The item index did not answer.', retry: retryItems }
        : 'ready'
  const failedSource: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The failure log did not answer.', retry: retryFailed }
        : 'ready'
  const ready = shotState === undefined
  const clock = (at: Date): string =>
    f.time(at, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const stamp = (at: Date): string => `${f.date(at, 'weekday')} ${clock(at)}`

  const lastAt = snap.hours.at(-1)?.at.getTime() ?? 0
  const pagesNow = snap.hours.at(-1)?.pages ?? 0
  const median = medianPages(snap.hours)
  const hourRange = (at: Date): string =>
    `${clock(at)} to ${clock(new Date(at.getTime() + HOUR_MS))}`
  const hourFocus = useChartFocus(snap.hours, {
    announce: (h) => `${hourRange(h.at)}: ${f.number(h.pages)} pages`,
  })
  const typeFocus = useChartFocus(snap.types, {
    announce: (t) => `${TYPE_LABEL[t.type]}: ${t.counts.done} of ${t.total} items`,
  })

  const done = snap.types.reduce((n, t) => n + t.counts.done, 0)
  const total = snap.types.reduce((n, t) => n + t.total, 0)
  const failures = snap.failed.filter((i) => i.kind === 'failure').length
  const dead = snap.failed.length - failures

  const pause = pauseWord(snap)
  const verdict = {
    moving: { tone: 'neutral', label: 'Moving' },
    paused: { tone: snap.reason === null ? 'bad' : 'neutral', label: 'Paused' },
    finished: { tone: 'neutral', label: 'Finished' },
  } as const
  const etaLabel = { moving: 'Finishes', paused: 'Would finish', finished: 'Ended' }[snap.status]
  const etaAt = snap.eta ?? snap.since
  const sign = (n: number): string => (n < 0 ? '\u2212' : n > 0 ? '+' : '')

  const table = useDataTable({
    id: 'n76-failed',
    label: 'Retry and skip list',
    columns: COLUMNS,
    data: snap.failed,
    getRowId: (i) => i.id,
    mode: { kind: 'client' },
    phase: failedSource,
    bodyRows: 8,
    empty: { cause: 'No item failed, so there is nothing to retry or skip.' },
  })

  return (
    <Page area="expr-n76">
      <PageBar title="Course catalogue fetch" />
      <div className="grid gap-3 @wide:grid-cols-2">
        <ChartCard
          title="Fetch rate"
          subtitle="Last 24 hours, UTC"
          phase={rateSource}
          empty={
            shotState === 'empty'
              ? {
                  cause:
                    'No page was fetched in this period. Start the scraper to bank the catalogue.',
                }
              : null
          }
          height="tall"
          legend={RATE_LEGEND}
          figure={{
            value: ready ? f.number(pagesNow) : null,
            unit: 'pages/h',
            delta:
              ready && median !== 0
                ? {
                    value: `${sign(pagesNow - median)}${f.percent(Math.abs(pagesNow / median - 1), { maximumFractionDigits: 0 })}`,
                    polarity: 'neutral',
                    label: 'vs 24 h median',
                  }
                : undefined,
            period: ready
              ? hourFocus.readout(
                  hourRange(new Date(lastAt)),
                  (h) => `${hourRange(h.at)}, ${f.number(h.pages)}`,
                )
              : undefined,
            periodMono: true,
            status: ready ? verdict[snap.status] : undefined,
          }}
          footer={[
            {
              label: ready ? etaLabel : 'Finishes',
              value: ready && etaAt !== null ? stamp(etaAt) : '',
              mono: true,
            },
            { label: 'Done', value: ready ? `${done} of ${total}` : '' },
          ]}
          chart={(box) => (
            <Bars
              label="Throughput by hour"
              data={snap.hours}
              height={box.height}
              focus={hourFocus}
              tooltip={false}
              x={{
                value: (h) => h.at,
                tickFormat: (x) => clock(new Date(x)),
                format: (x) => hourRange(new Date(x)),
                ticks: snap.hours.filter((_, i) => i % 4 === 0).map((h) => h.at),
              }}
              y={{
                title: 'Pages',
                format: (v) => f.number(v),
                domain: ([, hi]) => [0, Math.min(hi, RATE_CAP)],
              }}
              series={[
                {
                  mark: 'bar',
                  key: 'pages',
                  label: 'Rate',
                  color: N76_SERIES.pages,
                  legend: false,
                  y: (h) => h.pages,
                  values: true,
                  format: (v) => f.number(v),
                  highlight: (h) => h.at.getTime() === lastAt,
                },
              ]}
              zones={
                pause === undefined || snap.since === null
                  ? []
                  : [
                      {
                        axis: 'x',
                        from: snap.since,
                        to: new Date(lastAt),
                        fill: alpha(snap.reason === null ? BASALT.bad : BASALT.inkMuted, 0.12),
                        label: pause,
                      },
                    ]
              }
            />
          )}
        />
        <div className="grid gap-3">
          <BarList
            title="Items by type"
            subtitle="Split by state"
            phase={itemsSource}
            empty={
              shotState === 'empty'
                ? {
                    cause:
                      'The catalogue is empty. Add its index page to the seed list to start the queue.',
                  }
                : null
            }
            bodyRows={4}
            focus={typeFocus}
            series={STATES}
            items={snap.types.map((t) => ({
              key: t.type,
              label: TYPE_LABEL[t.type],
              value: t.total,
              secondary: ready ? `${t.counts.done} done` : '',
              parts: t.counts,
            }))}
          />
          <DataPanel
            title="Failed items"
            subtitle={ready ? `${failures} failures, ${dead} dead links` : HELD_SUBTITLE}
            phase={failedSource}
            empty={
              shotState === 'empty'
                ? { cause: 'The scraper has not run yet, so no failure can show.' }
                : null
            }
            bodySize={{ rows: 11 }}
            body={() => (
              <DataTable
                table={table}
                height="fill"
                focusItems={{ focus: typeFocus, holds: (row, t) => row.type === t.type }}
              />
            )}
          />
        </div>
      </div>
      {typeFocus.live}
    </Page>
  )
}
