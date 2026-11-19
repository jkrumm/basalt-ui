/**
 * The table kit fixes of expression cycle 11 (table group): a half-width table keeps its columns
 * while its priority 1 and 2 columns fit, and a meter value sits on the row's text line. No shell.
 * Probes: `expr11-half`, `expr11-meter`, `expr11-n50` and `expr11-n46` (a full-width title column beside figures), `expr11-frame-<ready|empty|error>` (a table in a `DataPanel`). The geometry lives in `table-expr11.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../src/cards/data-panel'
import { col } from '../../src/table/core/kinds'
import { DataTable } from '../../src/table/parts/data-table'
import { useDataTable } from '../../src/table/use-data-table'

type Row = {
  id: string
  name: string
  shipped: number
  open: number
  cost: number
  lane: string
  load: number
}

const NAMES = [
  'pearl-board-sync',
  'basalt-ui-tokens',
  'argo-deploy-hook',
  'rollhook-proxy',
  'linewatch-feed',
]

const ROWS: Row[] = NAMES.map((name, i) => ({
  id: `r${i}`,
  name,
  shipped: 40 + i * 7,
  open: i * 3,
  cost: 12.5 * (i + 1),
  lane: ['factory', 'manual', 'lead'][i % 3]!,
  load: 20 + i * 17,
}))

const c = col<Row>()

function Half(): ReactElement {
  const t = useDataTable<Row>({
    id: 'expr11-half',
    label: 'Projects',
    columns: [
      c.entity('name', { header: 'Project', priority: 1 }),
      c.number('shipped', { header: 'Shipped', priority: 1 }),
      c.text('lane', { header: 'Lane', priority: 2 }),
      c.number('open', { header: 'Open', priority: 2 }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={t} />
}

function Meters(): ReactElement {
  const t = useDataTable<Row>({
    id: 'expr11-meter',
    label: 'Load',
    columns: [
      c.entity('name', { header: 'Project', priority: 1 }),
      c.meter('load', { header: 'Load', max: 100, priority: 1 }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={t} />
}

const PROJECTS = [
  'pearl-board-sync',
  'basalt-ui-tokens',
  'argo-deploy-hook',
  'rollhook-proxy',
  'linewatch-feed',
]

/** The n50 shape: a mono title column beside figures, a status and a money column. */
function Projects(): ReactElement {
  const t = useDataTable<Row>({
    id: 'expr11-n50',
    label: 'Projects',
    columns: [
      c.entity('name', { header: 'Project', mono: true, priority: 1 }),
      c.number('shipped', { header: 'Shipped', priority: 1 }),
      c.status('lane', { header: 'State', options: ['factory', 'manual', 'lead'], priority: 2 }),
      c.number('open', { header: 'Open', priority: 2 }),
      c.money('cost', { header: 'Cost per Issue', currency: 'USD', priority: 2 }),
    ],
    data: ROWS.map((row, i) => ({ ...row, name: PROJECTS[i] ?? row.name })),
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={t} />
}

/** The n46 shape: a short mono day label beside two figures and a verdict. */
function Days(): ReactElement {
  const t = useDataTable<Row>({
    id: 'expr11-n46',
    label: 'Days',
    columns: [
      c.entity('name', { header: 'Day', mono: true, priority: 1 }),
      c.number('shipped', { header: 'Download', unit: 'Mbit/s', priority: 2 }),
      c.number('open', { header: 'Upload', unit: 'Mbit/s', priority: 2 }),
      c.status('lane', { header: 'Verdict', options: ['factory', 'manual', 'lead'], priority: 2 }),
    ],
    data: ROWS.map((row, i) => ({ ...row, name: `2026-11-${10 + i}` })),
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={t} />
}

function FramedTable({ ready }: { ready: boolean }): ReactElement {
  const t = useDataTable<Row>({
    id: 'expr11-framed',
    label: 'Projects',
    columns: [
      c.entity('name', { header: 'Project', priority: 1 }),
      c.number('shipped', { header: 'Shipped', priority: 1 }),
      c.number('open', { header: 'Open', priority: 2 }),
    ],
    data: ready ? ROWS : [],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={t} height="fill" />
}

const retry = (): void => undefined

function Framed({ state }: { state: 'ready' | 'empty' | 'error' }): ReactElement {
  return (
    <div data-testid={`expr11-frame-${state}`} className="min-w-0" style={{ width: 900 }}>
      <DataPanel
        title="Projects"
        phase={state === 'error' ? { tag: 'error', retry } : 'ready'}
        empty={state === 'empty' ? { cause: 'No project shipped yet' } : null}
        bodySize={{ rows: 4 }}
        body={() => <FramedTable ready={state === 'ready'} />}
      />
    </div>
  )
}

function Fixture(): ReactElement {
  return (
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      <div data-testid="expr11-half" className="min-w-0" style={{ width: 750 }}>
        <Half />
      </div>
      <div data-testid="expr11-meter" className="min-w-0" style={{ width: 1000 }}>
        <Meters />
      </div>
      <div data-testid="expr11-n50" className="min-w-0">
        <Projects />
      </div>
      <div data-testid="expr11-n46" className="min-w-0">
        <Days />
      </div>
      <Framed state="ready" />
      <Framed state="empty" />
      <Framed state="error" />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
