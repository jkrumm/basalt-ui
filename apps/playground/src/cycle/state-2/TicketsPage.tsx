/**
 * State cycle 2 (docs/v3/cycles/state-2.md): one realistic data page built on the published surface
 * only. Four filters in the URL, a table and a chart of the same query behind the page tabs, a pushed
 * list and a polled queue figure, a connection indicator and an edit form with a draft, validation, a
 * submit helper and a FormFooter. Every workaround carries a `cycle-state-2:` comment naming its
 * finding.
 */
import { revalidateLogic, useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bars, ChartCard } from 'basalt-ui/charts'
import {
  FormField,
  FormFooter,
  FormRow,
  filterSlot,
  spec,
  toSubmitErrors,
  useFormDraft,
} from 'basalt-ui/controls'
import { bindInvalidation, optimistic, useConnection, useFreshness } from 'basalt-ui/data'
import { StatCell, StatGroup } from 'basalt-ui/cards'
import { Page, PageBar, QueryState, Section } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { Fieldset, Form } from 'basalt-ui/ui/field'
import { Input } from 'basalt-ui/ui/input'
import { Select } from 'basalt-ui/ui/select'
import { Sheet, SheetContent } from 'basalt-ui/ui/sheet'
import { Textarea } from 'basalt-ui/ui/textarea'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { z } from 'zod'
import { DEMO_SERIES } from '../../demo/series'
import {
  AGENTS,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  ticketsApi,
} from './tickets-api'
import type { Priority, Ticket, TicketQuery, TicketValues } from './tickets-api'
import { queueQuery, ticketQuery, ticketsChannel, ticketsQuery } from './tickets-live'
import { tickets } from './tickets-store'

const FILTERS = filterSlot([
  spec(tickets.field.opened, 'Opened'),
  spec(tickets.field.priority, 'Priority'),
  spec(tickets.field.q, 'Search', { placeholder: 'Subject, requester or id' }),
  spec(tickets.field.unassigned, 'Unassigned only'),
])

/** The list query, read from the store: the window resolves to ISO days through the field. */
function useTicketQuery(): TicketQuery {
  const { priority, q, unassigned } = tickets.useValues()
  // cycle-state-2: state-2.2 — `useValues()` types and returns a range field as its preset param
  // (`opened: string`), not the `RangeValue` its doc promises, so `toWindow` cannot take it and the
  // range is read through its own handle.
  const [opened] = tickets.field.opened.use()
  const window = tickets.field.opened.toWindow(opened)
  // cycle-state-2: state-2.3 — every preset has a resolver, yet `toWindow` still returns a
  // `{ window: never }` member, so the dates are narrowed out by hand.
  if (!('from' in window)) throw new Error(`unresolved window ${JSON.stringify(window)}`)
  return { from: window.from, to: window.to, priority, q, unassigned }
}

const c = col<Ticket>()
const PRIORITY_TONE: Record<Priority, 'bad' | 'warn' | 'info' | 'neutral'> = {
  urgent: 'bad',
  high: 'warn',
  normal: 'info',
  low: 'neutral',
}
const columns = [
  c.entity('id', { header: 'Ticket', priority: 1 }),
  c.text('subject', { header: 'Subject', priority: 1 }),
  // cycle-state-2: state-2.6 — `c.status` takes the option values and no labels, so the cell prints
  // the stored code (`urgent`), while the store's field carries `.labels()` for the same options.
  c.status('priority', {
    header: 'Priority',
    options: PRIORITIES,
    tone: (value) => PRIORITY_TONE[value],
    priority: 2,
  }),
  c.text('assignee', { header: 'Assignee', priority: 2 }),
  c.text('requester', { header: 'Requester', priority: 3 }),
  c.date('opened', { header: 'Opened', priority: 2 }),
]

type Day = { day: Date; count: number }

function perDay(rows: readonly Ticket[]): Day[] {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.opened, (counts.get(row.opened) ?? 0) + 1)
  return [...counts.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day: new Date(`${day}T00:00:00Z`), count }))
}

type ListResult = ReturnType<typeof useQuery<Ticket[]>>

