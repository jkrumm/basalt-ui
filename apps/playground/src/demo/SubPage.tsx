import { SimpleGrid } from '@mantine/core'
import { PageBar, Section, StatCard } from 'basalt-ui'
import { FilterSet, RangeFilter } from 'basalt-ui/controls'
import { DateRangePicker } from 'basalt-ui/controls-dates'
import { dashboardFilters } from './dashboard-range-store'

export type SubPageStat = {
  key: string
  title: string
  value: string
  delta?: number
}

export type SubPageProps = {
  title: string
  description: string
  /** The active range's label, appended to the section subtitle. */
  range?: string | undefined
  /** A small, real KPI panel (via the shipped `StatCard`) — proves the sub-route renders live
   * data, not a placeholder. Keep it to a couple of stats; this is not a second dashboard. */
  stats: readonly SubPageStat[]
}

/**
 * The shared body of the three `/dashboard/*` sub-routes.
 *
 * It renders its OWN `PageBar` rather than inheriting one from the `/dashboard` layout route, and
 * that is the point: a page has exactly one `PageBar` (law C6), so a layout route rendering one
 * would collide with the index page's — which carries actions and sync these three do not have.
 * Each sub-page therefore declares the one home it needs, holding the one filter it reads. Without
 * it these routes would show a window in their subtitle with no control anywhere to change it.
 *
 * The heading is a `Section` — the shipped `WidgetHeader tier="section"` composer — not a
 * hand-rolled title row, so it can never drift from the card chrome around it (law C8). The page
 * title itself is the breadcrumb (`staticData.title`).
 */
export function SubPage({ title, description, range, stats }: SubPageProps) {
  return (
    <>
      <PageBar
        filters={
          <FilterSet>
            <RangeFilter field={dashboardFilters.field.range} customPicker={DateRangePicker} />
          </FilterSet>
        }
      />
      <Section
        title={title}
        subtitle={range === undefined ? description : `${description} · ${range}`}
        count={stats.length}
      >
        <SimpleGrid cols={2} spacing={14}>
          {stats.map((stat) => (
            <StatCard
              key={stat.key}
              title={stat.title}
              value={stat.value}
              {...(stat.delta !== undefined && { delta: stat.delta })}
            />
          ))}
        </SimpleGrid>
      </Section>
    </>
  )
}
