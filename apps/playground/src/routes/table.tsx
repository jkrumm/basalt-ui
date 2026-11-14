import { createFileRoute } from '@tanstack/react-router'
import { filterSlot, spec } from 'basalt-ui/controls'
import { Section } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import type { DetailEntry, DetailHost } from 'basalt-ui/core/ports'
import { Progress } from 'basalt-ui/ui/progress'
import { Sheet, SheetContent } from 'basalt-ui/ui/sheet'
import { VirtualList } from 'basalt-ui/ui/virtual-list'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { tableCodec } from '../../../../packages/basalt-ui/dist/table/core/codec'
import { TableToolbar } from '../../../../packages/basalt-ui/dist/table/parts/toolbar'
import { useV3Tokens } from '../demo/v3-tokens'

// The v3 table parts the route needs beyond `DataTable` (`TableToolbar`, `tableCodec`) are not on
// the public `basalt-ui/table` barrel yet, so this route reaches the built modules by path until
// the barrel carries them. Dist, not src: the playground typechecks without the package's node types.

// ---- Section 1: finances shape, server mode ------------------------------------------------

type Booking = {
  id: string
  payee: string
  category: string
  state: string
  amount: number
  at: string
}

const PAYEES = [
  'Northwind Traders',
  'Acme Logistics',
  'Globex GmbH',
  'Initech',
  'Umbrella Retail',
  'Hooli Systems',
  'Stark Components',
  'Wayne Freight',
  'Counterparty Holdings International Limited',
] as const
const CATEGORIES = ['Housing', 'Food', 'Travel', 'Software', 'Tax'] as const
const STATES = ['Awaiting', 'Settled', 'Disputed'] as const
const MONTHS = ['all', '2026-09', '2026-10', '2026-11'] as const

const day = (n: number): string => new Date(Date.UTC(2026, 10, 14 - (n % 75))).toISOString()

/** 240 bookings, newest first by index; deterministic so a shot is the same shot. */
const BOOKINGS: readonly Booking[] = Array.from({ length: 240 }, (_, i) => ({
  id: `bk-${String(i).padStart(4, '0')}`,
  payee: PAYEES[(i * 7) % PAYEES.length] ?? PAYEES[0],
  category: CATEGORIES[(i * 3) % CATEGORIES.length] ?? CATEGORIES[0],
  state: STATES[(i * 5) % STATES.length] ?? STATES[0],
  amount: -Math.round((20 + ((i * 137) % 1900)) * 100) / 100,
  at: day(i),
}))

const book = col<Booking>()

/** Ids and kinds only: it sits at module scope while the columns close over render values. */
const bookingsSchema = book.codec(
  { payee: 'entity', amount: 'money', state: 'status', category: 'text', at: 'date' },
  { defaults: { sort: [{ id: 'at', desc: true }], pageSize: 10 } },
)

const ROOMS = [
  { id: 'r1', room: 'Master bedroom', floor: 'Floor 2', state: 'Done', tasks: 4 },
  { id: 'r2', room: 'Guest bedroom', floor: 'Floor 2', state: 'Open', tasks: 6 },
  { id: 'r3', room: 'Nursery', floor: 'Floor 2', state: 'Done', tasks: 3 },
  { id: 'r4', room: 'Kitchen', floor: 'Floor 1', state: 'Open', tasks: 9 },
  { id: 'r5', room: 'Living room', floor: 'Floor 1', state: 'Done', tasks: 2 },
  { id: 'r6', room: 'Hall', floor: 'Floor 1', state: 'Done', tasks: 1 },
  { id: 'r7', room: 'Boiler room', floor: 'Basement', state: 'Open', tasks: 5 },
  { id: 'r8', room: 'Cellar', floor: 'Basement', state: 'Done', tasks: 2 },
] as const

type Room = (typeof ROOMS)[number]

const rooms = col<Room>()

const roomsSchema = rooms.codec(
  { room: 'entity', state: 'status', tasks: 'number', floor: 'text' },
  { prefix: 'g' },
)

type Entry = {
  id: string
  name: string
  state: string
  category: string
  amount: number
  at: string
}

const ENTRIES: readonly Entry[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: `en-${i}`,
  name: `Booking ${String(i).padStart(5, '0')}`,
  state: STATES[i % STATES.length] ?? STATES[0],
  category: CATEGORIES[(i * 3) % CATEGORIES.length] ?? CATEGORIES[0],
  amount: Math.round((10 + ((i * 91) % 4800)) * 100) / 100,
  at: day(i),
}))

