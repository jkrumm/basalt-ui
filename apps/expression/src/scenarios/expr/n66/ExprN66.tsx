import { text } from '@tanstack/charts/text'
import { useFormat } from 'basalt-ui'
import { BarList, RowList } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { BASALT } from 'basalt-ui/tokens'
import { N66_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { EMPTY_YEAR, genresOf, median, paceOf, yearFor } from './fixture'
import type { Book } from './fixture'

/** The y scale ends here; a pace past it is the kit's off-scale caret with its true value. */
const PACE_CAP = 90
const SITTING = 'One sitting'
const NO_PAGES = 'No page count'
const UNIT = 'pages/h'
const LOG_ERROR = 'The tracker did not answer.'
const BACKLOG_ERROR = 'The backlog did not answer.'
const DELTA_BASE = 'Jul to Nov vs Jan to Jun'
const YEAR_START = Date.UTC(2026, 0, 1)
const YEAR_END = Date.UTC(2026, 10, 20)
const MONTH_STARTS = Array.from({ length: 11 }, (_, m) => new Date(Date.UTC(2026, m, 1)))
const noop = (): void => undefined

type Anchor = { key: string; text: string; book: Book; value: number }

export function ExprN66Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const year = shotState === 'empty' ? EMPTY_YEAR : yearFor(fixture)
  const ready = shotState !== 'loading' && shotState !== 'error'

  const whole = (v: number): string => f.number(Math.round(v))
  const speed = (v: number): string => `${whole(v)} ${UNIT}`
  const readOf = (b: Book): string => {
    const pace = paceOf(b)
    const reading = pace === null ? NO_PAGES : speed(pace)
    return b.sitting ? `${reading}, ${SITTING}` : reading
  }

  const focus = useChartFocus(year.books, { announce: (b) => `${b.title}: ${readOf(b)}` })

  const phaseOf = (message: string): Phase => {
    if (shotState === 'loading') return 'loading'
    if (shotState === 'error') return { tag: 'error', retry: noop, message }
    return 'ready'
  }

  const paces = year.books.map(paceOf).filter((v): v is number => v !== null)
  const yearMedian = median(paces)
  const early = median(
    year.books
      .filter((b) => b.finished.getUTCMonth() < 6)
      .map(paceOf)
      .filter((v): v is number => v !== null),
  )
  const late = median(
    year.books
      .filter((b) => b.finished.getUTCMonth() >= 6)
      .map(paceOf)
      .filter((v): v is number => v !== null),
  )
  const change = early === null || late === null ? 0 : Math.round(late - early)
  const unpagedCount = year.books.filter((b) => b.pages === null).length
  const pagesText = (n: number): string => `${f.number(n)} pages`
  const medianText = (of: string): string => `Median of ${of}`

  const anchors: Anchor[] = []
  const drawn = year.books.flatMap((b) => {
    const pace = paceOf(b)
    return pace === null ? [] : [{ b, pace }]
  })
  const fastest = drawn.reduce<{ b: Book; pace: number } | null>(
    (best, c) => (best === null || c.pace > best.pace ? c : best),
    null,
  )
  const slowest = drawn.reduce<{ b: Book; pace: number } | null>(
    (best, c) => (best === null || c.pace < best.pace ? c : best),
    null,
  )
  if (fastest !== null && fastest.pace <= PACE_CAP) {
    anchors.push({
      key: fastest.b.id,
      text: `Fastest ${whole(fastest.pace)}`,
      book: fastest.b,
      value: fastest.pace,
    })
  }
  if (slowest !== null) {
    anchors.push({
      key: slowest.b.id,
      text: `Slowest ${whole(slowest.pace)}`,
      book: slowest.b,
      value: slowest.pace,
    })
  }

  const signed = (n: number): string => (n < 0 ? `\u2212${Math.abs(n)}` : `+${n}`)
  const figure =
    ready && yearMedian !== null
      ? {
          value: whole(yearMedian),
          unit: UNIT,
          delta: { value: signed(change), polarity: 'neutral' as const, label: DELTA_BASE },
          period: focus.readout(
            medianText(`${paces.length} books`),
            (b) => `${b.title}: ${readOf(b)}`,
          ),
        }
      : {
          value: null,
          unit: UNIT,
          delta: { value: '', polarity: 'neutral' as const, label: DELTA_BASE },
          period: medianText('all'),
        }
  const footer = [
    { label: NO_PAGES, value: ready ? `${unpagedCount}` : '' },
    { label: 'Finished', value: ready ? `${year.books.length}` : '' },
  ] as const

  const finishedRows = year.books.map((b) => {
    const pace = paceOf(b)
    const time = f.duration(b.seconds * 1000)
    return {
      key: b.id,
      label: b.title,
      detail: b.pages === null ? time : `${pagesText(b.pages)}, ${time}`,
      value: pace === null ? '\u2014' : speed(pace),
      ...(b.sitting ? { status: { tone: 'neutral' as const, label: SITTING } } : {}),
    }
  })

  const genres = genresOf(year.backlog)
  const backlogTotal = year.backlog.length
  const genreRows = genres.map((g) => ({
    key: g.name,
    label: g.name,
    value: g.count,
    secondary: f.percent(backlogTotal === 0 ? 0 : g.count / backlogTotal, {
      maximumFractionDigits: 0,
    }),
  }))
  const readingRows = year.reading.map((r) => ({
    key: r.id,
    label: r.title,
    detail: `${r.page} of ${pagesText(r.pages)}`,
    value: `${Math.round((r.page / r.pages) * 100)} % read`,
    status: { tone: 'neutral' as const, label: 'Reading now' },
  }))
  const rows = [...finishedRows, ...readingRows]

  return (
    <Page area="scenarios">
      <PageBar title="Reading in 2026" />
      <div className="grid items-start gap-3 @wide:grid-cols-3">
        <div className="@wide:col-span-2">
          <ChartCard
            title="Reading pace"
            subtitle="How fast each book read"
            phase={phaseOf(LOG_ERROR)}
            empty={
              year.books.length === 0
                ? { cause: 'Nothing to draw yet. Mark a book finished and it appears here.' }
                : null
            }
            height="tall"
            figure={figure}
            footer={footer}
            chart={(box) => (
              <CartesianChart
                label="Dots by finish date"
                data={year.books}
                height={box.height}
                focus={focus}
                tooltip={false}
                summary={`${NO_PAGES}: ${unpagedCount} not drawn`}
                x={{
                  value: (b) => b.finished,
                  domain: [new Date(YEAR_START), new Date(YEAR_END)],
                  ticks: MONTH_STARTS,
                  format: (x) => {
                    const d = new Date(x)
                    return d.getUTCDate() === 1
                      ? f.date(d, 'month', { month: 'short', year: undefined })
                      : f.date(d, 'short')
                  },
                }}
                y={{
                  title: UNIT,
                  domain: ([, hi]) => [0, Math.min(hi * 1.1, PACE_CAP)],
                  format: whole,
                }}
                refLines={
                  yearMedian === null
                    ? []
                    : [
                        {
                          value: yearMedian,
                          label: 'Median',
                          color: N66_SERIES.median,
                          dashed: true,
                        },
                      ]
                }
                series={[
                  {
                    mark: 'dot',
                    key: 'pace',
                    label: 'Pace',
                    color: N66_SERIES.pace,
                    y: paceOf,
                    format: speed,
                  },
                ]}
                marks={CartesianChart.custom<Book>((plot) => {
                  const r = BASALT.dotR + 1
                  const dots = plot.rows('pace').flatMap((b) => {
                    const px = plot.x(b.finished)
                    const pace = paceOf(b)
                    if (px === null || pace === null) return []
                    return [{ left: px - r, top: plot.y(pace) - r, width: 2 * r, height: 2 * r }]
                  })
                  const { placed } = chartLabels.place(
                    anchors.flatMap((a) => {
                      const px = plot.x(a.book.finished)
                      return px === null
                        ? []
                        : [{ key: a.key, text: a.text, x: px, y: plot.y(a.value) }]
                    }),
                    { width: plot.plotWidth, height: plot.plotHeight },
                    { obstacles: dots, gap: BASALT.dotR + 3 },
                  )
                  const at = new Map(anchors.map((a) => [a.key, a]))
                  return [
                    text(placed, {
                      x: (l) => at.get(l.key)?.book.finished ?? new Date(YEAR_START),
                      y: (l) => at.get(l.key)?.value ?? 0,
                      text: (l) => l.text,
                      dx: (l) => l.dx,
                      dy: (l) => l.dy,
                      anchor: (l) => l.textAnchor,
                    }),
                  ]
                })}
              />
            )}
          />
        </div>
        <div className="@wide:col-span-2">
          <BarList
            title="Backlog by genre"
            subtitle={ready ? `${backlogTotal} waiting` : 'Waiting'}
            phase={phaseOf(BACKLOG_ERROR)}
            empty={
              backlogTotal === 0
                ? {
                    cause: 'The backlog is empty. Add a title with its genre to see what fills it.',
                  }
                : null
            }
            items={genreRows}
            bodyRows={6}
          />
        </div>
        <div className="@wide:col-start-3 @wide:row-span-2 @wide:row-start-1">
          <RowList
            title="Books"
            subtitle="Oldest first, then in progress"
            phase={phaseOf(LOG_ERROR)}
            empty={
              rows.length === 0
                ? { cause: 'Nothing to list yet. A book you finish or start appears here.' }
                : null
            }
            items={rows}
            lines={2}
            bodyRows={17}
            focus={focus}
          />
        </div>
      </div>
    </Page>
  )
}
