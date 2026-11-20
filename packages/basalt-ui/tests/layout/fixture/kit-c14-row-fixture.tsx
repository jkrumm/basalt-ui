/**
 * Expression cycle 14 contract (1), one height for the cards of a row (n64 .16, n65 .25): a ChartCard beside
 * a taller DataPanel (`c14-row-panel`), a StatCard beside a ChartCard (`c14-row-stat`), a ChartCard beside a
 * shorter DataPanel (`c14-row-short`), and a lone ChartCard outside any row (`c14-lone`). Entry of
 * `kit-c14-row.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { StatCard } from '../../../src/cards/stat-card'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { Lines } from '../../../src/charts/parts/lines'
import { CardGrid } from '../../../src/page/card-grid'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Day = { day: Date; load: number; score: number; rest: number }
const DAY_MS = 86_400_000
const START = Date.UTC(2026, 9, 1)
const DAYS: readonly Day[] = Array.from({ length: 30 }, (_, i) => ({
  day: new Date(START + i * DAY_MS),
  load: 40 + ((i * 13) % 50),
  score: 30 + ((i * 17) % 60),
  rest: 5 + ((i * 7) % 20),
}))
const blue = { light: 'var(--basalt-chart-1)', dark: 'var(--basalt-chart-1)' }
const dayOf = (d: Day): Date => d.day

type Site = { id: string; name: string; value: number }
const rowsOf = (n: number): Site[] =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, name: `Site ${i + 1}`, value: 10 + i }))
const c = col<Site>()
const COLUMNS = [c.entity('name', { header: 'Site' }), c.number('value', { header: 'Value' })]

function Chart({ testId }: { testId: string }): ReactElement {
  return (
    <div data-testid={testId} className="contents">
      <ChartCard
        title="Load"
        figure={{ value: 62, unit: '%' }}
        chart={(box) => (
          <Lines
            label="Load per day"
            data={DAYS}
            x={{ value: dayOf }}
            height={box.height}
            series={[
              { mark: 'line', key: 'load', label: 'Load', color: blue, y: (d: Day) => d.load },
            ]}
          />
        )}
      />
    </div>
  )
}

function Panel({ id, count }: { id: string; count: number }): ReactElement {
  const table = useDataTable<Site>({
    id,
    label: 'Sites',
    columns: COLUMNS,
    data: rowsOf(count),
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return (
    <div data-testid={id} className="contents">
      <DataPanel
        title="Sites"
        phase="ready"
        bodySize={{ rows: count + 1 }}
        body={() => <DataTable table={table} height="fill" />}
      />
    </div>
  )
}

function Fixture(): ReactElement {
  return (
    <main className="flex flex-col gap-8 p-4 text-foreground">
      <section data-testid="c14-row-panel">
        <CardGrid min="regular">
          <Chart testId="c14-row-panel-chart" />
          <Panel id="c14-row-panel-table" count={16} />
        </CardGrid>
      </section>
      <section data-testid="c14-row-stat">
        <CardGrid min="regular">
          <div data-testid="c14-row-stat-card" className="contents">
            <StatCard
              title="Ready"
              value={78}
              delta={{ value: '+11', polarity: 'up-good' }}
              phase="ready"
            />
          </div>
          <Chart testId="c14-row-stat-chart" />
        </CardGrid>
      </section>
      <section data-testid="c14-row-short">
        <CardGrid min="regular">
          <Chart testId="c14-row-short-chart" />
          <Panel id="c14-row-short-table" count={3} />
        </CardGrid>
      </section>
      <section data-testid="c14-lone" className="max-w-[880px]">
        <Chart testId="c14-lone-chart" />
      </section>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
