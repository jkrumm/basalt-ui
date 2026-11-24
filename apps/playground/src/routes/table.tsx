import { createFileRoute } from '@tanstack/react-router'
import { useFormat } from 'basalt-ui'
import { filterSlot, spec } from 'basalt-ui/controls'
import { Facts, Page, Section } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, TableToolbar, tableCodec, useDataTable } from 'basalt-ui/table'
import type { IconComponent } from 'basalt-ui'
import { DateRangePicker } from 'basalt-ui/ui/date-picker'
import { Progress } from 'basalt-ui/ui/progress'
import { VirtualList } from 'basalt-ui/ui/virtual-list'
import {
  Building,
  Calendar,
  CircleCheck as CheckCircle,
  Clock,
  Coins,
  FileText,
  House as Home,
  Phone,
  Radio as Signal,
  Tag,
  TriangleExclamationPoint as Alert,
} from 'lucide-react'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { useFixture } from '../demo/fixture'

/** One glyph per booking state, drawn in its tone where the dot was. */
const STATE_ICONS: Record<string, IconComponent> = {
  Awaiting: Clock,
  Settled: CheckCircle,
  Disputed: Alert,
}

// ---- Section 1: finances shape, server mode ------------------------------------------------

type Booking = {
  id: string
  payee: string
  category: string
  state: string
  amount: number
  reconciled: boolean
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
  reconciled: i % 3 !== 0,
  at: day(i),
}))

const book = col<Booking>()

/** Ids and kinds only: it sits at module scope while the columns close over render values. */
const bookingsSchema = book.codec(
  {
    payee: 'entity',
    amount: 'money',
    state: 'status',
    category: 'text',
    reconciled: 'boolean',
    at: 'date',
  },
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
    look: field.enum(['reading', 'grid'] as const, 'reading').labels({
      reading: 'Reading',
      grid: 'Grid',
    }),
    table: field.composite(tableCodec(bookingsSchema)),
    large: field.composite(tableCodec(entriesSchema)),
    grouped: field.composite(tableCodec(roomsSchema)),
    booking: field.string(''),
  },
})

type Value = ReturnType<typeof exemplar.field.table.use>[0]

/** A `range` filter's ends as the endpoint reads them: `''` is an open end. */
const ends = (request: Value['request'], id: string): [string, string] => {
  const values = request.filters.find((f) => f.id === id)?.values ?? []
  return [values[0] ?? '', values[1] ?? '']
}

/**
 * The stand-in for the endpoint: it maps every filter of the request to its own query (a server
 * table filters nothing itself), sorts by the user's category order, pages, and returns the total
 * and the state facets, counted under every filter but the state one.
 */
function serve(request: Value['request'], month: string) {
  const q = request.q.trim().toLowerCase()
  const values = (id: string): readonly string[] =>
    request.filters.find((f) => f.id === id)?.values ?? []
  const states = values('state')
  const payees = values('payee')
  const reconciled = values('reconciled')
  const [min, max] = ends(request, 'amount')
  const [from, to] = ends(request, 'at')
  const inMonth = BOOKINGS.filter((b) => month === 'all' || b.at.startsWith(month))
  const searched = inMonth.filter(
    (b) =>
      q === '' ||
      `${b.payee} ${b.category} ${b.state} ${b.amount} ${b.at.slice(0, 10)}`
        .toLowerCase()
        .includes(q),
  )
  const narrowed = searched
    .filter((b) => payees.every((p) => b.payee.toLowerCase().includes(p.toLowerCase())))
    .filter((b) => reconciled.length === 0 || reconciled.includes(String(b.reconciled)))
    .filter(
      (b) => (min === '' || b.amount >= Number(min)) && (max === '' || b.amount <= Number(max)),
    )
    .filter(
      (b) => (from === '' || b.at.slice(0, 10) >= from) && (to === '' || b.at.slice(0, 10) <= to),
    )
  const matched = narrowed.filter((b) => states.length === 0 || states.includes(b.state))
  const sort = request.sort[0] ?? { id: 'at', desc: true }
  const sign = sort.desc ? -1 : 1
  const rank = request.ranks?.['state'] ?? STATES
  const key = (b: Booking): string | number =>
    sort.id === 'amount'
      ? b.amount
      : sort.id === 'state'
        ? rank.indexOf(b.state)
        : sort.id === 'reconciled'
          ? Number(b.reconciled)
          : ((b as Record<string, string | number | boolean>)[sort.id]?.toString() ?? '')
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
        count: narrowed.filter((b) => b.state === value).length,
      })),
    },
    sum: Math.round(matched.reduce((total, b) => total + b.amount, 0) * 100) / 100,
  }
}

