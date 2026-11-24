/**
 * The `charts-expr6-contract` fixture (v3-expr-6-contract (b)): each text slot that carries a time or
 * an id twice, once in the mono face (`*-mono`) and once without the flag (`*-sans`), so the test
 * compares the face and the height of the same card. No shell. Entry of
 * `charts-expr6-contract.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { StatCard } from '../../../src/cards/stat-card'
import { StatCell } from '../../../src/cards/stat-cell'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

const WHEN = '2026-11-16 03:12 UTC'

function Figure(props: { id: string; mono: boolean }) {
  return (
    <div data-testid={props.id} className="min-w-0">
      <ChartCard
        title="Signal"
        figure={{
          value: -56,
          unit: 'dBm',
          delta: { value: '+9 dB', polarity: 'up-good' },
          period: WHEN,
          periodMono: props.mono,
        }}
        chart={() => <div />}
      />
    </div>
  )
}

function Cell(props: { id: string; mono: boolean }) {
  return (
    <div data-testid={props.id} className="min-w-0">
      <StatCell title="Last drop" value={3} unit="min" sub={WHEN} subMono={props.mono} />
    </div>
  )
}

function Card(props: { id: string; mono: boolean }) {
  return (
    <div data-testid={props.id} className="min-w-0">
      <StatCard title="Last drop" value={3} unit="min" sub={WHEN} subMono={props.mono} />
    </div>
  )
}

type Model = { id: string; name: string; modelId: string; cost: number }
const MODELS: Model[] = Array.from({ length: 4 }, (_, i) => ({
  id: `m${i}`,
  name: `Alder ${['Flash', 'Pro', 'Mini', 'Max'][i]}`,
  modelId: `alder-${i}-2026-11-01`,
  cost: 1 + i,
}))
const c = col<Model>()

function Table(props: { id: string; mono: boolean }) {
  const t = useDataTable<Model>({
    id: props.id,
    label: props.id,
    columns: [
      c.entity('name', { header: 'Model', sub: (r) => r.modelId, subMono: props.mono }),
      c.number('cost', { header: 'Cost' }),
    ],
    data: MODELS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return (
    <div data-testid={props.id} className="min-w-0">
      <DataTable table={t} />
    </div>
  )
}

function Fixture() {
  return (
    <main className="flex max-w-3xl min-w-0 flex-col gap-6 p-4 text-foreground">
      <h1 className="text-lg font-medium">Expression 6 contract</h1>
      <Figure id="figure-mono" mono />
      <Figure id="figure-sans" mono={false} />
      <Cell id="cell-mono" mono />
      <Cell id="cell-sans" mono={false} />
      <Card id="card-mono" mono />
      <Card id="card-sans" mono={false} />
      <Table id="table-mono" mono />
      <Table id="table-sans" mono={false} />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
