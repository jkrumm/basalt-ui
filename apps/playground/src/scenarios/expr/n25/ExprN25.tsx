import { text } from '@tanstack/charts/text'
import { DataPanel } from 'basalt-ui/cards'
import type { Empty, Phase } from 'basalt-ui/cards'
import { useFormat } from 'basalt-ui'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import type { ReactElement } from 'react'

import { READING_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { STALL_DAYS, readingLog } from './fixture'
import type { Book, ReadingLog } from './fixture'

const DAY = 86_400_000
const YEAR_START = Date.UTC(2026, 0, 1)
const YEAR_END = Date.UTC(2026, 11, 31)

/**
 * One item of the chart and of the table: a finish (a step of the line), a started book (a dot at
 * its last-read day) or an edge of the year. The chart and the table share one focus over these.
 */
type Point = {
  id: string
  kind: 'edge' | 'finish' | 'book'
  at: Date
  /** Books read by this day; null after today. */
  finished: number | null
  pace: number
  title: string
  sub: string
  state: 'stalled' | 'reading' | 'none'
  idle: number
}

const noop = (): void => {}

function pointsOf(log: ReadingLog): readonly Point[] {
  const today = log.today.getTime()
  const paceAt = (ms: number): number => (log.goal * (ms - YEAR_START)) / (YEAR_END - YEAR_START)
  const done = log.books.flatMap((b) =>
    b.finished === null ? [] : [{ id: b.id, at: Date.parse(b.finished), title: b.title }],
  )
  const countAt = (ms: number): number => done.filter((d) => d.at <= ms).length
  const base = { sub: '', state: 'none', idle: 0 } as const
  const edge = (id: string, ms: number, title: string, finished: number | null): Point => ({
    ...base,
    id,
    kind: 'edge',
    at: new Date(ms),
    finished,
    pace: paceAt(ms),
    title,
  })
  const finishes = done.map((d): Point => ({
    ...base,
    id: `finish-${d.id}`,
    kind: 'finish',
    at: new Date(d.at),
    finished: countAt(d.at),
    pace: paceAt(d.at),
    title: d.title,
  }))
  const books = log.books
    .filter((b): b is Book & { lastRead: string } => b.status === 'reading' && b.lastRead !== null)
    .map((b): Point => {
      const ms = Date.parse(b.lastRead)
      const idle = Math.round((today - ms) / DAY)
      return {
        id: b.id,
        kind: 'book',
        at: new Date(ms),
        finished: countAt(ms),
        pace: paceAt(ms),
        title: b.title,
        sub: `${idle} ${idle === 1 ? 'day' : 'days'} idle`,
        state: idle >= STALL_DAYS ? 'stalled' : 'reading',
        idle,
      }
    })
  return [
    edge('start', YEAR_START, 'Start of year', 0),
    ...finishes,
    ...books,
    edge('today', today, 'Today', countAt(today)),
    edge('end', YEAR_END, 'End of year', null),
  ].toSorted((a, b) => a.at.getTime() - b.at.getTime())
}

const entry = col<Point>()

function StartedTable({
  rows,
  focus,
}: {
  rows: readonly Point[]
  focus: ReturnType<typeof useChartFocus<Point>>
}): ReactElement {
  const table = useDataTable({
    id: 'expr-n25-started',
    label: 'Started books',
    columns: [
      entry.entity('title', { header: 'Book', sub: (r) => r.sub, priority: 1 }),
      entry.status('state', {
        header: 'State',
        options: ['stalled', 'reading', 'none'],
        labels: { stalled: 'Stalled', reading: 'Reading', none: '' },
        tone: (s) => (s === 'stalled' ? 'bad' : 'neutral'),
        priority: 1,
      }),
    ],
    data: rows,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phone: 'scroll',
  })
  return <DataTable table={table} height="auto" focus={focus} />
}

export function ExprN25Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const fmt = useFormat()
  const log = readingLog(fixture)
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The reading log did not respond.', retry: noop }
        : 'ready'
  const logged = shotState === 'empty' ? { ...log, books: [] } : log
  const ready = phase === 'ready'
  const hasBooks = logged.books.length > 0

  const points = ready ? pointsOf(logged) : []
  const todayMs = log.today.getTime()
  const finished = ready ? logged.books.filter((b) => b.status === 'read').length : 0
  const expected = Math.round((log.goal * (todayMs - YEAR_START)) / (YEAR_END - YEAR_START))
  const gap = finished - expected
  const lastFinished = ready
    ? (logged.books
        .flatMap((b) => (b.finished === null ? [] : [b.finished]))
        .toSorted()
        .at(-1) ?? null)
    : null
  const daysLeft = Math.round((YEAR_END - todayMs) / DAY)
  const perMonth = (Math.max(log.goal - finished, 0) / daysLeft) * 30.4

  const verdict = (done: number) =>
    done >= log.goal ? ({ tone: 'good', label: 'Goal met' } as const) : undefined
  const deltaOf = (g: number) =>
    ({
      value: g === 0 ? '0' : `${g > 0 ? '+' : '−'}${Math.abs(g)}`,
      polarity: 'up-good',
      label: 'vs pace',
    }) as const
  const short = (d: Date) => fmt.date(d, 'short', { year: undefined })

  const focus = useChartFocus(points, {
    announce: (p) =>
      p.kind === 'book'
        ? `${p.title}: ${p.sub}${p.state === 'stalled' ? ', stalled' : ''}`
        : p.kind === 'finish'
          ? `${short(p.at)}: finished ${p.title}, ${p.finished} read, pace ${fmt.number(p.pace, { maximumFractionDigits: 1 })}`
          : `${short(p.at)}: ${p.title}, pace ${fmt.number(p.pace, { maximumFractionDigits: 1 })}`,
  })

  const rows = points.filter((p) => p.kind === 'book').toSorted((a, b) => b.idle - a.idle)
  const stalled = rows.filter((r) => r.state === 'stalled').length
  const sizeRows = (rows.length === 0 ? 5 : rows.length) + 1

  const chartEmpty: Empty | null =
    shotState === 'empty'
      ? { cause: 'No books logged for 2026. Log a finished book to start the pace line.' }
      : null
  const tableEmpty: Empty | null =
    shotState === 'empty'
      ? { cause: 'No books logged for 2026. Start one from your want-to-read list.' }
      : ready && rows.length === 0
        ? { cause: 'No book is started. Pick one from your want-to-read list.' }
        : null

  return (
    <Page>
      <div className="flex min-w-0 flex-col gap-4" data-testid="n25-root">
        <PageBar title="Reading, 2026" />
        <div className="grid min-w-0 gap-4 @wide:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <ChartCard
            title="Books finished"
            phase={phase}
            empty={chartEmpty}
            figure={
              !(ready || shotState === 'loading') || !hasBooks
                ? undefined
                : {
                    // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n25, kept as its builder left it: its figure follows focus, built before figure-readout
                    value: focus.readout(finished, (p) => p.finished ?? '—'),
                    unit: `of ${log.goal} books`,
                    // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n25, kept as its builder left it: its figure follows focus, built before figure-readout
                    delta: focus.readout(deltaOf(gap), (p) =>
                      p.finished === null ? undefined : deltaOf(p.finished - Math.round(p.pace)),
                    ),
                    status: finished >= log.goal ? verdict(finished) : undefined,
                    period: focus.readout(
                      `to ${short(log.today)}`,
                      (p) => `${short(p.at)}: ${p.title}`,
                    ),
                  }
            }
            footer={
              shotState === 'loading'
                ? [
                    { label: 'Needed from here', value: '' },
                    { label: 'Last finished', value: '' },
                  ]
                : [
                    perMonth > 0 && ready && hasBooks
                      ? {
                          label: 'Needed from here',
                          value: `${fmt.number(perMonth, { maximumFractionDigits: 1 })} a month`,
                        }
                      : null,
                    lastFinished === null
                      ? null
                      : {
                          label: 'Last finished',
                          value: fmt.date(Date.parse(lastFinished), 'short', { year: undefined }),
                        },
                  ]
            }
            chart={() => (
              <CartesianChart
                label="Books finished through the year against an even pace to the goal, with each started book at its last-read day"
                data={points}
                x={{ value: (p) => p.at, domain: [new Date(YEAR_START), new Date(YEAR_END)] }}
                y={{ title: 'Books', domain: { floor: 0, ceil: log.goal + 2 } }}
                series={[
                  {
                    mark: 'line',
                    key: 'pace',
                    label: 'Even pace to the goal',
                    color: READING_SERIES.pace,
                    y: (p) => p.pace,
                    dash: true,
                    format: (v) => fmt.number(v, { maximumFractionDigits: 1 }),
                  },
                  {
                    mark: 'line',
                    key: 'finished',
                    label: 'Finished',
                    color: READING_SERIES.finished,
                    y: (p) => (p.kind === 'book' ? null : p.finished),
                    curve: 'stepAfter',
                    weight: 'strong',
                    gaps: 'connect',
                  },
                  {
                    mark: 'dot',
                    key: 'stalled',
                    label: 'Stalled book',
                    color: READING_SERIES.stalled,
                    y: (p) => (p.state === 'stalled' ? p.finished : null),
                    r: () => 5,
                  },
                  {
                    mark: 'dot',
                    key: 'reading',
                    label: 'Book in progress',
                    color: READING_SERIES.reading,
                    y: (p) => (p.state === 'reading' ? p.finished : null),
                    r: () => 5,
                  },
                ]}
                refLines={[
                  {
                    value: log.goal,
                    axis: 'left',
                    color: READING_SERIES.pace,
                    label: `Goal ${log.goal}`,
                  },
                ]}
                marks={CartesianChart.custom<Point>((plot) => {
                  const now = plot.data.find((p) => p.id === 'today')
                  if (now === undefined || now.finished === null) return []
                  const { placed } = chartLabels.place(
                    [
                      {
                        key: 'today',
                        text: `${now.finished} (${gap < 0 ? '−' : '+'}${Math.abs(gap)})`,
                        x: plot.x(now.at) ?? 0,
                        y: plot.y(now.finished),
                      },
                    ],
                    { width: plot.plotWidth, height: plot.plotHeight },
                    {
                      gap: 8,
                      obstacles: plot.data.flatMap((p) => {
                        const px = plot.x(p.at)
                        return p.kind === 'book' && p.finished !== null && px !== null
                          ? [{ left: px - 5, top: plot.y(p.finished) - 5, width: 10, height: 10 }]
                          : []
                      }),
                    },
                  )
                  return [
                    text(placed, {
                      x: () => now.at,
                      y: () => now.finished ?? 0,
                      text: (l) => l.text,
                      dx: (l) => l.dx,
                      dy: (l) => l.dy,
                      anchor: (l) => l.textAnchor,
                    }),
                  ]
                })}
                focus={focus}
              />
            )}
          />
          <DataPanel
            title="Started books"
            subtitle={
              ready && rows.length > 0 && stalled === 0
                ? `None stalled (a stall is no page in ${STALL_DAYS} days)`
                : `Stalled: no page in ${STALL_DAYS} days`
            }
            phase={phase}
            empty={tableEmpty}
            bodySize={{ rows: sizeRows }}
            body={() => <StartedTable rows={rows} focus={focus} />}
          />
        </div>
        {focus.live}
      </div>
    </Page>
  )
}
