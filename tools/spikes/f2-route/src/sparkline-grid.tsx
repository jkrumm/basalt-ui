import { useQuery } from '@tanstack/react-query'
import { DataPanel } from 'basalt-ui/cards'
import { Sparkline } from 'basalt-ui/charts'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import type { ReactElement } from 'react'
import { strengthQueries } from './queries'
import { EXERCISE_LABEL } from './synthetic'
import type { SparkRow, StrengthParams } from './synthetic'

type Row = SparkRow & { id: string; name: string; vel: number | null }

const latest = (data: readonly number[]): number | undefined => data.at(-1)

function FigureSpark({
  data,
  label,
  figure,
  form,
}: {
  data: readonly number[]
  label: string
  figure: (v: number) => string
  form: 'line' | 'area'
}): ReactElement {
  const v = latest(data)
  if (v === undefined) return <span className="text-muted-foreground">—</span>
  return (
    <span className="flex items-center gap-2">
      <Sparkline
        series={data}
        ariaLabel={label}
        height={28}
        width={80}
        form={form}
        format={figure}
      />
      <span className="text-sm">{figure(v)}</span>
    </span>
  )
}

export function SparklineGrid({ params }: { params: StrengthParams }): ReactElement {
  const query = useQuery(strengthQueries.sparklines(params))
  // A lift with no scored session in the window has no honest velocity: absent, not zero.
  const rows: Row[] | undefined = query.data?.map((r) => ({
    ...r,
    id: r.exercise_id,
    name: EXERCISE_LABEL[r.exercise_id],
    vel: r.stale ? null : r.vel,
  }))

  const table = useDataTable<Row>({
    id: 'strength-scan',
    label: 'Per-lift trend and load',
    getRowId: (r) => r.id,
    data: rows,
    mode: { kind: 'client' },
    phase: query,
    pager: 'none',
    columns: [
      col<Row>().entity('name', { header: 'Exercise', priority: 1, card: 'title' }),
      col<Row>().delta('vel', {
        header: 'Trend, 28 d',
        polarity: 'up-good',
        unit: '%/mo',
        priority: 1,
        card: 'badge',
      }),
      col<Row>().spark('volume', {
        header: 'Volume, last 10 training weeks',
        label: 'Weekly volume',
        priority: 2,
        card: 'meta',
        render: (r) => (
          <FigureSpark
            data={r.volume}
            label={`${r.name} weekly volume, last 10 training weeks`}
            figure={(v) => `${v.toFixed(1)} t`}
            form="area"
          />
        ),
      }),
      col<Row>().spark('inol', {
        header: 'INOL, last 15 sessions',
        label: 'INOL',
        priority: 3,
        card: 'meta',
        render: (r) => (
          <FigureSpark
            data={r.inol}
            label={`${r.name} INOL per session, last 15 sessions`}
            figure={(v) => v.toFixed(2)}
            form="line"
          />
        ),
      }),
    ],
  })

  return (
    <DataPanel
      title="Per-lift trend and load"
      info="Direction first, then the volume and INOL behind it."
      phase={query}
      empty={
        rows !== undefined && rows.length === 0
          ? { cause: 'No data — start logging workouts.' }
          : null
      }
      skeleton={{ height: 200 }}
      body={() => <DataTable table={table} height="fill" />}
    />
  )
}