function BookingDetail({ row }: { row: Booking }): ReactElement {
  const f = useFormat()
  return (
    <Facts
      rows={[
        { label: 'Payee', value: row.payee },
        { label: 'Category', value: row.category },
        { label: 'State', value: row.state },
        { label: 'Amount', value: <span data-numeric>{f.money(row.amount, 'EUR')}</span> },
        { label: 'Reconciled', value: row.reconciled ? 'Yes' : 'No' },
        { label: 'Booked', value: row.at.slice(0, 10) },
      ]}
    />
  )
}

const TONES = { Settled: 'good', Awaiting: 'warn', Disputed: 'bad' } as const

// #region finances-table
function Finances(): ReactElement {
  const [state] = exemplar.field.table.use()
  const [month] = exemplar.field.month.use()
  const [look] = exemplar.field.look.use()
  const [done, setDone] = useState('')
  const page = serve(state.request, month)
  // The endpoint's answer as a query, keyed by the request: a shot forces it loading, empty or failed.
  const served = useFixture(['table', 'bookings', state.request, month], page, {
    ...page,
    rows: [],
    total: 0,
    sum: 0,
  })
  const t = useDataTable({
    id: 'bookings',
    label: 'Bookings',
    look,
    columns: [
      book.entity('payee', { header: 'Payee', headerIcon: Building, filter: 'text' }),
      book.text('category', { header: 'Category', headerIcon: Tag }),
      book.status('state', {
        header: 'State',
        headerIcon: Signal,
        options: [...STATES],
        tone: (value) => TONES[value as keyof typeof TONES] ?? 'neutral',
        icon: (row) => STATE_ICONS[row.state],
        filter: 'multi',
      }),
      book.money('amount', {
        currency: 'EUR',
        header: 'Amount',
        headerIcon: Coins,
        footer: 'sum',
        filter: 'range',
        bounds: [-2000, 0],
      }),
      book.boolean('reconciled', { header: 'Reconciled', filter: 'multi', priority: 3 }),
      book.date('at', {
        header: 'Booked',
        headerIcon: Calendar,
        priority: 3,
        filter: 'range',
        picker: DateRangePicker,
      }),
      book.actions([{ id: 'rule', label: 'Make rule', onClick: () => setDone('Rule created') }]),
    ],
    data: served.data?.rows,
    phase: served,
    getRowId: (row) => row.id,
    mode: {
      kind: 'server',
      rowCount: served.data?.total ?? 0,
      facets: page.facets,
      totals: { amount: served.data?.sum ?? 0 },
    },
    state: exemplar.field.table,
    resetOn: [month],
    selection: {
      bulk: [
        {
          id: 'archive',
          label: 'Archive',
          onClick: (rows) => setDone(`Archived ${rows.length} bookings`),
        },
      ],
      selectAll: true,
    },
    detail: (row) => <BookingDetail row={row} />,
    detailTitle: (row) => row.payee,
    detailState: exemplar.field.booking,
  })
  return (
    <>
      <TableToolbar table={t} />
      <DataTable table={t} />
      <output className="block text-sm text-muted-foreground">{done}</output>
    </>
  )
}
// #endregion

// ---- Section 2: large, client mode, virtual ------------------------------------------------

function Large(): ReactElement {
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [opened, setOpened] = useState('')
  const entries = useFixture(['table', 'entries'], ENTRIES)
  const rows =
    entries.data === undefined || Object.keys(picked).length === 0
      ? entries.data
      : entries.data.map((e) => ({ ...e, category: picked[e.id] ?? e.category }))
  const t = useDataTable({
    id: 'entries',
    label: 'Entries',
    look: 'grid',
    rowNumbers: true,
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
      entry.money('amount', { currency: 'EUR', header: 'Amount', filter: 'range' }),
      entry.date('at', { header: 'Booked', priority: 3, filter: 'range', picker: DateRangePicker }),
    ],
    data: rows,
    phase: entries,
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
      <output className="block text-sm text-muted-foreground">
        {opened === '' ? '' : `Opened ${opened}`}
      </output>
    </>
  )
}

// ---- Section 4: notes, the record kinds --------------------------------------------------------

type Note = {
  id: string
  title: string
  kind: 'note' | 'call'
  preview: string
  author: string
  role: string
  team: string[]
  tags: string[]
  due: string
  site: string
  company: string
  ref: string
}

const NOTES_NOW = Date.UTC(2026, 10, 14, 12)

