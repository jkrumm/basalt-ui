/**
 * Expression cycle 16 cards kit fixes, a delta pill in a table cell (`v3-expr-16-kit-fixes` 9, n74
 * `?fixture=runaway`): a DataPanel half the page wide whose Change column holds a money delta as wide as
 * '+US$9,362.00'. `data-testid="k16-delta-table"` is the panel. Entry of
 * `kit-expr16-cards-delta.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Wallet = { id: string; kind: string; verdict: string; change: number; tokens: number }
const WALLETS: readonly Wallet[] = [
  { id: 'ci-bot', kind: 'API key', verdict: 'Grew most', change: 9362, tokens: 1566.7 },
  { id: 'evals', kind: 'API key', verdict: 'New', change: 187, tokens: 37.4 },
  { id: 'max', kind: 'Subscription', verdict: 'Flat', change: 26, tokens: 40.4 },
  { id: 'prod', kind: 'API key', verdict: 'Flat', change: -24, tokens: 32.7 },
]
const c = col<Wallet>()

function Table(): ReactElement {
  const table = useDataTable<Wallet>({
    id: 'k16-wallets',
    label: 'Verdicts',
    columns: [
      c.entity('id', { header: 'Wallet', mono: true, sub: (r) => r.kind, priority: 1 }),
      c.status('verdict', {
        header: 'Verdict',
        options: ['Grew most', 'New', 'Flat'],
        tone: (v) => (v === 'Flat' ? 'neutral' : 'accent'),
        priority: 1,
      }),
      c.delta('change', { header: 'Change', currency: 'USD', polarity: 'neutral', priority: 2 }),
      c.meter('tokens', { header: 'Tokens, millions', max: 1600, priority: 2 }),
    ],
    data: WALLETS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    bodyRows: 4,
  })
  return <DataTable table={table} />
}

function Fixture(): ReactElement {
  return (
    <main className="@container grid gap-3 p-4 text-foreground @wide:grid-cols-2">
      <div className="h-40 rounded-card bg-card" />
      <div data-testid="k16-delta-table" className="min-w-0">
        <DataPanel title="Wallets" phase="ready" bodySize={{ rows: 5 }} body={() => <Table />} />
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
