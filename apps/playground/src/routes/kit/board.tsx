import { createFileRoute } from '@tanstack/react-router'
import { useFormat } from 'basalt-ui'
import { applyMove, Board, KanbanCard } from 'basalt-ui/cards'
import type { BoardProps } from 'basalt-ui/cards'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { drag, SortableList } from 'basalt-ui/ui/sortable-list'
import { VirtualList } from 'basalt-ui/ui/virtual-list'
import { useState } from 'react'
import type { ReactElement } from 'react'

type Stage = 'lead' | 'qualified' | 'proposal' | 'won' | 'lost'
type Deal = { id: string; title: string; age: string; meta: readonly [string]; value: number }

const NAMES = [
  'Northwind',
  'Contoso',
  'Fabrikam',
  'Tailspin',
  'Wingtip',
  'Litware',
  'Adatum',
  'Proseware',
]
const deal = (stage: Stage, i: number): Deal => ({
  id: `${stage}-${i + 1}`,
  title: `${NAMES[(i * 3 + stage.length) % NAMES.length]} ${['renewal', 'expansion', 'pilot', 'new seats'][i % 4]}`,
  age: `${(i % 9) + 1} d`,
  meta: [`DL-${1000 + stage.length * 97 + i}`],
  value: 4_800 + ((i * 7919) % 41_000),
})
const seed = (stage: Stage, n: number): Deal[] =>
  Array.from({ length: n }, (_, i) => deal(stage, i))

const columnsOf = (
  deals: Record<Stage, Deal[]>,
  usd: (n: number) => string,
): BoardProps<Stage, Deal>['columns'] => {
  const total = (s: Stage): string => usd(deals[s].reduce((sum, d) => sum + d.value, 0))
  return [
    { id: 'lead', label: 'Lead', tone: 'neutral', total: total('lead') },
    { id: 'qualified', label: 'Qualified', tone: 'info', total: total('qualified') },
    { id: 'proposal', label: 'Proposal', tone: 'warn', total: total('proposal') },
    { id: 'won', label: 'Won', tone: 'good', total: total('won') },
    { id: 'lost', label: 'Lost', tone: 'bad', total: total('lost') },
  ]
}

const LINKS = ['Home', 'Issues', 'Runs', 'Deploys', 'Settings'].map((label) => ({
  id: label.toLowerCase(),
  label,
}))

/** `Board` on the shipped engine over a pipeline (one long column, one empty), and a `SortableList`. */
function BoardRoute(): ReactElement {
  const [deals, setDeals] = useState<Record<Stage, Deal[]>>(() => ({
    lead: seed('lead', 120),
    qualified: seed('qualified', 6),
    proposal: seed('proposal', 4),
    won: seed('won', 3),
    lost: [],
  }))
  const [links, setLinks] = useState(LINKS)
  const f = useFormat()
  const usd = (n: number): string => f.money(n, 'USD', { maximumFractionDigits: 0 })
  return (
    <Page area="kit-board">
      <PageBar title="Pipeline" />
      <Section title="Deals by stage" summary="Drag a card to change its stage">
        <Board
          label="Deals by stage"
          columns={columnsOf(deals, usd)}
          items={deals}
          active="qualified"
          drag={drag}
          virtual={{ list: VirtualList, cardHeight: 92 }}
          onMove={(m) => setDeals((prev) => applyMove(prev, m))}
          card={(d, move) => (
            <KanbanCard id={d.id} title={d.title} age={d.age} meta={d.meta} move={move} />
          )}
        />
      </Section>
      <Section title="Sidebar order" summary="Drag a handle, or use the arrow keys">
        <SortableList
          label="Sidebar order"
          items={links}
          itemLabel={(l) => l.label}
          onMove={({ from, to }) =>
            setLinks((prev) => prev.toSpliced(from, 1).toSpliced(to, 0, prev[from]!))
          }
          className="max-w-96"
        >
          {(l) => <span className="text-sm text-foreground">{l.label}</span>}
        </SortableList>
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/kit/board')({
  staticData: { title: 'Board' },
  component: BoardRoute,
})
