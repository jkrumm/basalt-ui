/**
 * Expression cycle 12 kit fixes, the DataPanel group: a half-width table keeps every column that
 * fits (`x12-half`, `x12-over`), a rows body shows every phone card with a loading frame as tall as
 * the loaded one (`x12-bills-ready|loading|error|empty`). Entry of `kit-expr12-panel.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { useChartFocus } from '../../../src/charts/focus'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { VirtualList } from '../../../src/ui/virtual-list'
import { useDataTable } from '../../../src/table/use-data-table'

type Row = {
  id: string
  name: string
  due: string
  amount: number
  kind: string
  note: string
  a: string
  b: string
}

const ROWS: readonly Row[] = ['Rent', 'Childcare', 'Insurance', 'Phone'].map((name, i) => ({
  id: `b${i}`,
  name,
  due: `Nov ${3 + i * 6}`,
  amount: 480 - i * 90,
  kind: ['Fixed', 'Monthly', 'Yearly', 'Monthly'][i]!,
  note: `A note about ${name.toLowerCase()}`,
  a: `a${i}`,
  b: `b${i}`,
}))
const c = col<Row>()

type State = 'ready' | 'loading' | 'empty' | 'error'
const retry = (): void => undefined

function HalfTable({ wide }: { wide: boolean }): ReactElement {
  const table = useDataTable<Row>({
    id: wide ? 'x12-over' : 'x12-half',
    label: 'Bills',
    columns: [
      c.entity('name', { header: 'Bill', priority: 1 }),
      c.number('amount', { header: 'Amount', priority: 1 }),
      c.text('due', { header: 'Due', priority: 2 }),
      c.text('kind', { header: 'Kind', priority: 3 }),
      c.text('note', { header: wide ? 'A long note column' : 'Note', priority: 3 }),
      ...(wide
        ? [
            c.text('a', { header: 'Alpha', priority: 3 }),
            c.text('b', { header: 'Beta', priority: 3 }),
          ]
        : []),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={table} />
}

function BillsTable({ state }: { state: State }): ReactElement {
  const table = useDataTable<Row>({
    id: `x12-bills-${state}`,
    label: 'Bills',
    columns: [
      c.entity('name', { header: 'Bill', priority: 1, sub: (r) => r.due }),
      c.money('amount', { header: 'Amount', currency: 'EUR', priority: 1 }),
      c.text('kind', { header: 'Kind', priority: 2 }),
    ],
    data: state === 'ready' || state === 'error' ? ROWS : [],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase: state === 'loading' ? 'loading' : state === 'error' ? { tag: 'error', retry } : 'ready',
    empty: state === 'empty' ? { cause: 'No bills due' } : null,
  })
  return <DataTable table={table} height="fill" />
}

function Bills({ state }: { state: State }): ReactElement {
  return (
    <div data-testid={`x12-bills-${state}`} className="min-w-0">
      <DataPanel
        title="Bills"
        phase={
          state === 'loading' ? 'loading' : state === 'error' ? { tag: 'error', retry } : 'ready'
        }
        empty={state === 'empty' ? { cause: 'No bills due' } : null}
        bodySize={{ rows: 5 }}
        body={() => <BillsTable state={state} />}
      />
    </div>
  )
}

function Switch(): ReactElement {
  const [state, setState] = useState<State>('ready')
  useEffect(() => {
    ;(window as unknown as { x12Set: (s: State) => void }).x12Set = setState
  }, [])
  return (
    <div data-testid="x12-switch" className="min-w-0">
      <DataPanel
        title="Bills"
        phase={
          state === 'loading' ? 'loading' : state === 'error' ? { tag: 'error', retry } : 'ready'
        }
        empty={state === 'empty' ? { cause: 'No bills due' } : null}
        bodySize={{ rows: 5 }}
        body={() => <BillsTable state={state} />}
      />
    </div>
  )
}

type Hour = { id: string; name: string }
const HOURS: readonly Hour[] = Array.from({ length: 14 }, (_, i) => ({
  id: `h${i}`,
  name: `Hour ${i}`,
}))
const ch = col<Hour>()

function Reveal(): ReactElement {
  const focus = useChartFocus(HOURS, { announce: (d) => d.name })
  const table = useDataTable<Hour>({
    id: 'x12-reveal',
    label: 'Hours',
    columns: [ch.entity('name', { header: 'Hour', priority: 1 })],
    data: HOURS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return (
    <div data-testid="x12-reveal" className="min-w-0">
      <button type="button" data-testid="x12-reveal-set" onClick={() => focus.set(12)}>
        Focus hour 12
      </button>
      <DataPanel
        title="Hours"
        phase="ready"
        bodySize={{ height: 160 }}
        body={() => <DataTable table={table} focus={focus} height="fill" />}
      />
    </div>
  )
}

function VirtualTable({ state }: { state: State }): ReactElement {
  const table = useDataTable<Row>({
    id: `x12-virtual-${state}`,
    label: 'Sessions',
    columns: [
      c.entity('name', { header: 'Day', priority: 1 }),
      c.number('amount', { header: 'Minutes', priority: 1 }),
      c.text('due', { header: 'Distance', priority: 1 }),
    ],
    data: state === 'ready' ? ROWS : [],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={table} height="fill" virtual={VirtualList} />
}

function Virtual({ state }: { state: State }): ReactElement {
  return (
    <div data-testid={`x12-virtual-${state}`} className="min-w-0" style={{ width: 496 }}>
      <DataPanel
        title="Sessions"
        phase={state === 'error' ? { tag: 'error', retry } : 'ready'}
        empty={state === 'empty' ? { cause: 'No sessions to list yet' } : null}
        bodySize={{ rows: 5 }}
        body={() => <VirtualTable state={state} />}
      />
    </div>
  )
}

function Fixture(): ReactElement {
  return (
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      <div data-testid="x12-half" className="min-w-0" style={{ width: 750 }}>
        <DataPanel
          title="Bills"
          phase="ready"
          bodySize={{ rows: 5 }}
          body={() => <HalfTable wide={false} />}
        />
      </div>
      <div data-testid="x12-over" className="min-w-0" style={{ width: 750 }}>
        <DataPanel
          title="Bills"
          phase="ready"
          bodySize={{ rows: 5 }}
          body={() => <HalfTable wide />}
        />
      </div>
      <Switch />
      <Virtual state="ready" />
      <Virtual state="empty" />
      <Virtual state="error" />
      <Reveal />
      <Bills state="ready" />
      <Bills state="loading" />
      <Bills state="empty" />
      <Bills state="error" />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