const entry = col<Entry>()

const entriesSchema = entry.codec(
  { name: 'entity', state: 'status', category: 'text', amount: 'money', at: 'date' },
  { prefix: 'l' },
)

// One store, three composite fields: the second and third table set a `prefix`, so no two own a param.
const exemplar = defineControls({
  id: 'table-exemplar',
  scope: 'page',
  resets: ['page'],
  fields: {
    month: field.enum(MONTHS, 'all').labels({
      all: 'All months',
      '2026-09': 'September',
      '2026-10': 'October',
      '2026-11': 'November',
    }),
    table: field.composite(tableCodec(bookingsSchema)),
    large: field.composite(tableCodec(entriesSchema)),
    grouped: field.composite(tableCodec(roomsSchema)),
  },
})

type Value = ReturnType<typeof exemplar.field.table.use>[0]

/** The stand-in for the endpoint: sort, filter and page by the request, the total and the facets of the match. */
function serve(request: Value['request'], month: string) {
  const q = request.q.trim().toLowerCase()
  const states = request.filters.find((f) => f.id === 'state')?.values ?? []
  const payees = request.filters.find((f) => f.id === 'payee')?.values ?? []
  const inMonth = BOOKINGS.filter((b) => month === 'all' || b.at.startsWith(month))
  const searched = inMonth.filter(
    (b) => q === '' || `${b.payee} ${b.category}`.toLowerCase().includes(q),
  )
  const matched = searched
    .filter((b) => payees.every((p) => b.payee.toLowerCase().includes(p.toLowerCase())))
    .filter((b) => states.length === 0 || states.includes(b.state))
  const sort = request.sort[0] ?? { id: 'at', desc: true }
  const sign = sort.desc ? -1 : 1
  const key = (b: Booking): string | number =>
    sort.id === 'amount' ? b.amount : ((b as Record<string, string | number>)[sort.id] ?? '')
  const sorted = matched.toSorted((a, b) => {
    const [x, y] = [key(a), key(b)]
    return (
      sign *
      (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)))
    )
  })
  const start = (request.page - 1) * request.pageSize
  return {
    rows: sorted.slice(start, start + request.pageSize),
    total: matched.length,
    facets: {
      state: STATES.map((value) => ({
        value,
        count: searched.filter((b) => b.state === value).length,
      })),
    },
    sum: Math.round(matched.reduce((total, b) => total + b.amount, 0) * 100) / 100,
  }
}

function BookingDetail({ row }: { row: Booking }): ReactElement {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Payee</dt>
      <dd>{row.payee}</dd>
      <dt className="text-muted-foreground">Category</dt>
      <dd>{row.category}</dd>
      <dt className="text-muted-foreground">State</dt>
      <dd>{row.state}</dd>
      <dt className="text-muted-foreground">Amount</dt>
      <dd data-numeric>{row.amount.toFixed(2)} EUR</dd>
      <dt className="text-muted-foreground">Booked</dt>
      <dd>{row.at.slice(0, 10)}</dd>
    </dl>
  )
}

/** A `DetailHost` over a sheet: `show` opens it on the row's detail, `hide` closes it. */
function useSheetHost(): { host: DetailHost; sheet: ReactElement } {
  const [entry, setEntry] = useState<DetailEntry | null>(null)
  const host: DetailHost = {
    isOpen: entry !== null,
    show: setEntry,
    hide: () => setEntry(null),
  }
  const sheet = (
    <Sheet open={entry !== null} onOpenChange={(open) => !open && setEntry(null)}>
      <SheetContent title={entry?.title ?? ''}>
        {entry?.body({ height: 'fill', phase: 'ready' })}
      </SheetContent>
    </Sheet>
  )
  return { host, sheet }
}

const TONES = { Settled: 'good', Awaiting: 'warn', Disputed: 'bad' } as const

