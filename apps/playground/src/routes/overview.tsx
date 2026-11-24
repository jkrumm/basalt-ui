import { createFileRoute } from '@tanstack/react-router'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { BarList, EventList, StatCard, StatCell, StatGroup } from 'basalt-ui/cards'
import type { QueryStateLike } from 'basalt-ui/cards'
import { ChartCard, Lines } from 'basalt-ui/charts'
import { FilterSet, ViewTabs, filterSlot, spec } from 'basalt-ui/controls'
import { defineControls, field } from 'basalt-ui/router'
import type { ComponentProps, ReactElement } from 'react'
import { BASALT } from 'basalt-ui/tokens'
import { useFixture } from '../demo/fixture'

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
    tab: field
      .enum(['overview', 'activity'], 'overview', { history: 'push' })
      .labels({ overview: 'Overview', activity: 'Activity' }),
  },
  widgets: {
    requests: { range: globals.field.range },
    errors: { range: globals.field.range },
  },
})

const ACCENT = { light: BASALT.brand, dark: BASALT.brand }

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

type Overview = { days: readonly Day[]; projects: typeof PROJECTS; events: typeof EVENTS }

const OVERVIEW: Overview = { days: DAYS, projects: PROJECTS, events: EVENTS }
const NO_OVERVIEW: Overview = { days: [], projects: [], events: [] }

type Frame = { phase: QueryStateLike }

// #region stat-group
const health = ({ phase }: Frame) => (
  <StatGroup variant="strip" label="Service health">
    <StatCell
      phase={phase}
      title="Uptime"
      subtitle="30 days"
      value="99.98"
      unit="%"
      status={{ tone: 'good', label: 'Above the 99.9 % target' }}
    />
    <StatCell
      phase={phase}
      title="p95"
      value={182}
      unit="ms"
      delta={{ value: '-4%', polarity: 'up-bad', label: 'vs prior 7 days' }}
    />
    <StatCell
      phase={phase}
      title="Open incidents"
      value={0}
      status={{ tone: 'good', label: 'None open' }}
    />
  </StatGroup>
)
// #endregion

// #region stat-card
const requests = ({ phase }: Frame) => (
  <StatCard
    phase={phase}
    title="Requests"
    subtitle="follows the page range"
    value={12840}
    unit="req"
    controls={filterSlot([spec(overview.widget.requests.range, 'Range')])}
  />
)
const errors = ({ phase }: Frame) => (
  <StatCard
    phase={phase}
    title="Errors"
    subtitle="own range"
    value={212}
    delta={{ value: '+3%', polarity: 'up-bad' }}
    controls={filterSlot([spec(overview.widget.errors.range, 'Range')])}
  />
)
// #endregion

// #region chart-card
const trend = ({ phase }: Frame, days: readonly Day[] | undefined) => (
  <ChartCard
    phase={phase}
    empty={days?.length === 0 ? { cause: 'No requests served in the last 30 days.' } : null}
    title="Requests"
    subtitle="per day, last 30 days"
    info="Requests served per day."
    figure={
      days === undefined || days.length === 0
        ? undefined
        : {
            value: `${Math.round(days.reduce((sum, d) => sum + d.requests, 0) / days.length)} / day`,
          }
    }
    chart={() =>
      days === undefined ? null : (
        <Lines
          label="Requests per day, 30 days"
          data={days}
          x={{ value: (d) => d.day }}
          series={[
            {
              mark: 'line',
              key: 'requests',
              label: 'Requests',
              color: ACCENT,
              y: (d) => d.requests,
            },
          ]}
        />
      )
    }
  />
)
// #endregion

// #region bar-list
const projects = ({ phase }: Frame, items: Overview['projects'] | undefined) => (
  <BarList
    title="Top projects"
    phase={phase}
    empty={items?.length === 0 ? { cause: 'No project served a request yet.' } : null}
    items={items ?? []}
  />
)
// #endregion

// #region data-panel
const activity = ({ phase }: Frame, items: Overview['events'] | undefined) => (
  <EventList
    title="Activity"
    now={NOW}
    phase={phase}
    empty={items?.length === 0 ? { cause: 'Nothing happened in the last 7 days.' } : null}
    items={items ?? []}
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

// #region view-tabs
const tabs: NonNullable<ComponentProps<typeof PageBar>['tabs']> = {
  kind: 'controls-slot',
  count: 1,
  render: () => <ViewTabs state={overview.field.tab} label="Overview view" />,
}
// #endregion

function OverviewRoute(): ReactElement {
  const [tab] = overview.field.tab.use()
  const query = useFixture(['overview'], OVERVIEW, NO_OVERVIEW)
  const frame: Frame = { phase: query }
  return (
    <Page area="overview">
      <PageBar tabs={tabs} controls={filterSlot([spec(globals.field.range, 'Range')])} />
      <div data-testid="ov-filters">{filters}</div>
      {tab === 'overview' ? (
        <>
          {health(frame)}
          <CardGrid min="regular">
            <div data-testid="ov-bound">{requests(frame)}</div>
            <div data-testid="ov-override">{errors(frame)}</div>
          </CardGrid>
          {trend(frame, query.data?.days)}
        </>
      ) : null}
      <CardGrid min="regular">
        {projects(frame, query.data?.projects)}
        {activity(frame, query.data?.events)}
      </CardGrid>
    </Page>
  )
}

export const Route = createFileRoute('/overview')({
  staticData: { title: 'Overview' },
  validateSearch: overview.validateSearch,
  search: { middlewares: overview.middlewares },
  component: OverviewRoute,
})
