/**
 * The `lists-focus` fixture: one `useChartFocus` shared by a `CartesianChart` (bars), a `DataTable`
 * and a `BarList` over the same rows. `data-focus-index` on the wrapper carries `focus.index` so the
 * test reads it. Entry of `lists-focus.layout.test.ts`, which bundles it in memory.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { BarList } from '../../../src/cards/bar-list'
import { useChartFocus } from '../../../src/charts/focus'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Row = { id: string; name: string; value: number }
const ROWS: readonly Row[] = [
  { id: 'argo', name: 'argo', value: 1840 },
  { id: 'rb', name: 'rb', value: 920 },
  { id: 'linewatch', name: 'linewatch', value: 460 },
  { id: 'meteo', name: 'meteo', value: 310 },
  { id: 'rollhook', name: 'rollhook', value: 120 },
]
const COLOR = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }
const c = col<Row>()

function Fixture(): ReactElement {
  const focus = useChartFocus(ROWS, { announce: (d) => `${d.name}: ${d.value}` })
  const table = useDataTable<Row>({
    id: 'lists-focus',
    label: 'Projects',
    columns: [c.text('name', { header: 'Name' }), c.number('value', { header: 'Tokens' })],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    onRowActivate: () => undefined,
  })
  return (
    <main
      data-testid="lf-root"
      data-focus-index={focus.index ?? ''}
      className="flex flex-col gap-4 p-4"
    >
      <div data-testid="lf-chart">
        <ChartCard
          title="Tokens by project"
          chart={() => (
            <CartesianChart
              label="Tokens by project"
              data={ROWS}
              x={{ value: (d) => d.name }}
              series={[
                { key: 'value', label: 'Tokens', color: COLOR, mark: 'bar', y: (d) => d.value },
              ]}
              cursor="lists-focus"
              focus={focus}
            />
          )}
        />
      </div>
      <div data-testid="lf-table">
        <DataTable table={table} focus={focus} />
      </div>
      <div data-testid="lf-bars">
        <BarList
          title="Top projects"
          items={ROWS.map((r) => ({ label: r.name, value: r.value }))}
          focus={focus}
        />
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
