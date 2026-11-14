/**
 * The `k2-table` document fixture: `DataTable` on its own markup, no shell. Probes, each a
 * `data-testid` box around one table:
 * - `k2-table-entity`: entity cells with a `sub` line;
 * - `k2-table-narrow`: four kinded columns with a long id and sub, in the tier the viewport gives;
 * - `k2-table-scroll`: the same columns with `phone: 'scroll'`, so cells keep their column width;
 * - `k2-table-mid`: the same columns in a 560 px box (the reduced tier, columns side by side);
 * - `k2-table-ready-<14|17>`: a loaded table of that many rows;
 * - `k2-table-reload-<14|17>`: the same, flipped to loading by `window.k2Loading(id, true)`.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'
import type { UseDataTable } from '../../../src/table/contract'

type Row = { id: string; name: string; sub: string; state: string; change: number; base: number }

const LONG_NAME = 'eval-005-regression-suite-with-an-unusually-long-case-identifier'
const LONG_SUB = 'Sort ascending by the second column and keep the first as written'

const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    name: i === 0 ? LONG_NAME : `eval-${String(i).padStart(3, '0')}`,
    sub: i === 0 ? LONG_SUB : 'Sort ascending',
    state: i % 2 === 0 ? 'Passed' : 'Failed',
    change: i % 3 === 0 ? 0.12 : -3.4,
    base: 1000 + i * 37,
  }))

const c = col<Row>()

function columns(): UseDataTable<Row>['columns'] {
  return [
    c.entity('name', { header: 'Case', sub: (r) => r.sub }),
    c.status('state', { header: 'Result', options: ['Passed', 'Failed'] }),
    c.delta('change', { header: 'Change', polarity: 'up-good', unit: '%' }),
    c.number('base', { header: 'Baseline' }),
  ]
}

const loaders = new Map<string, (loading: boolean) => void>()
;(window as unknown as { k2Loading: (id: string, loading: boolean) => void }).k2Loading = (
  id,
  loading,
) => loaders.get(id)?.(loading)

function Probe({
  id,
  count,
  phone,
}: {
  id: string
  count: number
  phone?: 'cards' | 'scroll'
}): ReactElement {
  const [loading, setLoading] = useState(false)
  loaders.set(id, setLoading)
  const t = useDataTable<Row>({
    id,
    label: id,
    columns: columns(),
    data: loading ? undefined : rows(count),
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    ...(phone !== undefined && { phone }),
  })
  return <DataTable table={t} />
}

const PROBES: { id: string; count: number; phone?: 'cards' | 'scroll'; width?: number }[] = [
  { id: 'k2-table-entity', count: 4 },
  { id: 'k2-table-narrow', count: 4 },
  { id: 'k2-table-scroll', count: 4, phone: 'scroll' },
  { id: 'k2-table-mid', count: 4, width: 560 },
  { id: 'k2-table-ready-14', count: 14 },
  { id: 'k2-table-ready-17', count: 17 },
  { id: 'k2-table-reload-14', count: 14 },
  { id: 'k2-table-reload-17', count: 17 },
]

function Fixture(): ReactElement {
  return (
    // theme-allow -- the wrappers are the probe's payload (tables in a column)
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      {PROBES.map(({ id, count, phone, width }) => (
        <div
          key={id}
          data-testid={id}
          className="min-w-0"
          style={width === undefined ? undefined : { width }}
        >
          <Probe id={id} count={count} {...(phone !== undefined && { phone })} />
        </div>
      ))}
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
