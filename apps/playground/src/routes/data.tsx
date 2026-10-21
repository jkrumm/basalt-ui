import { Stack } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
import { DataDemoPage } from '../demo/DataDemoPage'
import { queryFor, retryCopy, validateShotSearch } from '../scenarios/shot-state'
import type { ShotState } from '../scenarios/shot-state'

type Lift = { id: number; exercise: string; block: string; load: number }

const LIFTS: Lift[] = [
  { id: 1, exercise: 'Squat', block: 'Strength', load: 140 },
  { id: 2, exercise: 'Bench press', block: 'Strength', load: 100 },
  { id: 3, exercise: 'Deadlift', block: 'Strength', load: 180 },
  { id: 4, exercise: 'Squat', block: 'Volume', load: 110 },
  { id: 5, exercise: 'Bench press', block: 'Volume', load: 80 },
  { id: 6, exercise: 'Overhead press', block: 'Volume', load: 60 },
]

const lift = createColumnHelper<Lift>()
const LIFT_COLUMNS = [
  lift.accessor('exercise', { header: 'Exercise' }),
  lift.accessor('block', { header: 'Block' }),
  lift.accessor('load', { header: 'Load (kg)' }),
]

/** The full toolbar (SPEC § 6.6): title, search, two facets and an action on one 28px row. */
function ToolbarTable({ shotState }: { shotState: ShotState | undefined }) {
  const query = queryFor(shotState, retryCopy('workout log'))
  return (
    <div data-shot="table-toolbar" data-shot-states="empty loading error">
      <BasaltDataTable
        title="Workouts, strength and volume blocks"
        // Rows only at rest: the empty branch needs `data` empty, the others have no rows yet.
        data={shotState === undefined ? LIFTS : []}
        initialColumnFilters={[{ id: 'exercise', value: 'Squat' }]}
        {...(query !== undefined && { query })}
        emptyState={<span>No workout logged in this window.</span>}
        columns={LIFT_COLUMNS}
        enableGlobalFilter
        facets={[
          {
            columnId: 'exercise',
            label: 'Exercise',
            options: [
              { value: 'Squat', label: 'Squat' },
              { value: 'Bench press', label: 'Bench press' },
              { value: 'Deadlift', label: 'Deadlift' },
              { value: 'Overhead press', label: 'Overhead press' },
            ],
          },
          {
            columnId: 'block',
            label: 'Block',
            options: [
              { value: 'Strength', label: 'Strength' },
              { value: 'Volume', label: 'Volume' },
            ],
          },
        ]}
        actions={[{ key: 'export', label: 'Export CSV', onClick: () => undefined }]}
      />
    </div>
  )
}

function DataRoute() {
  const search = Route.useSearch()
  return (
    <Stack gap="md">
      <ToolbarTable shotState={search['shot-state']} />
      <DataDemoPage shotState={search['shot-state']} />
    </Stack>
  )
}

export const Route = createFileRoute('/data')({
  staticData: { title: 'Data' },
  validateSearch: validateShotSearch,
  component: DataRoute,
})
