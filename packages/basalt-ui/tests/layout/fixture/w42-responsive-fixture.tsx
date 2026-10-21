import { Box, Card } from '@mantine/core'
import type { ReactElement } from 'react'
import { BasaltDataTable, createColumnHelper } from '../../../src/table'
import type { FixtureSpec } from './spec'

type W42ResponsiveSpec = NonNullable<FixtureSpec['w42Responsive']>

// An entity cell the way argo and the playground draw one: a colour dot, then the name on one line.
const dotted = (c: { getValue: () => string }): ReactElement => (
  <span>
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        marginInlineEnd: 6,
        borderRadius: '50%',
        background: 'currentColor',
      }}
    />
    {c.getValue()}
  </span>
)

type WorkoutRow = {
  date: string
  exercise: string
  sets: number
  top: string
  volume: number
  e1rm: number
}
const workout = createColumnHelper<WorkoutRow>()
const WORKOUT_ROWS: WorkoutRow[] = [
  {
    date: '2026-10-14',
    exercise: 'Romanian deadlift (barbell, paused, 3-1-1 tempo)',
    sets: 4,
    top: '100 kg × 5',
    volume: 3200,
    e1rm: 117,
  },
  { date: '2026-10-12', exercise: 'Squat', sets: 5, top: '120 kg × 3', volume: 3400, e1rm: 132 },
  {
    date: '2026-10-09',
    exercise: 'Overhead press (strict, no leg drive, paused)',
    sets: 3,
    top: '60 kg × 6',
    volume: 1080,
    e1rm: 72,
  },
]
// argo workouts-table: six columns, NO `meta.priority`, the exercise an entity with a dot.
const WORKOUT_COLUMNS = [
  workout.accessor('date', { header: 'Date', meta: { kind: 'text' } }),
  workout.accessor('exercise', { header: 'Exercise', cell: dotted, meta: { kind: 'entity' } }),
  workout.accessor('sets', { header: 'Sets', meta: { kind: 'number' } }),
  workout.accessor('top', { header: 'Top set', meta: { kind: 'text' } }),
  workout.accessor('volume', { header: 'Volume (kg)', meta: { kind: 'number' } }),
  workout.accessor('e1rm', { header: 'Est. 1RM (kg)', meta: { kind: 'number' } }),
]

type SessionRow = {
  exercise: string
  date: string
  result: string
  e1rm: number
  volume: number
  sets: number
}
const session = createColumnHelper<SessionRow>()
const SESSION_ROWS: SessionRow[] = [
  {
    exercise: 'Overhead press (strict, no leg drive, paused)',
    date: '2026-10-19T09:00:00Z',
    result: 'PR',
    e1rm: 72,
    volume: 1080,
    sets: 3,
  },
  {
    exercise: 'Squat',
    date: '2026-10-17T09:00:00Z',
    result: 'Held',
    e1rm: 132,
    volume: 3400,
    sets: 5,
  },
]
// The playground's S2 sessions log: `priority` folds sets, volume, 1RM, result in that order.
const SESSION_COLUMNS = [
  session.accessor('exercise', {
    header: 'Exercise',
    cell: dotted,
    meta: { kind: 'entity', priority: 1 },
  }),
  session.accessor('date', { header: 'Date', meta: { kind: 'relative-time', priority: 2 } }),
  session.accessor('result', { header: 'Result', meta: { kind: 'status', priority: 3 } }),
  session.accessor('e1rm', { header: 'Est. 1RM (kg)', meta: { kind: 'number', priority: 4 } }),
  session.accessor('volume', { header: 'Volume (kg)', meta: { kind: 'number', priority: 5 } }),
  session.accessor('sets', { header: 'Sets', meta: { kind: 'number', priority: 6 } }),
]

/** Wave 42 responsive tables: argo's workouts shape and S2's sessions shape in a fixed-width card (`w42-responsive`). */
export function W42ResponsiveFixture({ spec }: { spec: W42ResponsiveSpec }): ReactElement {
  const loading = spec.loading === true
  return (
    <Box data-testid="w42-responsive" {...(spec.width !== undefined && { w: spec.width })}>
      <Card>
        {spec.shape === 'workouts' ? (
          <BasaltDataTable
            title="Workouts"
            data={loading ? [] : WORKOUT_ROWS}
            columns={WORKOUT_COLUMNS}
            highlightOnHover
            striped
            isLoading={loading}
          />
        ) : (
          <BasaltDataTable
            title="Sessions"
            data={loading ? [] : SESSION_ROWS}
            columns={SESSION_COLUMNS}
            highlightOnHover
            striped
            isLoading={loading}
          />
        )}
      </Card>
    </Box>
  )
}
