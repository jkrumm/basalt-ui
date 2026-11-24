import { BarList, DataPanel } from 'basalt-ui/cards'
import type { Empty, FootFacts, Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import { useFormat } from 'basalt-ui'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { text } from '@tanstack/charts/text'
import { WIKI_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { READ_VIEWS, STALE_DAYS, wikiPages } from './fixture'
import type { WikiPage } from './fixture'

const AGE_END = 640
const VIEWS_CAP = 500
const OWNER_ROWS = 10

const NO_PAGES: Empty = { cause: 'No pages yet. They appear after the wiki export runs.' }
const NO_STALE: Empty = {
  cause: `No page is older than ${STALE_DAYS} days, so none needs an owner.`,
}
const LOAD_FAILED = 'The wiki export did not answer.'
const retry = (): void => undefined

// cycle-expression-11: basalt-ui/cards does not export the BarList legend entry type, so it is read off the props
const OWNER_SERIES: NonNullable<Parameters<typeof BarList>[0]['series']> = [
  { key: 'read', label: 'Still read', color: WIKI_SERIES.read },
  { key: 'quiet', label: 'Barely read', color: WIKI_SERIES.quiet },
]

const c = col<WikiPage>()
const COLUMNS = [
  c.entity('title', { header: 'Page', priority: 1 }),
  c.text('space', { header: 'Space', priority: 2, card: 'subtitle' }),
  c.text('ownerName', { header: 'Owner', priority: 2 }),
]

const byViews = (a: WikiPage, b: WikiPage): number => b.views - a.views || b.ageDays - a.ageDays

export function ExprN49Scenario({ shotState, fixture }: ScenarioProps) {
  const fmt = useFormat()
  const ready = shotState === undefined
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: LOAD_FAILED, retry }
        : 'ready'
  // Arrow keys step the chart's items in this order, left to right across the plot.
  const pages = ready
    ? [...wikiPages(fixture)].sort((a, b) => a.ageDays - b.ageDays || a.views - b.views)
    : []
  const stale = pages.filter((p) => p.stale).sort(byViews)
  const stillRead = stale.filter((p) => p.stillRead)
  const staleViews = stale.reduce((sum, p) => sum + p.views, 0)
  const allViews = pages.reduce((sum, p) => sum + p.views, 0)

  const quietest = [...new Set(pages.map((p) => p.space))]
    .map((space) => ({
      space,
      days: Math.min(...pages.filter((p) => p.space === space).map((p) => p.ageDays)),
    }))
    .sort((a, b) => b.days - a.days)[0]

  const owners = [...new Set(stale.map((p) => p.ownerName))]
    .map((label) => {
      const own = stale.filter((p) => p.ownerName === label)
      const read = own.filter((p) => p.stillRead).length
      return { label, value: own.length, parts: { read, quiet: own.length - read } }
    })
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))

  const focus = useChartFocus(pages, {
    announce: (p) =>
      `${p.title}: ${p.views} views, edited ${fmt.date(p.edited, 'short')}, ${p.ownerName}`,
  })

  const table = useDataTable({
    id: 'stale-pages',
    label: 'Stale pages',
    columns: [
      ...COLUMNS,
      c.meter('ageDays', {
        header: 'Days since edit',
        card: 'meta',
        max: Math.max(1, ...stale.map((p) => p.ageDays)),
        priority: 2,
      }),
      c.number('views', { header: 'Views, 30 days', priority: 1 }),
    ],
    data: stale,
    getRowId: (p) => p.id,
    mode: { kind: 'client' },
    phase: 'ready',
  })

  const emptyAll = pages.length === 0 && shotState === 'empty' ? NO_PAGES : null
  const emptyStale = emptyAll ?? (ready && stale.length === 0 ? NO_STALE : null)
  const footer: FootFacts = ready
    ? [
        {
          label: 'Stale views',
          value: allViews === 0 ? '0%' : `${Math.round((100 * staleViews) / allViews)}%`,
        },
        quietest === undefined || quietest.days <= STALE_DAYS
          ? null
          : { label: 'Untouched', value: `${quietest.space}, ${quietest.days} d` },
      ]
    : [
        { label: 'Stale views', value: '' },
        { label: 'Untouched', value: '' },
      ]
  const labelled = new Map(stillRead.map((p) => [p.id, p]))

  return (
    <Page area="expr-n49">
      <PageBar title="Team wiki freshness" />
      <div className="grid gap-3">
        <div className="grid gap-3 @wide:grid-cols-2">
          <ChartCard
            title="Page age and reads"
            subtitle="Every page, views in the last 30 days"
            phase={phase}
            empty={emptyAll}
            height="tall"
            footer={footer}
            figure={
              ready
                ? {
                    // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n49, kept as its builder left it: its figure follows focus, built before figure-readout
                    value: focus.readout<string | number>(stillRead.length, (p) => p.views),
                    unit: focus.readout('stale pages still read', () => 'views in 30 days'),
                    period: focus.readout(
                      `of ${pages.length} pages`,
                      (p) => `${p.title}, edited ${fmt.date(p.edited, 'short')}`,
                    ),
                  }
                : { value: null }
            }
            chart={() => (
              <CartesianChart
                label="Views in 30 days against days since last edit, one dot per page"
                data={pages}
                focus={focus}
                tooltip={false}
                summary={`${stillRead.length} stale pages with ${READ_VIEWS} or more views: ${stillRead.map((p) => p.title).join(', ')}`}
                x={{
                  value: (p) => p.ageDays,
                  title: 'Days since last edit',
                  domain: [0, AGE_END],
                  ticks: [0, STALE_DAYS, 365, 540],
                }}
                y={{ title: 'Views', domain: [0, VIEWS_CAP] }}
                series={[
                  {
                    mark: 'dot',
                    key: 'fresh',
                    label: 'Fresh',
                    color: WIKI_SERIES.fresh,
                    y: (p) => (p.stale ? null : p.views),
                  },
                  {
                    mark: 'dot',
                    key: 'quiet',
                    label: 'Stale, barely read',
                    color: WIKI_SERIES.quiet,
                    y: (p) => (p.stale && !p.stillRead ? p.views : null),
                  },
                  {
                    mark: 'dot',
                    key: 'read',
                    label: 'Stale, still read',
                    color: WIKI_SERIES.read,
                    y: (p) => (p.stillRead ? p.views : null),
                  },
                ]}
                zones={[
                  {
                    axis: 'x',
                    from: STALE_DAYS,
                    to: AGE_END,
                    fill: alpha(BASALT.inkMuted, 0.1),
                    label: 'Stale',
                  },
                ]}
                refLines={[
                  {
                    value: READ_VIEWS,
                    color: WIKI_SERIES.rule,
                    dashed: true,
                    label: `${READ_VIEWS} views`,
                  },
                ]}
                marks={CartesianChart.custom<WikiPage>((plot) => {
                  const r = BASALT.dotR + 1
                  const dots = plot.data.flatMap((p) => {
                    const px = plot.x(p.ageDays)
                    return px === null
                      ? []
                      : [{ left: px - r, top: plot.y(p.views) - r, width: 2 * r, height: 2 * r }]
                  })
                  const { placed } = chartLabels.place(
                    plot
                      .rows('read')
                      .filter((p) => p.stillRead)
                      .map((p) => ({
                        key: p.id,
                        text: p.title,
                        x: plot.x(p.ageDays) ?? 0,
                        y: plot.y(p.views),
                        priority: p.views,
                      })),
                    { width: plot.plotWidth, height: plot.plotHeight },
                    { obstacles: dots, gap: BASALT.dotR + 3 },
                  )
                  return [
                    text(placed, {
                      x: (l) => labelled.get(l.key)?.ageDays ?? 0,
                      y: (l) => labelled.get(l.key)?.views ?? 0,
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
          <BarList
            title="Owners of stale pages"
            subtitle="Stale pages per owner"
            phase={phase}
            empty={emptyStale}
            items={owners}
            series={OWNER_SERIES}
            bodyRows={OWNER_ROWS}
            focusItems={{
              focus,
              holds: (row, p: WikiPage) => p.stale && p.ownerName === row.label,
            }}
          />
        </div>
        <DataPanel
          title="Stale pages"
          subtitle={ready ? `${stale.length} pages, most read first` : 'Most read first'}
          phase={phase}
          empty={emptyStale}
          bodySize={{ rows: 10 }}
          body={() => <DataTable table={table} focus={focus} height="fill" />}
        />
      </div>
    </Page>
  )
}
