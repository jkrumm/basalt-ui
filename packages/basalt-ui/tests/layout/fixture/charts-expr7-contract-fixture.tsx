/**
 * The `charts-expr7-contract` fixture (v3-expr-7-contract (b) and (c)): an entity column's main text
 * and a footer fact value, each twice, once with the mono flag (`*-mono`) and once without
 * (`*-sans`); and a stacked `BarList` of twelve long workflow names. No shell. Entry of
 * `charts-expr7-contract.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import { BarList } from '../../../src/cards/bar-list'
import { StatCard } from '../../../src/cards/stat-card'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

const WHEN = '21 Oct 03:12'

function Figure(props: { id: string; mono: boolean }) {
  return (
    <div data-testid={props.id} className="min-w-0">
      <ChartCard
        title="Pace"
        figure={{ value: 18, unit: 'books' }}
        footer={[
          { label: 'Last finished', value: WHEN, mono: props.mono },
          { label: 'Goal', value: 24 },
        ]}
        chart={() => <div />}
      />
    </div>
  )
}

function Card(props: { id: string; mono: boolean }) {
  return (
    <div data-testid={props.id} className="min-w-0">
      <StatCard
        title="Books"
        value={18}
        footer={[
          { label: 'Last finished', value: WHEN, mono: props.mono },
          { label: 'Goal', value: 24 },
        ]}
      />
    </div>
  )
}

type Workflow = { id: string; name: string; spend: number }
const WORKFLOWS: Workflow[] = [
  'nightly-regression-evals',
  'support-triage-classifier',
  'code-review-assist-batch',
].map((name, i) => ({ id: `w${i}`, name, spend: 1200 - i * 300 }))
const c = col<Workflow>()

function Table(props: { id: string; mono: boolean }) {
  const t = useDataTable<Workflow>({
    id: props.id,
    label: props.id,
    columns: [
      c.entity('name', { header: 'Workflow', mono: props.mono }),
      c.number('spend', { header: 'Spend' }),
    ],
    data: WORKFLOWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return (
    <div data-testid={props.id} className="min-w-0">
      <DataTable table={t} />
    </div>
  )
}

const PURPOSES = [
  { key: 'production', label: 'Production', color: { light: '#0077bd', dark: '#5fb4f0' } },
  { key: 'evals', label: 'Evals', color: { light: '#7c5cc4', dark: '#a98ef0' } },
  { key: 'dev', label: 'Development', color: { light: '#2f8a5b', dark: '#6cc495' } },
  { key: 'other', label: 'Other', color: { light: '#a86a1f', dark: '#e0a65c' } },
] as const

/** Twelve long names, ranked, the last one with no spend at all. */
const NAMES = [
  'support-triage-classifier',
  'doc-summarise-long-context',
  'code-review-assist-batch',
  'nightly-regression-evals',
  'search-rerank-experiment',
  'onboarding-chat-assistant',
  'invoice-extraction-pipeline',
  'release-notes-drafting',
  'incident-postmortem-writer',
  'catalog-embedding-backfill',
  'translation-quality-sampler',
  'legacy-ticket-deduplication',
]
const STACKED = NAMES.map((label, i) => {
  const total = i === NAMES.length - 1 ? 0 : 4200 - i * 340
  return {
    label,
    value: total,
    parts: {
      production: total * 0.55,
      evals: total * 0.25,
      dev: total * 0.15,
      other: total * 0.05,
    },
  }
})

function Stacked() {
  return (
    <div data-testid="stacked" className="min-w-0">
      <BarList
        title="Spend by workflow"
        items={STACKED}
        series={PURPOSES}
        bodyRows={10}
        format={(n) => `$${Math.round(n)}`}
      />
    </div>
  )
}

function Fixture() {
  return (
    <main className="flex max-w-3xl min-w-0 flex-col gap-6 p-4 text-foreground">
      <h1 className="text-lg font-medium">Expression 7 contract</h1>
      <Figure id="figure-mono" mono />
      <Figure id="figure-sans" mono={false} />
      <Card id="card-mono" mono />
      <Card id="card-sans" mono={false} />
      <Table id="table-mono" mono />
      <Table id="table-sans" mono={false} />
      <Stacked />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
