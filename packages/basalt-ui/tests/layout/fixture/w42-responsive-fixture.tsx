import { Box, Card } from '@mantine/core'
import { useState } from 'react'
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
// Offsets from module load, so the relative-time text (and so the column's width) never drifts
// with the wall clock — the same device as `W37_SYNCED_AT` in fixtures.tsx.
const LOADED_AT = Date.now()
const daysAgo = (days: number): string => new Date(LOADED_AT - days * 86_400_000).toISOString()
const SESSION_ROWS: SessionRow[] = [
  {
    exercise: 'Overhead press (strict, no leg drive, paused)',
    date: daysAgo(2),
    result: 'PR',
    e1rm: 72,
    volume: 1080,
    sets: 3,
  },
  {
    exercise: 'Squat',
    date: daysAgo(4),
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

type OutageRow = { start: string; minutes: number; scope: string; cause: string }
const outage = createColumnHelper<OutageRow>()
const OUTAGE_ROWS: OutageRow[] = [
  { start: daysAgo(1), minutes: 23, scope: 'dns', cause: 'ISP upstream fault' },
  { start: daysAgo(3), minutes: 6, scope: 'wan', cause: 'Line retrain' },
  { start: daysAgo(5), minutes: 47, scope: 'wan', cause: 'ISP upstream fault' },
  { start: daysAgo(7), minutes: 9, scope: 'lan', cause: 'Modem reboot' },
]
// The playground's S1 outage log: a short category word, a cause with no kind, nothing prioritised.
const OUTAGE_COLUMNS = [
  outage.accessor('start', { header: 'Started', meta: { kind: 'relative-time' } }),
  outage.accessor('minutes', { header: 'Duration (min)', meta: { kind: 'number' } }),
  outage.accessor('scope', {
    header: 'Scope',
    cell: (c) => c.getValue().toUpperCase(),
    meta: { kind: 'text' },
  }),
  outage.accessor('cause', { header: 'Cause' }),
]

// Fourteen numeric columns: at 390 the fold takes the table to its floor, a two-digit count.
const WIDE_KEYS = Array.from({ length: 14 }, (_, i) => `m${i}`)
type WideRow = Record<string, number>
const wide = createColumnHelper<WideRow>()
const WIDE_ROWS: WideRow[] = [Object.fromEntries(WIDE_KEYS.map((k, i) => [k, 1000 + i]))]
const WIDE_COLUMNS = WIDE_KEYS.map((k, i) =>
  wide.accessor(k, { header: `Metric ${i}`, meta: { kind: 'number', priority: i + 1 } }),
)

/** Wave 42 responsive tables: argo's workouts shape and S2's sessions shape in a fixed-width card (`w42-responsive`). */
export function W42ResponsiveFixture({ spec }: { spec: W42ResponsiveSpec }): ReactElement {
  const [refetching, setRefetching] = useState(false)
  const loading = spec.loading === true || refetching
  // A refetch keeps its rows: the skeleton replaces them, the headers stay.
  const keepRows = spec.loading !== true
  const select = spec.select === true
  const table =
    spec.shape === 'wide' ? (
      <BasaltDataTable
        title="Wide"
        data={keepRows ? WIDE_ROWS : []}
        columns={WIDE_COLUMNS}
        enableSorting={false}
        isLoading={loading}
      />
    ) : spec.shape === 'outages' ? (
      <BasaltDataTable
        title="Outages"
        data={keepRows ? OUTAGE_ROWS : []}
        columns={OUTAGE_COLUMNS}
        enableSorting={false}
        enableRowSelection={select}
        isLoading={loading}
      />
    ) : spec.shape === 'workouts' ? (
      <BasaltDataTable
        title="Workouts"
        data={keepRows ? WORKOUT_ROWS : []}
        columns={WORKOUT_COLUMNS}
        highlightOnHover
        striped
        isLoading={loading}
      />
    ) : (
      <BasaltDataTable
        title="Sessions"
        data={keepRows ? SESSION_ROWS : []}
        columns={SESSION_COLUMNS}
        highlightOnHover
        striped
        isLoading={loading}
      />
    )
  return (
    <Box data-testid="w42-responsive" {...(spec.width !== undefined && { w: spec.width })}>
      {spec.reload === true && (
        <button type="button" data-testid="w42-reload" onClick={() => setRefetching((on) => !on)}>
          reload
        </button>
      )}
      {spec.onPage === true ? table : <Card>{table}</Card>}
    </Box>
  )
}
