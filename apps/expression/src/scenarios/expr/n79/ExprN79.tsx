import { useFormat } from 'basalt-ui'
import type { Phase } from 'basalt-ui/cards'
import { DataPanel, StatCell, StatGroup } from 'basalt-ui/cards'
import { Bars, ChartCard, Lines, useChartFocus } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { GitBranch, Wrench } from 'lucide-react'
import { N79_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { CLASS_KEYS, CLASS_NAME, classRows, fallingClasses, windowsFor } from './fixture'
import type { ClassRow, FixWindow, Trend } from './fixture'

const TREND_LABEL: Record<Trend, string> = {
  less: 'Falling',
  same: 'Level',
  more: 'Rising',
  none: 'Idle',
}
const TRENDS: readonly Trend[] = ['less', 'same', 'more', 'none']
const CAP = 20

const c = col<ClassRow>()

/** A failed load with its own retry, so each frame keeps a Retry of its own. */
const failed = (): Phase => ({
  tag: 'error',
  retry: () => undefined,
  message: 'The fix log did not respond.',
})

export function ExprN79Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const signed = (n: number): string => f.number(n, { signDisplay: 'exceptZero' })
  const windows = shotState === 'empty' ? [] : windowsFor(fixture)
  const [now, prior] = windows
  const ready = shotState !== 'loading' && shotState !== 'error' && now !== undefined
  // cycle-expression-16: a StatCell delta with an empty value still draws a pill with an arrow, so the empty state drops the delta slot of each cell instead of holding it
  const empty = now === undefined && shotState !== 'loading' && shotState !== 'error'
  const phase = (): Phase =>
    shotState === 'loading' ? 'loading' : shotState === 'error' ? failed() : 'ready'

  const oldestFirst = [...windows].reverse()
  const rows = classRows(windows)
  const riser = rows.find((r) => r.trend === 'more')
  const risers = rows.filter((r) => r.trend === 'more').length
  const fallingNow = fallingClasses(windows)
  const maxNow = Math.max(1, ...rows.map((r) => r.now))

  const focus = useChartFocus(oldestFirst, {
    announce: (w) =>
      `${w.label}: ${CLASS_KEYS.map((k) => `${CLASS_NAME[k]} ${w.counts[k]}`).join(', ')}`,
  })

  const table = useDataTable({
    id: 'n79-classes',
    label: 'Counts',
    columns: [
      c.entity('name', { header: 'Class', priority: 1 }),
      c.meter('now', { header: 'Latest', max: maxNow, priority: 1, card: 'value' }),
      c.delta('change', { header: 'Change', polarity: 'neutral', priority: 2 }),
      c.status('trend', {
        header: 'Trend',
        options: TRENDS,
        labels: TREND_LABEL,
        tone: (t) => (t === 'more' ? 'accent' : 'neutral'),
        priority: 2,
      }),
    ],
    data: rows,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase: phase(),
    bodyRows: CLASS_KEYS.length,
  })

  const seriesOf = (key: (typeof CLASS_KEYS)[number]) =>
    rows.find((r) => r.id === key)?.trend === 'more' ? N79_SERIES.rose : N79_SERIES[key]

  const span = now === undefined ? '' : `${oldestFirst[0]?.start} to ${now.end}`
  const readSeries = (key: string): string => {
    const k = CLASS_KEYS.find((x) => x === key)
    if (k === undefined) return ''
    return `${CLASS_NAME[k]}: ${oldestFirst.map((w) => w.counts[k]).join(', ')}`
  }

  return (
    <Page area="expr-n79">
      <PageBar title="Factory fixes, last 28 days" />
      <StatGroup variant="cards" label="Headline counts">
        <StatCell
          icon={Wrench}
          title="Fixes landed"
          value={ready ? now.total : null}
          delta={
            empty
              ? undefined
              : {
                  value: ready && prior ? signed(now.total - prior.total) : '',
                  polarity: 'neutral',
                  label: `vs ${prior?.label ?? ''}`,
                }
          }
          phase={phase()}
        />
        <StatCell
          icon={GitBranch}
          title="Repos with a fix"
          value={ready ? now.repos : null}
          delta={
            empty
              ? undefined
              : {
                  value: ready && prior ? signed(now.repos - prior.repos) : '',
                  polarity: 'neutral',
                  label: `vs ${prior?.label ?? ''}`,
                }
          }
          phase={phase()}
        />
        <StatCell
          title="Landing less often"
          value={ready ? fallingNow : null}
          unit={`of ${CLASS_KEYS.length} classes`}
          phase={phase()}
        />
      </StatGroup>
      <CardGrid min="regular">
        <ChartCard
          title="Fixes per class"
          phase={phase()}
          empty={
            !empty
              ? null
              : {
                  cause: 'No week has closed yet. Counts appear once the first one has.',
                }
          }
          figure={
            ready
              ? {
                  value: risers,
                  unit: 'rising',
                  period: span,
                  periodMono: true,
                  status:
                    focus.series !== null
                      ? { tone: 'neutral', label: readSeries(focus.series) }
                      : riser === undefined
                        ? { tone: 'neutral', label: 'None rising' }
                        : {
                            tone: 'accent',
                            label: `${riser.name}, ${riser.prior} to ${riser.now}`,
                          },
                }
              : { value: null }
          }
          height="tall"
          chart={(box) => (
            <Lines
              height={box.height}
              label="Four points per line, one line each"
              data={oldestFirst}
              x={{ value: (w) => w.label }}
              y={{ title: 'Count', domain: ([lo, hi]) => [lo, Math.min(hi, CAP)] }}
              focus={focus}
              naming="endLabels"
              series={CLASS_KEYS.map((key) => ({
                mark: 'line' as const,
                key,
                label: CLASS_NAME[key],
                color: seriesOf(key),
                weight: rows.find((r) => r.id === key)?.trend === 'more' ? 'strong' : 'quiet',
                y: (w: FixWindow) => w.counts[key],
              }))}
            />
          )}
        />
        <div className="flex flex-col gap-4">
          <DataPanel
            title="Movement"
            subtitle="latest against the one before"
            phase={phase()}
            empty={!empty ? null : { cause: 'Nothing to compare until two weeks have closed.' }}
            bodySize={{ rows: CLASS_KEYS.length + 1 }}
            body={() => <DataTable table={table} focusSeries={{ focus, key: (r) => r.id }} />}
          />
          <ChartCard
            title="Totals"
            phase={phase()}
            empty={
              !empty
                ? null
                : {
                    cause: 'Totals follow the first closed week.',
                  }
            }
            panes={[
              {
                weight: 3,
                chart: (box) => (
                  <Bars
                    height={box.height}
                    label="Totals from oldest to newest"
                    data={oldestFirst}
                    x={{ value: (w) => w.label }}
                    y={{ title: 'Total' }}
                    focus={focus}
                    series={[
                      {
                        mark: 'bar',
                        key: 'total',
                        label: 'Total',
                        color: N79_SERIES.total,
                        values: true,
                        y: (w) => w.total,
                      },
                    ]}
                  />
                ),
              },
              {
                weight: 2,
                chart: (box) => (
                  <Bars
                    height={box.height}
                    label="Repositories, same order"
                    data={oldestFirst}
                    x={{ value: (w) => w.label }}
                    y={{ title: 'Repos' }}
                    focus={focus}
                    series={[
                      {
                        mark: 'bar',
                        key: 'repos',
                        label: 'Repos',
                        color: N79_SERIES.repos,
                        values: true,
                        y: (w) => w.repos,
                      },
                    ]}
                  />
                ),
              },
            ]}
          />
        </div>
      </CardGrid>
    </Page>
  )
}
