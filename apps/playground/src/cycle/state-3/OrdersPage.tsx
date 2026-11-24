/**
 * State cycle 3 (docs/v3/cycles/state-3.md): one realistic data page built on the published surface
 * only. Four filters in the URL (a range, a multi-select, a search and a toggle), a table and a chart
 * of the same query behind the page tabs, a pushed list and a polled fulfilment figure, a connection
 * indicator, and a row that opens an edit form with a draft, validation, a submit helper and a
 * FormFooter. Every workaround carries a `cycle-state-3:` comment naming its finding.
 */
import { revalidateLogic, useForm } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { StatCell, StatGroup } from 'basalt-ui/cards'
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
import { optimistic, useConnection, useFreshness } from 'basalt-ui/data'
import { Page, PageBar, QueryState, Section } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { Fieldset, Form } from 'basalt-ui/ui/field'
import { Input } from 'basalt-ui/ui/input'
import { Select } from 'basalt-ui/ui/select'
import { Switch } from 'basalt-ui/ui/switch'
import { Textarea } from 'basalt-ui/ui/textarea'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { z } from 'zod'
import { DEMO_SERIES } from '../../demo/series'
import { STATUSES, STATUS_LABELS, ordersApi } from './orders-api'
import type { Order, OrderQuery, OrderStatus, OrderValues } from './orders-api'
import { fulfilmentQuery, orderQuery, ordersQuery } from './orders-live'
import { orders } from './orders-store'

const FILTERS = filterSlot([
  spec(orders.field.placed, 'Placed'),
  spec(orders.field.status, 'Status'),
  spec(orders.field.q, 'Search', { placeholder: 'Customer or order id' }),
  spec(orders.field.flagged, 'Flagged only'),
])

// cycle-state-3: state-3.4 — `useReset()` unsets every field, the view tab and the open order with
// the filters (a Clear filters on the chart's empty state lands on the table), and FilterSet's own
// `Reset all` is not exported, so the filters are cleared one by one.
const clearFilters = (): void => {
  const { placed, status, q, flagged } = orders.field
  for (const handle of [placed, status, q, flagged]) handle.clear()
}

/** The list query, read from the store: the window resolves to ISO days through the field. */
function useOrderQuery(): OrderQuery {
  const { placed, status, q, flagged } = orders.useValues()
  return { ...orders.field.placed.toWindow(placed), status, q, flagged }
}

const c = col<Order>()
const STATUS_TONE: Record<OrderStatus, 'good' | 'warn' | 'info' | 'neutral'> = {
  pending: 'warn',
  paid: 'info',
  shipped: 'good',
  refunded: 'neutral',
}
const columns = [
  c.entity('id', { header: 'Order', priority: 1 }),
  c.text('customer', { header: 'Customer', priority: 1 }),
  c.status('status', {
    header: 'Status',
    options: STATUSES,
    labels: STATUS_LABELS,
    tone: (value) => STATUS_TONE[value],
    priority: 2,
  }),
  c.money('total', { header: 'Total', currency: 'EUR', priority: 2 }),
  c.boolean('flagged', { header: 'Flagged', labels: ['Held', 'No'], priority: 3 }),
  c.date('placed', { header: 'Placed', priority: 2 }),
]

type Day = { day: Date; count: number }

function perDay(rows: readonly Order[]): Day[] {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.placed, (counts.get(row.placed) ?? 0) + 1)
  return [...counts.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day: new Date(`${day}T00:00:00Z`), count }))
}

type ListResult = ReturnType<typeof useQuery<Order[]>>

function OrdersTable({ list, query }: { list: ListResult; query: OrderQuery }): ReactElement {
  const table = useDataTable<Order>({
    id: 'cycle-state-3-orders',
    label: 'Orders',
    columns,
    data: list.data,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    phase: list,
    resetOn: [query],
    empty: { cause: 'No order matches these filters.', filtered: { reset: clearFilters } },
    detail: (row) => <EditOrder key={row.id} id={row.id} />,
    detailTitle: (row) => `Edit order ${row.id}`,
    detailState: orders.field.order,
  })
  return <DataTable table={table} height="auto" />
}

function OrdersChart({ list }: { list: ListResult }): ReactElement {
  const days = perDay(list.data ?? [])
  return (
    <ChartCard
      title="Orders placed per day"
      phase={list}
      empty={{ cause: 'No order matches these filters.', filtered: { reset: clearFilters } }}
      figure={{ value: list.data?.length ?? null, unit: 'orders', period: 'in range' }}
      chart={(box) => (
        <Bars<Day>
          label="Orders placed per day"
          data={days}
          x={{ value: (d) => d.day }}
          height={box.height}
          series={[
            {
              mark: 'bar',
              key: 'count',
              label: 'Placed',
              color: DEMO_SERIES.sessions,
              y: (d) => d.count,
            },
          ]}
        />
      )}
    />
  )
}

