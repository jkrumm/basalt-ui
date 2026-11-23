import { useFormat } from 'basalt-ui'
import { DataPanel } from 'basalt-ui/cards'
import type { Empty, Fact, Phase } from 'basalt-ui/cards'
import { Bars, ChartCard, Sparkline, useChartFocus } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { PROJECTS_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { PROJECT_COUNT, median, projectsNamed } from './fixture'
import type { Project, ProjectState } from './fixture'

const noop = (): void => undefined

const EMPTY: Empty = {
  cause:
    'No project reported an Issue in the last 30 days. Output appears here once a project ships.',
}

const STATE_LABELS: Record<ProjectState, string> = {
  shipping: 'Shipping',
  quiet: 'Quiet',
  spike: 'Cost spike',
}

const c = col<Project>()

/** The 1800 rest frame: the card pair answers, the table holds what the marks cannot. */
export function ExprN50Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const projects = shotState === 'empty' ? [] : projectsNamed(fixture)
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: 'The factory did not answer.' }
        : 'ready'
  const ready = phase === 'ready' && projects.length > 0

  const usd = (v: number): string =>
    f.money(v, 'USD', {
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })
  const signed = (v: number, text: string): string => (v < 0 ? '−' : v > 0 ? '+' : '') + text
  const focus = useChartFocus(projects, {
    announce: (p) =>
      `${p.name}: ${f.number(p.shipped)} Issues shipped, ${p.perIssue === undefined ? 'no cost per Issue' : `${usd(p.perIssue)} per Issue`}, ${f.number(p.open)} open`,
  })

  const table = useDataTable({
    id: 'n50-projects',
    label: 'Projects',
    columns: [
      c.entity('name', { header: 'Project', mono: true, priority: 1 }),
      c.number('shipped', { header: 'Shipped', priority: 1 }),
      c.status('state', {
        header: 'State',
        options: ['shipping', 'quiet', 'spike'],
        labels: STATE_LABELS,
        tone: (s) => (s === 'quiet' ? 'warn' : s === 'spike' ? 'bad' : 'neutral'),
        priority: 2,
      }),
      c.spark('daily', {
        header: 'Per day',
        label: 'Issues shipped per day',
        priority: 3,
        render: (p, box) => (
          <Sparkline
            series={p.daily}
            height={box.height}
            label={`${p.name}, Issues shipped per day`}
          />
        ),
      }),
      c.number('open', { header: 'Open', priority: 2 }),
      c.money('perIssue', { header: 'Cost per Issue', currency: 'USD', priority: 2 }),
      c.money('spent', { header: 'Spent', currency: 'USD', priority: 3 }),
    ],
    data: projects,
    getRowId: (p) => p.id,
    mode: { kind: 'client' },
    bodyRows: PROJECT_COUNT,
    phone: 'scroll',
  })

  const top = projects[0]
  const shippers = projects.filter((p) => p.perIssue !== undefined)
  const priciest = shippers.reduce<Project | undefined>(
    (best, p) => ((p.perIssue ?? 0) > (best?.perIssue ?? 0) ? p : best),
    undefined,
  )
  const quiet = projects.filter((p) => p.state === 'quiet')
  const medianShipped = median(projects.map((p) => p.shipped))
  const medianPerIssue = median(shippers.map((p) => p.perIssue ?? 0))
  const total = projects.reduce((sum, p) => sum + p.shipped, 0)
  const spent = projects.reduce((sum, p) => sum + p.spent, 0)
  const quietSpent = quiet.reduce((sum, p) => sum + p.spent, 0)

  // The cap is the kit's clamp: the runaway project stays on the plot's edge under its caret.
  const costs = shippers.map((p) => p.perIssue ?? 0).toSorted((a, b) => b - a)
  const cap = Math.ceil(((costs[1] ?? 0) * 1.5) / 5) * 5
  const capped = (costs[0] ?? 0) > cap && cap > 0

  const tickNames = (...keep: readonly (Project | undefined)[]): string[] =>
    keep.flatMap((p) => (p === undefined ? [] : [p.name]))

  const shippedFacts: [Fact, Fact] = ready
    ? [
        { label: 'Shipped nothing', value: `${quiet.length} projects` },
        { label: 'All projects', value: `${f.number(total)} Issues` },
      ]
    : [
        { label: 'Shipped nothing', value: '' },
        { label: 'All projects', value: '' },
      ]
  const costFacts: [Fact, Fact] = ready
    ? [
        {
          label: 'Spent',
          value: f.money(spent, 'USD', {
            currencyDisplay: 'narrowSymbol',
            maximumFractionDigits: 0,
          }),
        },
        {
          label: 'Spent while quiet',
          value: f.money(quietSpent, 'USD', {
            currencyDisplay: 'narrowSymbol',
            maximumFractionDigits: 0,
          }),
        },
      ]
    : [
        { label: 'Spent', value: '' },
        { label: 'Spent while quiet', value: '' },
      ]
  const empty = projects.length === 0 ? EMPTY : null
  const shipping = total > 0
  const costEmpty: Empty | null =
    empty ??
    (shippers.length === 0
      ? { cause: 'No project shipped an Issue, so no Issue has a cost.' }
      : null)

  return (
    <Page area="expr-n50">
      <PageBar title="Project output, last 30 days" />
      <CardGrid min="regular">
        <ChartCard
          title="Issues shipped"
          subtitle="Most shipped first"
          phase={phase}
          empty={empty}
          height="tall"
          figure={
            ready && top
              ? {
                  // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n50, kept as its builder left it: its figure follows focus, built before figure-readout
                  value: focus.readout(top.shipped, (p) => p.shipped),
                  unit: 'Issues shipped',
                  period: shipping ? focus.readout(top.name, (p) => p.name) : undefined,
                  periodMono: shipping,
                  // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n50, kept as its builder left it: its figure follows focus, built before figure-readout
                  delta: shipping
                    ? focus.readout(
                        {
                          value: signed(
                            top.shipped - medianShipped,
                            f.number(Math.abs(top.shipped - medianShipped)),
                          ),
                          polarity: 'neutral' as const,
                          label: 'vs median project',
                        },
                        (p) => ({
                          value: signed(
                            p.shipped - medianShipped,
                            f.number(Math.abs(p.shipped - medianShipped)),
                          ),
                          polarity: 'neutral' as const,
                          label: 'vs median project',
                        }),
                      )
                    : undefined,
                }
              : { value: null }
          }
          footer={shippedFacts}
          chart={(box) => (
            <Bars
              label="Issues shipped in 30 days by project, most shipped first"
              data={projects}
              height={box.height}
              focus={focus}
              tooltip={false}
              cursor="shipped"
              x={{ value: (p) => p.name, ticks: tickNames(top, ...quiet) }}
              y={{ title: 'Issues', domain: { floor: 0, ceil: 5, pad: 0.08 } }}
              series={[
                {
                  mark: 'bar',
                  key: 'shipped',
                  label: 'Issues shipped',
                  color: PROJECTS_SERIES.shipped,
                  y: (p) => p.shipped,
                  values: true,
                  highlight: (p) => shipping && p.id === top?.id,
                },
              ]}
            />
          )}
        />
        <ChartCard
          title="Cost per shipped Issue"
          subtitle="Spend over Issues shipped; none for a quiet project"
          phase={phase}
          empty={costEmpty}
          height="tall"
          figure={
            ready && priciest
              ? {
                  // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n50, kept as its builder left it: its figure follows focus, built before figure-readout
                  value: focus.readout<string | null>(usd(priciest.perIssue ?? 0), (p) =>
                    p.perIssue === undefined ? null : usd(p.perIssue),
                  ),
                  unit: 'per Issue',
                  period: focus.readout(priciest.name, (p) => p.name),
                  periodMono: true,
                  // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n50, kept as its builder left it: its figure follows focus, built before figure-readout
                  delta: focus.readout(
                    {
                      value: signed(1, usd((priciest.perIssue ?? 0) - medianPerIssue)),
                      polarity: 'neutral' as const,
                      label: 'vs median project',
                    },
                    (p) =>
                      p.perIssue === undefined
                        ? undefined
                        : {
                            value: signed(
                              p.perIssue - medianPerIssue,
                              usd(Math.abs(p.perIssue - medianPerIssue)),
                            ),
                            polarity: 'neutral' as const,
                            label: 'vs median project',
                          },
                  ),
                }
              : { value: null }
          }
          footer={costFacts}
          chart={(box) => (
            <Bars
              label="Model cost per shipped Issue by project, in the same order"
              data={projects}
              height={box.height}
              focus={focus}
              tooltip={false}
              cursor="cost"
              x={{ value: (p) => p.name, ticks: tickNames(priciest) }}
              y={{
                title: 'Dollars per Issue',
                domain: capped ? [0, cap] : { floor: 0 },
                format: (v) => usd(v),
              }}
              series={[
                {
                  mark: 'bar',
                  key: 'cost',
                  label: 'Cost per Issue',
                  color: PROJECTS_SERIES.cost,
                  y: (p) => p.perIssue ?? null,
                  values: true,
                  format: (v) => usd(v),
                  highlight: (p) => p.id === priciest?.id,
                },
              ]}
            />
          )}
        />
      </CardGrid>
      <DataPanel
        title="Projects"
        subtitle="Open Issues, spend and the daily shape"
        phase={phase}
        empty={empty}
        bodySize={{ rows: PROJECT_COUNT + 3 }}
        body={() => <DataTable table={table} focus={focus} />}
      />
    </Page>
  )
}