function TicketsTable({ list, query }: { list: ListResult; query: TicketQuery }): ReactElement {
  const [, open] = tickets.field.ticket.use()
  const table = useDataTable<Ticket>({
    id: 'cycle-state-2-tickets',
    label: 'Tickets',
    columns,
    data: list.data,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    phase: list,
    resetOn: [query],
    // cycle-state-2: state-2.11 — the table's own `detail` door keeps the open row in component state
    // (no handle), so a reload or a shared link loses it; the row writes the URL field instead and
    // the page draws its own sheet.
    onRowActivate: (row) => open(row.id),
  })
  return <DataTable table={table} height="auto" />
}

function TicketsChart({ list }: { list: ListResult }): ReactElement {
  const days = perDay(list.data ?? [])
  return (
    <ChartCard
      title="Tickets opened per day"
      phase={list}
      // cycle-state-2: state-2.10 — the card cannot tell an empty result from its phase, so the app
      // derives `empty` from the rows (`DataTable` derives its own).
      empty={list.data?.length === 0 ? { cause: 'No ticket matches these filters.' } : null}
      figure={{ value: list.data?.length ?? null, unit: 'tickets', period: 'in range' }}
      chart={(box) => (
        <Bars<Day>
          label="Tickets opened per day"
          data={days}
          x={{ value: (d) => d.day }}
          height={box.height}
          series={[
            {
              mark: 'bar',
              key: 'count',
              label: 'Opened',
              color: DEMO_SERIES.sessions,
              y: (d) => d.count,
            },
          ]}
        />
      )}
    />
  )
}

function Queue(): ReactElement {
  const queue = useQuery(queueQuery())
  return (
    <StatGroup variant="strip" label="Queue">
      <StatCell
        phase={queue}
        title="Open tickets"
        value={queue.data?.open ?? null}
        sub="Polled every 5 s"
      />
      <StatCell
        phase={queue}
        title="Breaching SLA"
        value={queue.data?.breaching ?? null}
        status={{ tone: 'bad', label: 'Over 4 h' }}
      />
    </StatGroup>
  )
}

const TicketSchema = z.object({
  subject: z.string().trim().min(4, 'Say what the ticket is about.'),
  priority: z.enum(['urgent', 'high', 'normal', 'low']),
  status: z.enum(['open', 'waiting', 'solved']),
  assignee: z.string(),
  note: z.string().max(280, 'Keep the note under 280 characters.'),
})

const PRIORITY_OPTIONS = PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] }))
const STATUS_OPTIONS = STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))
const ASSIGNEE_OPTIONS = [
  { value: '', label: 'Nobody' },
  ...AGENTS.map((value) => ({ value, label: value })),
]
const valuesOf = ({ id: _id, opened: _opened, requester: _r, ...values }: Ticket): TicketValues =>
  values