function Fulfilment(): ReactElement {
  const stats = useQuery(fulfilmentQuery())
  return (
    <StatGroup variant="strip" label="Fulfilment">
      <StatCell
        phase={stats}
        title="Awaiting shipment"
        value={stats.data?.awaiting ?? null}
        sub="Polled every 5 s"
      />
      <StatCell
        phase={stats}
        title="Late"
        value={stats.data?.late ?? null}
        status={{ tone: 'bad', label: 'Over 48 h' }}
      />
    </StatGroup>
  )
}

const OrderSchema = z.object({
  status: z.enum(['pending', 'paid', 'shipped', 'refunded']),
  tracking: z
    .string()
    .trim()
    .regex(/^([A-Z]{3}\d{6,})?$/, 'A carrier code and six digits or more, like DHL880013.'),
  flagged: z.boolean(),
  note: z.string().max(280, 'Keep the note under 280 characters.'),
})

const STATUS_OPTIONS = STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))
const valuesOf = ({ status, tracking, flagged, note }: Order): OrderValues => ({
  status,
  tracking,
  flagged,
  note,
})

function EditOrderForm({ order }: { order: Order }): ReactElement {
  const save = useMutation({
    mutationFn: (values: OrderValues) => ordersApi.save(order.id, values),
    ...optimistic<OrderValues, Order>({
      key: ['orders', 'save', order.id],
      targets: [
        {
          queryKey: orderQuery(order.id).queryKey,
          apply: (prev, values) => ({ ...prev, ...values }),
        },
      ],
    }),
    // The natural place to close the record: the save is done. Cycle 2's state-2.4 lost the draft
    // here; v3-state-2-draft-unmount says the draft is deleted even when this unmounts the form.
    onSuccess: () => orders.field.order.clear(),
  })
  const form = useForm({
    defaultValues: valuesOf(order),
    validationLogic: revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: OrderSchema,
      onSubmitAsync: toSubmitErrors((values: OrderValues) => save.mutateAsync(values)),
    },
  })
  const draft = useFormDraft(form, {
    key: `cycle-state-3-order:${order.id}`,
    version: 1,
    schema: OrderSchema,
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
        {/* A Select homed by its FormField alone, outside a FormRow: state-2.13's waiver case. */}
        <form.Field name="status">
          {(f) => (
            <FormField label="Status" field={f}>
              <Select aria-label="Status" options={STATUS_OPTIONS} />
            </FormField>
          )}
        </form.Field>
        <FormRow>
          <form.Field name="tracking">
            {(f) => (
              <FormField label="Tracking number" description="Needed once shipped." field={f}>
                <Input autoComplete="off" />
              </FormField>
            )}
          </form.Field>
          <form.Field name="flagged">
            {(f) => (
              <FormField label="Hold for a fraud check" field={f}>
                <Switch />
              </FormField>
            )}
          </form.Field>
        </FormRow>
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
            { label: 'Cancel', onClick: () => orders.field.order.clear() },
            { label: 'Save', primary: true },
          ]}
        />
      </Fieldset>
    </Form>
  )
}

function EditOrder({ id }: { id: string }): ReactElement {
  const order = useQuery(orderQuery(id))
  return (
    <QueryState phase={order}>
      {order.data === undefined ? null : <EditOrderForm order={order.data} />}
    </QueryState>
  )
}

function OrdersBody(): ReactElement {
  const query = useOrderQuery()
  const list = useQuery(ordersQuery(query))
  const { view } = orders.useValues()
  const connection = useConnection()
  const freshness = useFreshness([['orders']])

  return (
    <Page area="cycle-state-3-orders">
      <PageBar
        title="Orders"
        tabs={{ state: orders.field.view, label: 'Orders view' }}
        controls={FILTERS}
        connection={connection}
        refresh={{ scope: 'page', ...freshness.button }}
      />
      <Fulfilment />
      <Section title={view === 'table' ? 'All orders' : 'Placed per day'}>
        {view === 'table' ? <OrdersTable list={list} query={query} /> : <OrdersChart list={list} />}
      </Section>
    </Page>
  )
}

/** "Somebody else" flags or clears an order every 20 s; the push feed is how this page learns of it. */
const ELSEWHERE_MS = 20_000

export function OrdersPage(): ReactElement {
  useEffect(() => {
    // The stand-in for other users' edits: fixture, not glue.
    const timer = setInterval(() => ordersApi.touchElsewhere(), ELSEWHERE_MS)
    return () => clearInterval(timer)
  }, [])
  return <OrdersBody />
}
