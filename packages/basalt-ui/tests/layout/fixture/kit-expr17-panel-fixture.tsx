/**
 * Expression cycle 17, a DataPanel whose table follows a chart's focus (`v3-expr-17-kit-fixes` 1 and 7, n82):
 * the table holds more rows than the body, so a focus on a late bar scrolls the table to its row. The panel
 * keeps its height through that scroll and shows whole rows. `data-testid` `k17-chart` boxes the chart and
 * `k17-panel` the panel. Entry of `kit-expr17-panel.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { Bars, useChartFocus } from '../../../src/charts'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Day = { key: string; name: string; value: number }
const DAYS: readonly Day[] = Array.from({ length: 14 }, (_, i) => ({
  key: `d${i}`,
  name: `Day ${i + 1}`,
  value: 4 + (i % 5),
}))
const c = col<Day>()
const COLUMNS = [c.text('name', { header: 'Day' }), c.number('value', { header: 'Votes' })]
const INK = { light: '#6b6b6b', dark: '#a8a8a8' }

function Fixture(): ReactElement {
  const focus = useChartFocus(DAYS, { announce: (d) => `${d.name}: ${d.value}` })
  const table = useDataTable<Day>({
    id: 'k17-days',
    label: 'Days',
    columns: COLUMNS,
    data: [...DAYS],
    getRowId: (r) => r.key,
    mode: { kind: 'client' },
  })
  return (
    <main className="grid content-start gap-4 p-4 text-foreground">
      <div data-testid="k17-chart" className="min-w-0">
        <Bars<Day>
          label="Votes per day"
          height={120}
          data={DAYS}
          focus={focus}
          tooltip={false}
          x={{ value: (d) => d.name }}
          series={[{ mark: 'bar', key: 'value', label: 'Votes', color: INK, y: (d) => d.value }]}
        />
      </div>
      <div data-testid="k17-panel" className="min-w-0">
        <DataPanel
          title="Days"
          phase="ready"
          bodySize={{ rows: 6 }}
          body={() => (
            <DataTable
              table={table}
              height="fill"
              focusItems={{ focus, holds: (row, item) => row.key === item.key }}
            />
          )}
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
