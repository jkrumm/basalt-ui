/**
 * The table plan and its kit defects (`v3-table-plan`): a table keeps its caption out of the first row at
 * 1800 and 390, a `phone: 'columns'` table shows a whole meter value, and a nine-column table has columns
 * the plan hides. `?view=plain|meter|nine` picks the table. Entry of `kit-plan-table.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Band = { band: string; days: number; rate: number; change: number }
const BANDS: readonly Band[] = [
  { band: 'Puell Multiple', days: 4120, rate: 100, change: -10.1 },
  { band: 'Pi Cycle Top', days: 2960, rate: 93.7, change: 7.1 },
  { band: 'RUPL / NUPL', days: 1880, rate: 71, change: -10.9 },
  { band: 'Woobull Top Cap', days: 640, rate: 8, change: -24.6 },
]
const b = col<Band>()

function Plain(): ReactElement {
  const table = useDataTable<Band>({
    id: 'plan-plain',
    label: 'Hit rate by band',
    columns: [
      b.entity('band', { header: 'Band', priority: 1 }),
      b.number('days', { header: 'Days', priority: 2, card: 'meta' }),
      b.number('rate', { header: 'Rate', priority: 2, card: 'value' }),
    ],
    data: BANDS,
    getRowId: (r) => r.band,
    mode: { kind: 'client' },
    phase: 'ready',
  })
  return <DataTable table={table} />
}

function Meter(): ReactElement {
  const table = useDataTable<Band>({
    id: 'plan-meter',
    label: 'Hit rate by band',
    columns: [
      b.entity('band', { header: 'Name', priority: 1, width: 'content' }),
      b.meter('rate', { header: 'Today', max: 100, priority: 1, card: 'value' }),
      b.delta('change', { header: 'Month', polarity: 'neutral', unit: ' pts', priority: 2 }),
      b.number('days', { header: 'Days', priority: 3 }),
    ],
    data: BANDS,
    getRowId: (r) => r.band,
    mode: { kind: 'client' },
    phase: 'ready',
    phone: 'columns',
  })
  return (
    <DataPanel
      title="Returns"
      phase="ready"
      bodySize={{ rows: BANDS.length + 2 }}
      body={() => <DataTable table={table} height="fill" />}
    />
  )
}

type Cycle = Record<
  'id' | 'name' | 'peak' | 'low' | 'high' | 'index' | 'fall' | 'days' | 'gain',
  string
>
const CYCLES: readonly Cycle[] = [
  {
    id: 'c1',
    name: 'Cycle 2012',
    peak: 'Nov 2013',
    low: '12.4',
    high: '1,150',
    index: '93',
    fall: '86 %',
    days: '366',
    gain: '9,100 %',
  },
  {
    id: 'c2',
    name: 'Cycle 2016',
    peak: 'Dec 2017',
    low: '430',
    high: '19,700',
    index: '88',
    fall: '84 %',
    days: '530',
    gain: '4,500 %',
  },
]
const n = col<Cycle>()

function Nine(): ReactElement {
  const wide = (key: keyof Cycle, header: string) =>
    n.custom(key, {
      header,
      priority: 2,
      card: 'meta',
      width: 40,
      sortValue: (r) => r[key],
      render: (r) => r[key],
    })
  const table = useDataTable<Cycle>({
    id: 'plan-nine',
    label: 'Cycle summary',
    columns: [
      n.entity('name', { header: 'Cycle', priority: 1 }),
      n.text('index', { header: 'Index high', priority: 1 }),
      n.text('fall', { header: 'Fall from peak', priority: 1 }),
      wide('peak', 'Peak date'),
      wide('low', 'Low'),
      wide('high', 'High'),
      wide('days', 'Days up'),
      wide('gain', 'Gain'),
      n.text('id', { header: 'Id', priority: 2 }),
    ],
    data: CYCLES,
    getRowId: (r) => String(r.id),
    mode: { kind: 'client' },
    phase: 'ready',
  })
  return <DataTable table={table} />
}

function Returns(): ReactElement {
  const table = useDataTable<Band>({
    id: 'plan-returns',
    label: 'Hit rate per band',
    columns: [
      b.entity('band', { header: 'Band', mono: true, priority: 1, width: 'content' }),
      b.number('days', { header: 'Days', priority: 2 }),
      b.meter('rate', { header: 'Higher, %', max: 100, priority: 1, card: 'value' }),
    ],
    data: BANDS.map((r, i) => ({
      ...r,
      band: ['Below −20 %', '−20 to −10 %', '−10 to 0 %', 'Above 0 %'][i]!,
    })),
    getRowId: (r) => r.band,
    mode: { kind: 'client' },
    phase: 'ready',
    phone: 'columns',
    bodyRows: 4,
  })
  return (
    <DataPanel
      title="Hit rate per band"
      phase="ready"
      bodySize={{ rows: BANDS.length + 2 }}
      body={() => <DataTable table={table} height="fill" />}
    />
  )
}

const VIEWS = { plain: Plain, meter: Meter, returns: Returns, nine: Nine } as const
const view = new URLSearchParams(location.search).get('view') ?? 'plain'
const Table = VIEWS[view as keyof typeof VIEWS] ?? Plain

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(
  <main className="grid content-start gap-4 p-4 text-foreground">
    <div data-testid="plan-table" className="min-w-0">
      <Table />
    </div>
  </main>,
)