function EditTicketForm({ ticket }: { ticket: Ticket }): ReactElement {
  const save = useMutation({
    mutationFn: (values: TicketValues) => ticketsApi.save(ticket.id, values),
    ...optimistic<TicketValues, Ticket>({
      key: ['tickets', 'save', ticket.id],
      targets: [
        {
          queryKey: ticketQuery(ticket.id).queryKey,
          apply: (prev, values) => ({ ...prev, ...values }),
        },
      ],
    }),
  })
  const form = useForm({
    defaultValues: valuesOf(ticket),
    validationLogic: revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: TicketSchema,
      // cycle-state-2: state-2.4 — closing the record in the mutation's `onSuccess` unmounts the form
      // before `useFormDraft` sees the submit end, so the autosaved key outlives the save and the
      // next open says "Draft restored" over the saved ticket. The app clears the draft itself,
      // before it closes the record.
      onSubmitAsync: toSubmitErrors(async (values: TicketValues) => {
        await save.mutateAsync(values)
        // oxlint-disable-next-line no-use-before-define -- `draft` is built from this form, and this runs on submit, after it exists
        draft.clear()
        tickets.field.ticket.clear()
      }),
    },
  })
  const draft = useFormDraft(form, {
    key: `cycle-state-2-ticket:${ticket.id}`,
    version: 1,
    schema: TicketSchema,
    owner: 'demo',
  })

  return (
    <Form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <Fieldset disabled={form.state.isSubmitting}>
        <output className="block text-sm text-muted-foreground empty:hidden">
          {draft.status === 'restored' ? 'Draft restored from this device.' : null}
        </output>
        <form.Field name="subject">
          {(f) => (
            <FormField label="Subject" required field={f}>
              <Input autoComplete="off" />
            </FormField>
          )}
        </form.Field>
        <FormRow>
          <form.Field name="priority">
            {(f) => (
              <FormField label="Priority" field={f}>
                <Select aria-label="Priority" options={PRIORITY_OPTIONS} />
              </FormField>
            )}
          </form.Field>
          <form.Field name="status">
            {(f) => (
              <FormField label="Status" field={f}>
                <Select aria-label="Status" options={STATUS_OPTIONS} />
              </FormField>
            )}
          </form.Field>
        </FormRow>
        <form.Field name="assignee">
          {(f) => (
            <FormField label="Assignee" description="An urgent ticket needs one." field={f}>
              <Select aria-label="Assignee" options={ASSIGNEE_OPTIONS} />
            </FormField>
          )}
        </form.Field>
        <form.Field name="note">
          {(f) => (
            <FormField label="Internal note" field={f}>
              <Textarea rows={4} />
            </FormField>
          )}
        </form.Field>
        <FormFooter
          form={form}
          actions={[
            { label: 'Cancel', onClick: () => tickets.field.ticket.clear() },
            { label: 'Save', primary: true },
          ]}
        />
      </Fieldset>
    </Form>
  )
}

function EditTicket({ id }: { id: string }): ReactElement {
  const ticket = useQuery(ticketQuery(id))
  return (
    <QueryState phase={ticket}>
      {ticket.data === undefined ? null : <EditTicketForm ticket={ticket.data} />}
    </QueryState>
  )
}

function TicketsBody(): ReactElement {
  const query = useTicketQuery()
  const list = useQuery(ticketsQuery(query))
  const { view, ticket } = tickets.useValues()
  const connection = useConnection()
  const freshness = useFreshness([['tickets']])

  return (
    <Page area="cycle-state-2-tickets">
      <PageBar
        title="Tickets"
        tabs={{ state: tickets.field.view, label: 'Tickets view' }}
        controls={FILTERS}
        connection={connection}
        refresh={{ scope: 'page', ...freshness.button }}
      />
      <Queue />
      <Section title={view === 'table' ? 'All tickets' : 'Opened per day'}>
        {view === 'table' ? (
          <TicketsTable list={list} query={query} />
        ) : (
          <TicketsChart list={list} />
        )}
      </Section>
      <Sheet state={tickets.field.ticket}>
        {/* oxlint-disable-next-line basalt/viewport-keyed -- lint-1.20: the cycle build's sheet width, kept as its builder left it */}
        <SheetContent title={`Edit ticket ${ticket}`} className="md:w-120">
          {ticket === '' ? null : <EditTicket key={ticket} id={ticket} />}
        </SheetContent>
      </Sheet>
    </Page>
  )
}

/** "Somebody else" reassigns a ticket every 20 s; the push feed is how this page learns of it. */
const ELSEWHERE_MS = 20_000

export function TicketsPage(): ReactElement {
  const client = useQueryClient()
  // cycle-state-2: state-2.1 — `bindInvalidation` needs the client; the page starts the binding itself
  // rather than handing it to the provider's `live` option in main.tsx.
  useEffect(
    () =>
      bindInvalidation(client, ticketsChannel, {
        roots: ['tickets'],
        greeting: 'hello',
        map: () => 'tickets',
      }).start(),
    [client],
  )
  useEffect(() => {
    // The stand-in for other users' edits: fixture, not glue.
    const timer = setInterval(() => ticketsApi.touchElsewhere(), ELSEWHERE_MS)
    return () => clearInterval(timer)
  }, [])
  return <TicketsBody />
}
