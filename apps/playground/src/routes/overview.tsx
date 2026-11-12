import { createFileRoute } from '@tanstack/react-router'
import { PageBar } from 'basalt-ui/page'
import { BarList, DataPanel, EventList, StatCard, StatCell, StatGroup } from 'basalt-ui/cards'
import { ChartCard, Lines } from 'basalt-ui/charts'
import { FilterSet, filterSlot, spec } from 'basalt-ui/controls'
import { defineControls, field } from 'basalt-ui/router'
import type { ReactElement } from 'react'
import { demoColors } from '../demo/series'
import { useV3Tokens } from '../demo/v3-tokens'

const globals = defineControls({
  id: 'overview-globals',
  scope: 'global',
  fields: {
    range: field
      .enum(['24h', '7d', '30d'], '7d')
      .labels({ '24h': 'Last 24 h', '7d': 'Last 7 days', '30d': 'Last 30 days' }),
  },
})

/** Two widgets follow the global range; `errors` is the one a visitor overrides. */
const overview = defineControls({
  id: 'overview',
  scope: 'page',
  fields: {
    region: field
      .enum(['all', 'eu', 'us'], 'all')
      .labels({ all: 'All regions', eu: 'EU', us: 'US' }),
    env: field.enum(['prod', 'staging'], 'prod').labels({ prod: 'Production', staging: 'Staging' }),
  },
  widgets: {
    requests: { range: globals.field.range },
    errors: { range: globals.field.range },
  },
})

const NOW = Date.UTC(2026, 10, 12, 12, 0)

type Day = { day: Date; requests: number; errors: number }

const DAYS: Day[] = Array.from({ length: 30 }, (_, i) => ({
  day: new Date(Date.UTC(2026, 9, 14 + i)),
  requests: 400 + Math.round(Math.sin(i / 3) * 120) + i * 8,
  errors: 12 + Math.round(Math.cos(i / 4) * 5),
}))

const PROJECTS = [
  { label: 'checkout', value: 2400, secondary: '34%' },
  { label: 'search', value: 1900, secondary: '27%' },
  { label: 'billing', value: 1200, secondary: '17%' },
  { label: 'auth', value: 900, secondary: '13%' },
]

const EVENTS = [
  { id: 'e1', at: NOW - 3_600_000, actor: 'Ada', title: 'merged pull request 412' },
  { id: 'e2', at: NOW - 9_000_000, actor: 'Lin', title: 'opened pull request 98', chips: ['ci'] },
  { id: 'e3', at: NOW - 40_000_000, title: 'deploy to production finished' },
]

// #region stat-group
const health = (
  <StatGroup variant="strip" label="Service health">
    <StatCell label="Uptime" value="99.98" unit="%" sub="30 days" />
    <StatCell label="p95" value={182} unit="ms" delta={{ value: '-4%', polarity: 'up-bad' }} />
    <StatCell label="Open incidents" value={0} />
  </StatGroup>
)
// #endregion

// #region stat-card
const requests = (
  <StatCard
    title="Requests"
    subtitle="follows the page range"
    value={12840}
    unit="req"
    controls={filterSlot([spec(overview.widget.requests.range, 'Range')])}
  />
)
const errors = (
  <StatCard
    title="Errors"
    subtitle="own range"
    value={212}
    delta={{ value: '+3%', polarity: 'up-bad' }}
    controls={filterSlot([spec(overview.widget.errors.range, 'Range')])}
  />
)
// #endregion

// #region chart-card
const trend = (
  <ChartCard
    data-testid="ov-chart"
    title="Requests"
    subtitle="per day"
    value="12,840"
    info="Requests served per day."
  >
    <Lines<Day, Date>
      ariaLabel="Requests per day, 30 days"
      data={DAYS}
      x={(d) => d.day}
      series={[
        {
          key: 'requests',
          label: 'Requests',
          color: demoColors.sessions,
          getValue: (d) => d.requests,
        },
      ]}
    />
  </ChartCard>
)
// #endregion

// #region bar-list
const projects = <BarList title="Top projects" items={PROJECTS} />
// #endregion

// #region data-panel
const breakdown = (
  <DataPanel
    title="Breakdown"
    skeleton={{ rows: 5 }}
    body={() => (
      <div className="flex flex-col gap-4">
        {projects}
        <EventList title="Activity" now={NOW} items={EVENTS} />
      </div>
    )}
  />
)
// #endregion

// #region filter-set
const filters = (
  <FilterSet
    specs={[spec(overview.field.region, 'Region'), spec(overview.field.env, 'Environment')]}
  />
)
// #endregion

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] items-start gap-4'

function OverviewRoute(): ReactElement {
  useV3Tokens()
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="ov-root">
      <PageBar controls={filterSlot([spec(globals.field.range, 'Range')])} />
      <div data-testid="ov-filters">{filters}</div>
      {health}
      <div className={GRID}>
        <div data-testid="ov-bound">{requests}</div>
        <div data-testid="ov-override">{errors}</div>
      </div>
      {trend}
      <div className={GRID}>{breakdown}</div>
    </div>
  )
}

export const Route = createFileRoute('/overview')({
  staticData: { title: 'Overview' },
  validateSearch: overview.validateSearch,
  search: { middlewares: overview.middlewares },
  component: OverviewRoute,
})