const NOTE_ROWS: readonly Note[] = [
  [
    'Renewal call',
    'call',
    'Walked through the renewal terms and the open seat questions',
    'Ada Lovelace',
    'Founder',
    ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Linus Torvalds', 'Edsger Dijkstra'],
    ['renewal', 'enterprise', 'priority', 'legal'],
    '2026-10-19',
    'https://acme.example/renewal',
    'Acme Logistics',
    'ACM-1',
  ],
  [
    'Pricing review',
    'note',
    'Compare the new tiers against the three nearest competitors',
    'Alan Turing',
    'Engineer',
    ['Alan Turing'],
    ['pricing'],
    '2026-11-18',
    'ada@example.com',
    'Globex GmbH',
    'GLB-7',
  ],
  [
    'Security questionnaire',
    'note',
    'Answers drafted, waiting on the infrastructure owner',
    'Grace Hopper',
    'Admiral',
    ['Grace Hopper', 'Ada Lovelace'],
    ['security', 'legal'],
    '2026-11-14',
    'https://initech.example',
    'Initech',
    'INI-3',
  ],
  [
    'Onboarding handover',
    'call',
    'Hand the account to the success team with the integration notes',
    'Linus Torvalds',
    'Maintainer',
    ['Linus Torvalds', 'Grace Hopper', 'Alan Turing'],
    ['onboarding', 'handover'],
    '2027-02-02',
    'https://umbrella.example/onboarding',
    'Umbrella Retail',
    'UMB-4',
  ],
].map(([title, kind, preview, author, role, team, tags, due, site, company, ref], i) => ({
  id: `nt-${i}`,
  title,
  kind,
  preview,
  author,
  role,
  team,
  tags,
  due,
  site,
  company,
  ref,
})) as Note[]

const note = col<Note>()

function Notes(): ReactElement {
  const notes = useFixture(['table', 'notes'], NOTE_ROWS)
  const t = useDataTable({
    id: 'notes',
    label: 'Notes',
    columns: [
      note.title('title', {
        header: 'Title',
        type: (row) => row.kind,
        icons: { note: FileText, call: Phone },
      }),
      note.text('preview', { header: 'Preview', quiet: true, priority: 3 }),
      note.person('author', {
        header: 'Author',
        role: (row) => row.role,
        filter: 'multi',
        priority: 2,
      }),
      note.entity('company', {
        header: 'Company',
        ref: (row) => row.ref,
        filter: 'text',
        priority: 2,
      }),
      note.people('team', { header: 'Known by', priority: 2 }),
      note.tags('tags', {
        header: 'Tags',
        filter: 'multi',
        tone: (tag) => (tag === 'legal' ? 'warn' : tag === 'priority' ? 'accent' : 'neutral'),
        priority: 2,
      }),
      note.countdown('due', { header: 'Due', warn: 7, priority: 2 }),
      note.link('site', { header: 'Site', priority: 2 }),
    ],
    data: notes.data,
    phase: notes,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    now: NOTES_NOW,
  })
  return (
    <>
      <TableToolbar table={t} />
      <DataTable table={t} />
    </>
  )
}

// ---- Section 3: grouped ---------------------------------------------------------------------

function Grouped(): ReactElement {
  const roomRows = useFixture(['table', 'rooms'], ROOMS)
  const t = useDataTable({
    id: 'rooms',
    label: 'Rooms',
    columns: [
      rooms.entity('room', { header: 'Room', headerIcon: Home }),
      rooms.status('state', {
        header: 'State',
        options: ['Done', 'Open'],
        tone: (value) => (value === 'Done' ? 'good' : 'neutral'),
        icon: (row) => (row.state === 'Done' ? CheckCircle : Clock),
        filter: 'multi',
      }),
      rooms.number('tasks', { header: 'Open tasks', footer: 'sum' }),
      rooms.text('floor', { header: 'Floor', priority: 3 }),
    ],
    data: roomRows.data,
    phase: roomRows,
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
  return (
    <>
      <TableToolbar table={t} />
      <DataTable table={t} />
    </>
  )
}

function TableRoute(): ReactElement {
  return (
    <Page area="table">
      <Section
        title="Bookings"
        tabs={{ state: exemplar.field.look, label: 'Table look' }}
        controls={filterSlot([spec(exemplar.field.month, 'Month')])}
      >
        <Finances />
      </Section>
      <Section title="Entries">
        <Large />
      </Section>
      <Section title="Rooms">
        <Grouped />
      </Section>
      <Section title="Notes">
        <Notes />
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/table')({
  staticData: { title: 'Table' },
  validateSearch: exemplar.validateSearch,
  search: { middlewares: exemplar.middlewares },
  component: TableRoute,
})
