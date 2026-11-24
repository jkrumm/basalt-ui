/**
 * The `charts-expr4` fixture (v3-expr-4-kit-fixes): a `ChartCard` with a figure, a legend and a fill
 * `CartesianChart` (`ex-fill`), a card with a nine-character figure and a 30-character period
 * (`ex-figure`). No shell. Entry of `charts-expr4.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { useChartFocus } from '../../../src/charts/focus'
import { StatCard } from '../../../src/cards/stat-card'
import { Sparkline } from '../../../src/charts/parts/sparkline'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'
import type { UseDataTable } from '../../../src/table/contract'

type Row = { day: Date; a: number; b: number }
const day = (i: number): Date => new Date(Date.UTC(2026, 9, 5 + i))
const x = { value: (d: Row): Date => d.day }
const blue = { light: '#0b6bcb', dark: '#5aa9f0' }
const amber = { light: '#9a5b00', dark: '#e0a84a' }
const rows: Row[] = Array.from({ length: 14 }, (_, i) => ({
  day: day(i),
  a: 4 + (i % 5),
  // The two lines end together, so a phone keeps the legend this fixture is about (lines that end apart are named at their ends).
  b: i === 13 ? 6.9 : 2 + (i % 3),
}))

function FillCard(props: { id: string }) {
  const focus = useChartFocus(rows, { announce: (d) => `day ${d.a}` })
  return (
    <div data-testid={props.id} className="min-w-0">
      <ChartCard
        title={props.id}
        figure={{ value: 1234, period: 'last 14 days' }}
        chart={(box) => (
          <CartesianChart<Row>
            ariaLabel={props.id}
            data={rows}
            x={x}
            height={box.height}
            focus={focus}
            series={[
              { mark: 'line', key: 'a', label: 'Worked', color: blue, y: (d) => d.a },
              { mark: 'line', key: 'b', label: 'Idle', color: amber, y: (d) => d.b },
            ]}
          />
        )}
      />
    </div>
  )
}

type Item = { id: string; name: string; amount: number }
const items: Item[] = Array.from({ length: 12 }, (_, i) => ({
  id: `i${i}`,
  name: `Item ${i}`,
  amount: 100 + i,
}))
const c = col<Item>()

const SPARK = [1, 3, 2, 5, 4, 6]

function Stat(props: { id: string; phase: 'loading' | 'ready' }) {
  return (
    <div data-testid={props.id} className="min-w-0">
      <StatCard
        title="Commitment"
        phase={props.phase}
        value={1234}
        delta={{ value: '+5%', polarity: 'up-good' }}
        sub="vs last month"
        chart={(box) => <Sparkline series={SPARK} height={box.height} ariaLabel="Value" />}
        footer={[
          { label: 'Open', value: 12 },
          { label: 'Done', value: 4 },
        ]}
      />
    </div>
  )
}

function Table(props: { id: string; loading: boolean }) {
  const t = useDataTable<Item>({
    id: props.id,
    label: props.id,
    columns: [c.entity('name', { header: 'Name' }), c.number('amount', { header: 'Amount' })],
    ...(props.loading ? { phase: 'loading' } : { data: items }),
    getRowId: (r) => r.id,
    mode: { kind: 'server', rowCount: items.length },
    pager: 'pages',
  } as UseDataTable<Item>)
  return (
    <div data-testid={props.id} className="min-w-0">
      <DataTable table={t} />
    </div>
  )
}

function Ring() {
  const focus = useChartFocus(items, { announce: (d) => d.name })
  return (
    <div data-testid="ex-ring" className="min-w-0">
      <ChartCard
        title="Ring"
        chart={() => (
          <div
            {...focus.target}
            aria-label="Items"
            data-testid="ex-ring-target"
            className="flex flex-col gap-2 px-2"
          >
            {items.slice(0, 3).map((d, i) => (
              <div key={d.id} {...focus.item(i)} className="text-sm">
                {d.name}
              </div>
            ))}
          </div>
        )}
      />
    </div>
  )
}

function Fixture() {
  return (
    <main className="flex max-w-3xl min-w-0 flex-col gap-6 p-4 text-foreground">
      <h1 className="text-lg font-medium">Expression 4 kit fixes</h1>
      <FillCard id="ex-fill" />
      <Stat id="ex-stat-ready" phase="ready" />
      <Stat id="ex-stat-loading" phase="loading" />
      <Table id="ex-table-ready" loading={false} />
      <Table id="ex-table-loading" loading />
      <Ring />
      <div data-testid="ex-figure" className="min-w-0">
        <ChartCard
          title="Figure"
          figure={{
            value: '€2,907.50',
            period: 'No rides in the wind this week',
            delta: { value: '+5.6%', polarity: 'up-good' },
          }}
          chart={() => <div />}
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
