// One in/out pair per rewrite row, one flagged case per flag row (docs/v3/concepts/charts-cards-kanban.md
// section 10). A case of kind `flag` is left byte for byte; `rewritten` and `flagged` are the exact counts
// and row ids the report must carry for it.
export type Case = {
  name: string
  kind: 'rewrite' | 'flag'
  rewritten: Record<string, number>
  flagged: string[]
  in: string
  out: string
}

export const CASES: Case[] = [
  {
    name: 'body-chart',
    kind: 'rewrite',
    rewritten: { 'cc-body-chart': 1 },
    flagged: [],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => (
  <ChartCard title="Weight" info="Trend">
    <Lines ariaLabel="Weight" data={rows} height={CHART_HEIGHT} x={(d) => d.date} />
  </ChartCard>
)
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => (
  <ChartCard title="Weight" info="Trend" chart={(box) => <Lines ariaLabel="Weight" data={rows} height={box.height} x={(d) => d.date} />} />
)
`,
  },
  {
    name: 'body-chart-refetch',
    kind: 'rewrite',
    rewritten: { 'cc-body-chart': 1 },
    flagged: [],
    in: `import { ChartCard } from 'basalt-ui/charts'
import { RefetchDim } from '../refetch-dim'

export const A = () => (
  <ChartCard title="Sleep">
    <RefetchDim active={query.isPlaceholderData}>
      <Bars ariaLabel="Sleep" data={rows} x={(d) => d.day} />
    </RefetchDim>
  </ChartCard>
)
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => (
  <ChartCard title="Sleep" chart={(box) => <Bars height={box.height} ariaLabel="Sleep" data={rows} x={(d) => d.day} />} />
)
`,
  },
  {
    name: 'pending-loading',
    kind: 'rewrite',
    rewritten: { 'cc-pending-loading': 1 },
    flagged: ['cc-removed-props'],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard state={{ pending: true }} placeholderHeight={320} />
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard phase="loading" />
`,
  },
  {
    name: 'height',
    kind: 'rewrite',
    rewritten: { 'cc-body-chart': 2, 'cc-height': 2 },
    flagged: [],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => (
  <>
    <ChartCard title="a" height={{ base: 200, regular: 240 }}><Bars data={rows} /></ChartCard>
    <ChartCard title="b" height={360}><Bars data={rows} /></ChartCard>
  </>
)
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => (
  <>
    <ChartCard title="a" height="short" chart={(box) => <Bars height={box.height} data={rows} />} />
    <ChartCard title="b" height="auto" chart={(box) => <Bars height={box.height} data={rows} />} />
  </>
)
`,
  },
  {
    name: 'height-partial',
    kind: 'rewrite',
    rewritten: { 'cc-body-chart': 1 },
    flagged: ['cc-expression'],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" height={h}><Bars data={rows} /></ChartCard>
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" height={h} chart={(box) => <Bars height={box.height} data={rows} />} />
`,
  },
  {
    name: 'state-phase',
    kind: 'rewrite',
    rewritten: { 'cc-body-chart': 5, 'cc-state-phase': 5 },
    flagged: [],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => (
  <>
    <ChartCard title="a" state={chartStateOf(query, 'No data')}><Bars data={rows} /></ChartCard>
    <ChartCard title="b" state={chartStateOf(query, undefined)}><Bars data={rows} /></ChartCard>
    <ChartCard title="c" state={chartStateOf(query, !ok ? 'Need more' : undefined)}><Bars data={rows} /></ChartCard>
    <ChartCard title="d" state={{ empty: rows.length === 0 && 'Nothing here' }}><Bars data={rows} /></ChartCard>
    <ChartCard title="e" state={{ pending: query.isPending, error: query.isError ? query.error : undefined }}><Bars data={rows} /></ChartCard>
  </>
)
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => (
  <>
    <ChartCard title="a" phase={query} empty={{ cause: 'No data' }} chart={(box) => <Bars height={box.height} data={rows} />} />
    <ChartCard title="b" phase={query} chart={(box) => <Bars height={box.height} data={rows} />} />
    <ChartCard title="c" phase={query} empty={!ok ? { cause: 'Need more' } : null} chart={(box) => <Bars height={box.height} data={rows} />} />
    <ChartCard title="d" empty={rows.length === 0 ? { cause: 'Nothing here' } : null} chart={(box) => <Bars height={box.height} data={rows} />} />
    <ChartCard title="e" phase={query} chart={(box) => <Bars height={box.height} data={rows} />} />
  </>
)
`,
  },
  {
    name: 'state-expression',
    kind: 'rewrite',
    rewritten: { 'cc-body-chart': 1 },
    flagged: ['cc-expression'],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" state={make(query)}><Bars data={rows} /></ChartCard>
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" state={make(query)} chart={(box) => <Bars height={box.height} data={rows} />} />
`,
  },
  {
    name: 'facts-figure',
    kind: 'rewrite',
    rewritten: { 'cc-body-chart': 3, 'cc-facts-figure': 3 },
    flagged: [],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => (
  <>
    <ChartCard title="a" facts={{ value: '4.2', unit: 'kg', period: 'last week' }}><Bars data={rows} /></ChartCard>
    <ChartCard title="b" facts={toChartFact(fact)}><Bars data={rows} /></ChartCard>
    <ChartCard title="c" facts={[toChartFact(fact)]}><Bars data={rows} /></ChartCard>
  </>
)
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => (
  <>
    <ChartCard title="a" figure={{ value: '4.2', unit: 'kg', period: 'last week' }} chart={(box) => <Bars height={box.height} data={rows} />} />
    <ChartCard title="b" figure={toChartFact(fact)} chart={(box) => <Bars height={box.height} data={rows} />} />
    <ChartCard title="c" figure={toChartFact(fact)} chart={(box) => <Bars height={box.height} data={rows} />} />
  </>
)
`,
  },
  {
    name: 'facts-several',
    kind: 'rewrite',
    rewritten: { 'cc-body-chart': 1 },
    flagged: ['cc-expression'],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" facts={[one, two]}><Bars data={rows} /></ChartCard>
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" facts={[one, two]} chart={(box) => <Bars height={box.height} data={rows} />} />
`,
  },
  {
    name: 'facts-comparison',
    kind: 'rewrite',
    rewritten: { 'cc-body-chart': 1 },
    flagged: ['cc-expression'],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" facts={{ value: 1, comparison: { delta: 2 } }}><Bars data={rows} /></ChartCard>
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" facts={{ value: 1, comparison: { delta: 2 } }} chart={(box) => <Bars height={box.height} data={rows} />} />
`,
  },
  {
    name: 'body-datapanel',
    kind: 'flag',
    rewritten: {},
    flagged: ['cc-body-datapanel', 'cc-removed-props'],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => (
  <ChartCard title="Spend" placeholderHeight="content">
    <BarList label="Spend" rows={rows} />
  </ChartCard>
)
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => (
  <ChartCard title="Spend" placeholderHeight="content">
    <BarList label="Spend" rows={rows} />
  </ChartCard>
)
`,
  },
  {
    name: 'removed-props',
    kind: 'rewrite',
    rewritten: { 'cc-body-chart': 1 },
    flagged: [
      'cc-removed-props',
      'cc-removed-props',
      'cc-removed-props',
      'cc-removed-props',
      'cc-removed-props',
      'cc-removed-props',
      'cc-removed-props',
    ],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => (
  <ChartCard title="a" placeholderHeight={280} matchHeight stateNoun="x" deltaPeriod="w" stateAction={act} ghost retrying={r}>
    <Bars data={rows} height={280} />
  </ChartCard>
)
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => (
  <ChartCard title="a" chart={(box) => <Bars data={rows} height={box.height} />} />
)
`,
  },
  {
    name: 'actions',
    kind: 'rewrite',
    rewritten: { 'cc-body-chart': 1 },
    flagged: ['cc-actions'],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" actions={<Group />}><Bars data={rows} /></ChartCard>
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" actions={<Group />} chart={(box) => <Bars height={box.height} data={rows} />} />
`,
  },
  {
    name: 'tone-status',
    kind: 'rewrite',
    rewritten: { 'cc-body-chart': 1 },
    flagged: ['cc-tone-status'],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" tone="warn" subtitle="Today: watch"><Bars data={rows} /></ChartCard>
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" tone="warn" subtitle="Today: watch" chart={(box) => <Bars height={box.height} data={rows} />} />
`,
  },
  {
    name: 'expression',
    kind: 'flag',
    rewritten: {},
    flagged: ['cc-expression'],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a">{view === 'a' && <Bars data={rows} />}</ChartCard>
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a">{view === 'a' && <Bars data={rows} />}</ChartCard>
`,
  },
  {
    name: 'other-self-closed',
    kind: 'flag',
    rewritten: {},
    flagged: ['cc-other-self-closed'],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" state={{ empty: 'Nothing to show' }} />
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" state={{ empty: 'Nothing to show' }} />
`,
  },
  {
    name: 'spread',
    kind: 'rewrite',
    rewritten: { 'cc-body-chart': 1 },
    flagged: ['cc-expression'],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" {...(f !== null && { facts: f })}><Bars data={rows} /></ChartCard>
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" {...(f !== null && { facts: f })} chart={(box) => <Bars height={box.height} data={rows} />} />
`,
  },
  {
    name: 'multi',
    kind: 'rewrite',
    rewritten: { 'cc-body-chart': 1 },
    flagged: [],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => (
  <ChartCard title="a">
    <CartesianChart data={rows} height={H} />
    <Slider />
  </ChartCard>
)
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => (
  <ChartCard
    title="a"
    chart={(box) => (
    <><CartesianChart data={rows} height={box.height} />
    <Slider /></>
  )}
  />
)
`,
  },
  {
    name: 'flag-removed-props',
    kind: 'flag',
    rewritten: {},
    flagged: ['cc-body-datapanel', 'cc-removed-props', 'cc-removed-props'],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => (
  <ChartCard title="Spend" placeholderHeight="content" ghost>
    <BarList label="Spend" rows={rows} />
  </ChartCard>
)
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => (
  <ChartCard title="Spend" placeholderHeight="content" ghost>
    <BarList label="Spend" rows={rows} />
  </ChartCard>
)
`,
  },
  {
    name: 'flag-actions',
    kind: 'flag',
    rewritten: {},
    flagged: ['cc-actions', 'cc-expression'],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" actions={<Group />}>{children}</ChartCard>
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" actions={<Group />}>{children}</ChartCard>
`,
  },
  {
    name: 'flag-tone-status',
    kind: 'flag',
    rewritten: {},
    flagged: ['cc-tone-status', 'cc-expression'],
    in: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" tone="warn" subtitle="Today: watch">{children}</ChartCard>
`,
    out: `import { ChartCard } from 'basalt-ui/charts'

export const A = () => <ChartCard title="a" tone="warn" subtitle="Today: watch">{children}</ChartCard>
`,
  },
]