// #region finances-table
function Finances(): ReactElement {
  const [state] = exemplar.field.table.use()
  const [month] = exemplar.field.month.use()
  const [done, setDone] = useState('')
  const { host, sheet } = useSheetHost()
  const page = serve(state.request, month)
  const t = useDataTable({
    id: 'bookings',
    label: 'Bookings',
    columns: [
      book.entity('payee', { header: 'Payee', filter: 'text' }),
      book.text('category', { header: 'Category' }),
      book.status('state', {
        header: 'State',
        options: [...STATES],
        tone: (value) => TONES[value as keyof typeof TONES] ?? 'neutral',
        filter: 'multi',
      }),
      book.money('amount', { currency: 'EUR', header: 'Amount', footer: 'sum' }),
      book.date('at', { header: 'Booked', priority: 3 }),
      book.actions([{ key: 'rule', label: 'Make rule', onClick: () => setDone('Rule created') }]),
    ],
    data: page.rows,
    getRowId: (row) => row.id,
    mode: {
      kind: 'server',
      rowCount: page.total,
      facets: page.facets,
      totals: { amount: page.sum },
    },
    state: exemplar.field.table,
    resetOn: [month],
    selection: {
      bulk: [
        {
          key: 'archive',
          label: 'Archive',
          onClick: (rows) => setDone(`Archived ${rows.length} bookings`),
        },
      ],
      selectAll: true,
    },
    detail: (row) => <BookingDetail row={row} />,
  })
  return (
    <>
      <TableToolbar table={t} />
      <DataTable table={t} detail={host} />
      {sheet}
      <p role="status" className="text-sm text-muted-foreground">
        {done}
      </p>
    </>
  )
}
// #endregion

// ---- Section 2: large, client mode, virtual ------------------------------------------------

function Large(): ReactElement {
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [opened, setOpened] = useState('')
  const rows =
    Object.keys(picked).length === 0
      ? ENTRIES
      : ENTRIES.map((e) => ({ ...e, category: picked[e.id] ?? e.category }))
  const t = useDataTable({
    id: 'entries',
    label: 'Entries',
    columns: [
      entry.entity('name', { header: 'Booking', filter: 'text' }),
      entry.status('state', {
        header: 'State',
        options: [...STATES],
        tone: (value) => TONES[value as keyof typeof TONES] ?? 'neutral',
        filter: 'multi',
      }),
      entry.select('category', {
        label: (row) => `Category of ${row.name}`,
        options: [...CATEGORIES],
        commit: async (row, next) => {
          setPicked((prev) => ({ ...prev, [row.id]: next }))
        },
      }),
      entry.money('amount', { currency: 'EUR', header: 'Amount' }),
      entry.date('at', { header: 'Booked', priority: 3 }),
    ],
    data: rows,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    state: exemplar.field.large,
    onRowActivate: (row) => setOpened(row.name),
  })
  return (
    <>
      <TableToolbar table={t} />
      <div className="h-128">
        <DataTable table={t} height="fill" virtual={VirtualList} />
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {opened === '' ? '' : `Opened ${opened}`}
      </p>
    </>
  )
}

// ---- Section 3: grouped ---------------------------------------------------------------------

function Grouped(): ReactElement {
  const t = useDataTable({
    id: 'rooms',
    label: 'Rooms',
    columns: [
      rooms.entity('room', { header: 'Room' }),
      rooms.status('state', { header: 'State', options: ['Done', 'Open'] }),
      rooms.number('tasks', { header: 'Open tasks', footer: 'sum' }),
      rooms.text('floor', { header: 'Floor', priority: 3 }),
    ],
    data: ROOMS,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    state: exemplar.field.grouped,
    group: {
      by: 'floor',
      summary: (grouped) => {
        const done = grouped.filter((r) => r.state === 'Done').length
        return (
          <Progress
            value={(done / grouped.length) * 100}
            aria-label={`${done} of ${grouped.length} rooms done`}
            className="w-24"
          />
        )
      },
    },
  })
  return <DataTable table={t} />
}

function TableRoute(): ReactElement {
  useV3Tokens()
  return (
    <div className="flex min-w-0 flex-col gap-8 p-4">
      <Section title="Bookings" controls={filterSlot([spec(exemplar.field.month, 'Month')])}>
        <Finances />
      </Section>
      <Section title="Entries">
        <Large />
      </Section>
      <Section title="Rooms">
        <Grouped />
      </Section>
    </div>
  )
}

export const Route = createFileRoute('/table')({
  staticData: { title: 'Table' },
  validateSearch: exemplar.validateSearch,
  search: { middlewares: exemplar.middlewares },
  component: TableRoute,
})
