/**
 * The `table-kinds` fixture (docs/v3/issues/bench/bench-table-kinds.json): a notes table that uses
 * `title`, `person`, `people`, `tags`, `countdown`, `link`, an entity with a logo and a quiet
 * text, no `custom`. Probe: `tk-main`. `window.basaltSetNow(ms)` moves the table's clock.
 */
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { col } from '../../src/table/core/kinds'
import { DataTable } from '../../src/table/parts/data-table'
import { useDataTable } from '../../src/table/use-data-table'
import type { IconComponent } from '../../src/core/ports'

type Note = {
  id: string
  title: string
  kind: 'note' | 'call'
  preview: string
  owner: string
  role: string
  team: string[]
  tags: string[]
  due: string
  site: string
  company: string
  ref: string
}

const NOW = Date.UTC(2026, 10, 16, 12, 0, 0)

const ROWS: Note[] = [
  {
    id: 'n1',
    title: 'Renewal call',
    kind: 'call',
    preview: 'Walked through the renewal terms and the open questions on seats',
    owner: 'Ada Lovelace',
    role: 'Founder',
    team: ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Linus Torvalds', 'Edsger Dijkstra'],
    tags: ['renewal', 'enterprise', 'priority-account', 'north-america', 'q4-planning', 'legal'],
    due: '2026-10-21',
    site: 'https://acme.example/renewal',
    company: 'Acme Logistics',
    ref: 'ACM-1',
  },
  {
    id: 'n2',
    title: 'Pricing review',
    kind: 'note',
    preview: 'Compare the new tiers against the three nearest competitors',
    owner: 'Alan Turing',
    role: 'Engineer',
    team: ['Alan Turing'],
    tags: ['pricing'],
    due: '2026-11-20',
    site: 'ada@example.com',
    company: 'Globex GmbH',
    ref: 'GLB-7',
  },
  {
    id: 'n3',
    title: 'Security questionnaire',
    kind: 'note',
    preview: 'Answers drafted, waiting on the infrastructure owner',
    owner: 'Grace Hopper',
    role: 'Admiral',
    team: ['Grace Hopper', 'Ada Lovelace'],
    tags: ['security', 'legal'],
    due: '2026-11-16',
    site: 'https://initech.example',
    company: 'Initech',
    ref: 'INI-3',
  },
]

const Note: IconComponent = ({ className }) => (
  <svg data-glyph="note" viewBox="0 0 16 16" className={className} width="16" height="16" />
)
const Call: IconComponent = ({ className }) => (
  <svg data-glyph="call" viewBox="0 0 16 16" className={className} width="16" height="16" />
)

const c = col<Note>()

function Fixture(): ReactElement {
  const [now, setNow] = useState(NOW)
  useEffect(() => {
    ;(window as unknown as { basaltSetNow: (ms: number) => void }).basaltSetNow = setNow
  }, [])
  const t = useDataTable<Note>({
    id: 'tk-main',
    label: 'Notes',
    columns: [
      c.title('title', {
        header: 'Title',
        type: (row) => row.kind,
        icons: { note: Note, call: Call },
      }),
      c.text('preview', { header: 'Preview', quiet: true, priority: 3 }),
      c.person('owner', { header: 'Owner', role: (row) => row.role, filter: 'multi', priority: 2 }),
      c.people('team', { header: 'Known by', priority: 3 }),
      c.tags('tags', { header: 'Tags', filter: 'multi', priority: 3 }),
      c.countdown('due', { header: 'Due', warn: 7, priority: 2 }),
      c.link('site', { header: 'Site', priority: 3 }),
      c.entity('company', {
        header: 'Company',
        image: () => undefined,
        ref: (row) => row.ref,
        priority: 3,
      }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    now,
  })
  return (
    // theme-allow -- the wrapper is the probe's payload
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      <div data-testid="tk-main" className="min-w-0">
        <DataTable table={t} />
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
