/**
 * The `loading-frames` fixture: each frame in its loading phase and in its ready phase, stacked so
 * each is measured at the same width. Entry of `loading-frames.layout.test.ts`, which bundles it in memory.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { BarList } from '../../../src/cards/bar-list'
import type { BarListItem } from '../../../src/cards/bar-list'
import { DataPanel } from '../../../src/cards/data-panel'
import { PageSummary } from '../../../src/page/page-summary'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Row = { id: string; name: string; a: string; b: string }
const ROWS: readonly Row[] = Array.from({ length: 30 }, (_, i) => ({
  id: `r${i}`,
  name: `Row ${i}`,
  a: `a${i}`,
  b: `b${i}`,
}))
const c = col<Row>()

const ITEMS: readonly BarListItem[] = Array.from({ length: 12 }, (_, i) => ({
  key: `m${i}`,
  label: `Month ${i + 1}`,
  value: 100 - i * 6,
}))

const SHORT = '5,000 photos, 1,200 still in staging'
const SENTENCE = 'Download fell below the minimum on 3 days, upload on 2 days'

function PanelTable({ data }: { data: readonly Row[] }): ReactElement {
  const table = useDataTable<Row>({
    id: 'loading-frames',
    label: 'Rows',
    columns: [c.entity('name'), c.text('a'), c.text('b')],
    data,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={table} />
}

function Frame({ name, phase }: { name: string; phase: 'loading' | 'ready' }): ReactElement {
  return (
    <section data-testid={`${phase}-${name}`}>
      {name === 'panel' && (
        <DataPanel
          title="Rows"
          phase={phase}
          bodySize={{ rows: 6 }}
          body={() => <PanelTable data={ROWS} />}
        />
      )}
      {name === 'list' && <BarList title="Months" items={ITEMS} phase={phase} bodyRows={5} />}
      {name === 'summary' &&
        (phase === 'loading' ? (
          <PageSummary phase="loading" sentence={SENTENCE} facts={[]} />
        ) : (
          <PageSummary sentence={SENTENCE} facts={['3 days without tests are left out']} />
        ))}
      {name === 'short' &&
        (phase === 'loading' ? (
          <PageSummary phase="loading" facts={[]} />
        ) : (
          <PageSummary sentence={SHORT} facts={['Last reindex 21 Nov 2026, 6:10']} />
        ))}
      {name === 'failed' &&
        (phase === 'loading' ? (
          <PageSummary
            phase={{ tag: 'error', message: 'The library index is unreachable', retry: () => {} }}
            facts={[]}
          />
        ) : (
          <PageSummary sentence={SHORT} facts={['Last reindex 21 Nov 2026, 6:10']} />
        ))}
    </section>
  )
}

const FRAMES = ['panel', 'list', 'summary', 'short', 'failed'] as const

function Fixture(): ReactElement {
  return (
    <main data-testid="lf-root" className="p-4">
      {FRAMES.map((name) => (
        <div key={name} className="mb-6 flex flex-col gap-4">
          <Frame name={name} phase="loading" />
          <Frame name={name} phase="ready" />
        </div>
      ))}
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
