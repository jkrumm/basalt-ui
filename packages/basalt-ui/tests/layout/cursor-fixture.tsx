/**
 * The `cursor` fixture (the cursor law, `src/css/cursor.css`): one of each thing that acts on a click,
 * as a Tailwind consumer renders it. No shell. Probes, each a `data-testid`:
 * - `button` and `button-disabled`: the Button primitive, enabled and disabled;
 * - `menu`: an open Menu, its items;
 * - `tabs`: a Tabs list; `select`: a Select trigger; `input`: a text input;
 * - `table`: a DataTable whose rows open on click;
 * - `stat`: a StatCard that takes a click;
 * - `board`: a Board on the shipped drag engine, so each card is a draggable item;
 * - `sortable`: a SortableList with its drag handles.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { Board } from '../../src/cards/board'
import { KanbanCard } from '../../src/cards/kanban-card'
import { StatCard } from '../../src/cards/stat-card'
import { col } from '../../src/table/core/kinds'
import { DataTable } from '../../src/table/parts/data-table'
import { useDataTable } from '../../src/table/use-data-table'
import { Button } from '../../src/ui/button'
import { Input } from '../../src/ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../src/ui/menu'
import { Select } from '../../src/ui/select'
import { SortableList, drag } from '../../src/ui/sortable-list'
import { Tabs, TabsList, TabsTrigger } from '../../src/ui/tabs'

type Row = { id: string; name: string }

const ROWS: Row[] = [
  { id: 'a', name: 'Acme' },
  { id: 'b', name: 'Bolt' },
]
const c = col<Row>()
const STAGES = [
  { value: 'new', label: 'New' },
  { value: 'won', label: 'Won' },
]
const COLUMNS = [
  { id: 'todo', label: 'To do' },
  { id: 'done', label: 'Done' },
] as const
const CARDS = {
  todo: [{ id: 't1', title: 'Fix the cache key', age: '1 h' }],
  done: [{ id: 'd1', title: 'Ship the export', age: '2 h' }],
}
const NO_ROWS: readonly { id: string; label: string }[] = [
  { id: 's1', label: 'First' },
  { id: 's2', label: 'Second' },
]

function Table(): ReactElement {
  const t = useDataTable<Row>({
    id: 'cursor-rows',
    label: 'Deals',
    columns: [c.entity('name', { header: 'Deal' })],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    onRowActivate: () => undefined,
  })
  return <DataTable table={t} />
}

function Fixture(): ReactElement {
  return (
    // theme-allow -- the wrapper is the probe's payload
    <main lang="en" className="flex w-96 flex-col gap-4 p-4 text-foreground">
      <div data-testid="button" className="flex gap-2">
        <Button>Save</Button>
      </div>
      <div data-testid="button-disabled" className="flex gap-2">
        <Button disabled>Save</Button>
      </div>
      <div data-testid="menu">
        <Menu defaultOpen>
          <MenuTrigger render={<Button />}>Actions</MenuTrigger>
          <MenuContent>
            <MenuItem>Rename</MenuItem>
            <MenuItem>Delete</MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <div data-testid="tabs">
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div data-testid="select">
        <Select aria-label="Stage" options={STAGES} placeholder="Stage" />
      </div>
      <div data-testid="input">
        <Input aria-label="Name" placeholder="Name" />
      </div>
      <div data-testid="table">
        <Table />
      </div>
      <div data-testid="stat">
        <StatCard
          title="Commitment"
          value={1234}
          sub="vs last month"

          onClick={() => undefined}
        />
      </div>
      <div data-testid="board">
        <Board
          label="Issues"
          columns={COLUMNS}
          items={CARDS}
          drag={drag}
          onMove={() => undefined}
          card={(item, move) => <KanbanCard {...item} move={move} />}
        />
      </div>
      <div data-testid="sortable">
        <SortableList
          label="Order"
          items={NO_ROWS}
          itemLabel={(item) => item.label}
          onMove={() => undefined}
        >
          {(item) => <span>{item.label}</span>}
        </SortableList>
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
