import { useQuery } from '@tanstack/react-query'
import { DataPanel } from 'basalt-ui/cards'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import type { ReactElement } from 'react'
import { OVERLAYS } from './overlays'
import { workoutsQueries } from './queries'
import { EXERCISE_LABEL } from './synthetic'
import type { SetRow, WorkoutRow } from './synthetic'

/** The row the table draws: argo's `WorkoutRow` with the three display strings its cells computed. */
type Row = {
  id: string
  date: string
  exercise: string
  sets: string
  topSet: string
  total_volume: number
  estimated_1rm: number | null
}

const isWork = (s: SetRow) => s.set_type === 'work' || s.set_type === 'amrap'

function formatSets(sets: SetRow[]): string {
  const work = sets.filter(isWork)
  const warmup = sets.length - work.length
  const head = `${work.length} work`
  return warmup > 0 ? `${head} + ${warmup} WU` : head
}

function topSet(sets: SetRow[]): string {
  const best = sets
    .filter(isWork)
    .reduce<SetRow | undefined>(
      (b, s) => (b === undefined || s.weight_kg > b.weight_kg ? s : b),
      undefined,
    )
  return best === undefined ? '—' : `${best.weight_kg} kg × ${best.reps}`
}

const toRow = (w: WorkoutRow): Row => ({
  id: String(w.id),
  date: w.date,
  exercise: EXERCISE_LABEL[w.exercise_id],
  sets: formatSets(w.sets),
  topSet: topSet(w.sets),
  total_volume: w.total_volume,
  estimated_1rm: w.estimated_1rm,
})

export function WorkoutsTable(): ReactElement {
  const query = useQuery(workoutsQueries.list({ page: 1, limit: 50 }))
  const rows = query.data?.data.map(toRow)

  const table = useDataTable<Row>({
    id: 'strength-workouts',
    label: 'Workouts',
    getRowId: (r) => r.id,
    data: rows,
    mode: { kind: 'client' },
    phase: query,
    pager: 'none',
    columns: [
      col<Row>().date('date', { header: 'Date', priority: 1, card: 'subtitle' }),
      col<Row>().entity('exercise', { header: 'Exercise', priority: 1, card: 'title' }),
      col<Row>().text('sets', { header: 'Sets', priority: 3, card: 'meta', sortable: false }),
      col<Row>().text('topSet', { header: 'Top set', priority: 2, card: 'meta', sortable: false }),
      col<Row>().number('total_volume', {
        header: 'Volume',
        unit: 'kg',
        priority: 2,
        card: 'meta',
      }),
      col<Row>().number('estimated_1rm', {
        header: 'e1RM',
        unit: 'kg',
        digits: 1,
        priority: 1,
        card: 'value',
      }),
      col<Row>().actions([
        { key: 'edit', label: 'Edit', onClick: () => {} },
        {
          key: 'delete',
          label: 'Delete',
          onClick: (row) =>
            OVERLAYS.open('workout:delete', {
              body: `Delete ${row.exercise} on ${row.date}? This cannot be undone.`,
              confirmLabel: 'Delete',
              onConfirm: () => {},
            }),
        },
      ]),
    ],
  })

  return (
    <DataPanel
      title="Workouts"
      phase={query}
      empty={rows?.length === 0 ? { cause: 'No workouts logged yet' } : null}
      skeleton={{ height: 560 }}
      body={() => <DataTable table={table} height="fill" />}
    />
  )
}
