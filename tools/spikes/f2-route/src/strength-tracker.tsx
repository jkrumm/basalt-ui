import { useQuery } from '@tanstack/react-query'
import { createRoute } from '@tanstack/react-router'
import { filterSlot, spec } from 'basalt-ui/controls'
import { EmptyState, Page, PageAside, PageBar, Section, useSizeClass } from 'basalt-ui/page'
import { Card } from 'basalt-ui/ui/card'
import type { ReactElement } from 'react'
import { strength } from './controls'
import { Overview } from './overview'
import { strengthQueries, workoutsQueries } from './queries'
import { rootRoute } from './router'
import { SparklineGrid } from './sparkline-grid'
import { EXERCISES } from './synthetic'
import type { StrengthParams } from './synthetic'
import { WorkoutsTable } from './workouts-table'

const activeExercises = (selected: readonly string[]): readonly string[] =>
  selected.length > 0 ? selected : EXERCISES

export const strengthRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/strength-tracker',
  validateSearch: strength.validateSearch,
  search: { middlewares: strength.middlewares },
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    const params = paramsOf(deps)
    return Promise.all([
      context.queryClient.ensureQueryData(strengthQueries.heroes(params)),
      context.queryClient.ensureQueryData(workoutsQueries.list({ page: 1, limit: 50 })),
      ...(deps.tab === 'charts'
        ? [context.queryClient.ensureQueryData(strengthQueries.sparklines(params))]
        : []),
    ])
  },
  component: StrengthTrackerPage,
})

type Values = ReturnType<typeof strength.useValues>

/** The field's own `window:` resolvers turn `3m`/`6m`/`1y`/`ytd` into `from`/`to`; the rest is a preset. */
function paramsOf(search: Values): StrengthParams {
  const window = strength.field.window.toWindow({
    preset: search.window,
    from: search.from,
    to: search.to,
  })
  return { ...window, exercises: activeExercises(search.exercises).join(',') }
}

function StrengthTrackerPage(): ReactElement {
  const search = strength.useValues()
  const size = useSizeClass()
  const phone = size === 'compact'
  const params = paramsOf(search)

  // argo hides the Train tab on desktop (`only: 'sm-down'`); the catalogue is the runtime list.
  const tabOptions = (['train', 'charts', 'history'] as const)
    .filter((t) => phone || t !== 'train')
    .map((value) => ({
      value,
      label: { train: 'Train', charts: 'Charts', history: 'History' }[value],
    }))

  const list = useQuery(workoutsQueries.list({ page: 1, limit: 50 }))
  const hasWorkouts = (list.data?.total ?? 1) > 0

  return (
    <Page area="strength">
      <PageBar
        title="Strength"
        tabs={filterSlot([
          spec(strength.field.tab, 'View', { options: tabOptions, as: 'segmented' }),
        ])}
        controls={filterSlot([
          spec(strength.field.window, 'Range'),
          spec(strength.field.exercises, 'Exercises'),
        ])}
      />
      {search.tab === 'train' ? (
        <TrainingTools />
      ) : !hasWorkouts ? (
        <Card data-shot="empty-workouts">
          <EmptyState why="No workouts logged. Log a set to start the 28 d trend." />
        </Card>
      ) : search.tab === 'charts' ? (
        <ChartsPanel params={params} />
      ) : (
        <WorkoutsTable />
      )}
      {phone ? null : (
        <PageAside title="Training" width={320}>
          <TrainingTools />
        </PageAside>
      )}
    </Page>
  )
}

function ChartsPanel({ params }: { params: StrengthParams }): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <Overview params={params} />
      <SparklineGrid params={params} />
      <Section
        title="Where training and recovery disagree, last 90 d"
        summary="Lifts that trained up while recovery fell"
        collapsible={{ defaultOpen: false }}
        controls={filterSlot([spec(strength.field.exercises, 'Lifts')])}
      >
        <p className="text-sm text-muted-foreground">Detail not ported.</p>
      </Section>
    </div>
  )
}

/** The logger and rest timer are forms and a clock, outside the five layers this spike ports. */
function TrainingTools(): ReactElement {
  return (
    <Card data-shot="strength-log">
      <p className="text-sm text-muted-foreground">Workout logger and rest timer: not ported.</p>
    </Card>
  )
}
