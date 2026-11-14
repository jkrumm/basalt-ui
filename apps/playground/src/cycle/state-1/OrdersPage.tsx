// theme-allow-file raw-selection-control — the guard reads a 2.x `Select` as a bare filter; this is a v3 `Select` bound to a form field
/**
 * State cycle 1 (docs/v3/cycles/state-1.md): one realistic data page built on the published
 * surface only. Four filters in the URL, a table and a chart of the same query behind ViewTabs, a
 * pushed live query, a connection indicator and an edit form with a draft, validation and a submit
 * helper. Every workaround carries a `cycle-state-1:` comment naming its finding.
 */
import { revalidateLogic, useForm } from '@tanstack/react-form'
import { QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query'
import { Bars, ChartCard } from 'basalt-ui/charts'
import {
  FilterSet,
  FormField,
  FormFooter,
  FormRow,
  ViewTabs,
  spec,
  toSubmitErrors,
  useFormDraft,
} from 'basalt-ui/controls'
import { optimistic, useConnection, useFreshness } from 'basalt-ui/data'
import { ConnectionIndicator, Page, PageBar, QueryState, Section } from 'basalt-ui/page'
import type { RangeValue } from 'basalt-ui/router'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { Fieldset, Form } from 'basalt-ui/ui/field'
import { Input } from 'basalt-ui/ui/input'
import { NumberField } from 'basalt-ui/ui/number-field'
import { Select } from 'basalt-ui/ui/select'
import { Sheet, SheetContent } from 'basalt-ui/ui/sheet'
import { Switch } from 'basalt-ui/ui/switch'
import { Textarea } from 'basalt-ui/ui/textarea'
import { useEffect } from 'react'
import type { ComponentProps, ReactElement } from 'react'
import { z } from 'zod'
import { demoColors } from '../../demo/series'
import { useV3Tokens } from '../../demo/v3-tokens'
import { STATUSES, STATUS_LABELS, daysAgo, ordersApi, presetDays, todayIso } from './orders-api'
import type { Order, OrderQuery, OrderStatus, OrderValues } from './orders-api'
import { orderQuery, ordersClient, ordersLive, ordersQuery } from './orders-live'
import { orders } from './orders-store'

const FILTERS = [
  // cycle-state-1: state-1.2 — `spec` refuses the handles `field.range` and `field.multi` return
  // (their `options` are typed per element, `ControlHandle<T>` wants options of `T`), so both pass
  // through a cast.
  spec(orders.field.window as never, 'Date'),
  spec(orders.field.status as never, 'Status'),
  spec(orders.field.q, 'Search', { placeholder: 'Customer or order id' }),
  spec(orders.field.flagged, 'Flagged only'),
]

// cycle-state-1: state-1.9 — a `tabs` slot has no constructor (`filterSlot` takes specs and draws
// pills), so the page writes the slot literal by hand, as routes/overview.tsx does.
const TABS: NonNullable<ComponentProps<typeof PageBar>['tabs']> = {
  kind: 'controls-slot',
  count: 1,
  render: () => <ViewTabs handle={orders.field.view} label="Orders view" />,
}

// cycle-state-1: state-1.13 — the docs name neither `range({ window })` resolvers nor `useValues()`, so
// the app turns `7d` into dates itself and reads the four fields one by one.
function resolveWindow(value: RangeValue<'7d' | '30d' | '90d' | 'custom'>): {
  from: string
  to: string
} {
  const window = orders.field.window.toWindow(value)
  if ('from' in window) return { from: window.from, to: window.to }
  // cycle-state-1: state-1.18 — a custom value without both dates comes back as `{ window: 'custom' }`.
  if (window.window === 'custom') return { from: daysAgo(presetDays['30d']), to: todayIso() }
  return { from: daysAgo(presetDays[window.window]), to: todayIso() }
}

function useOrderQuery(): OrderQuery {
  const [window] = orders.field.window.use()
  const [status] = orders.field.status.use()
  const [q] = orders.field.q.use()
  const [flagged] = orders.field.flagged.use()
  return { ...resolveWindow(window), status, q, flagged }
}

const c = col<Order>()
const STATUS_TONE: Record<OrderStatus, 'good' | 'warn' | 'bad' | 'neutral'> = {
  paid: 'good',
  pending: 'warn',
  failed: 'bad',
  refunded: 'neutral',
}
const columns = [
  c.entity('id', { header: 'Order', priority: 1 }),
  c.text('customer', { header: 'Customer', priority: 1 }),
  c.status('status', {
    header: 'Status',
    options: STATUSES,
    // cycle-state-1: state-1.16 — the tone callback takes a `string`, so the closed union needs a cast.
    tone: (value) => STATUS_TONE[value as OrderStatus],
    priority: 2,
  }),
  c.money('amount', { header: 'Amount', currency: 'EUR' }),
  c.date('date', { header: 'Date', priority: 2 }),
]

type Day = { day: Date; total: number }

function byDay(rows: readonly Order[]): Day[] {
  const totals = new Map<string, number>()
  for (const row of rows) totals.set(row.date, (totals.get(row.date) ?? 0) + row.amount)
  return [...totals.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([day, total]) => ({ day: new Date(`${day}T00:00:00Z`), total }))
}

function OrdersTable({ list }: { list: ReturnType<typeof useQuery<Order[]>> }): ReactElement {
  const [, setEdit] = orders.field.edit.use()
  const query = useOrderQuery()
  const table = useDataTable<Order>({
    id: 'cycle-state-orders',
    label: 'Orders',
    columns,
    // cycle-state-1: state-1.17 — the table wants an array while the query is still pending; the
    // phase carries the truth, the empty array only feeds the first frame.
    data: list.data ?? [],
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    phase: list,
    resetOn: [query],
    onRowActivate: (row) => setEdit(row.id),
  })
  return <DataTable table={table} height="auto" />
}

function OrdersChart({ list }: { list: ReturnType<typeof useQuery<Order[]>> }): ReactElement {
  const days = byDay(list.data ?? [])
  const total = days.reduce((sum, d) => sum + d.total, 0)
  return (
    // cycle-state-1: state-1.11 — `basalt-ui/charts` exports the 2.x `ChartCard` (`state`, `facts`,
    // children), not the v3 card `docs/chart-card.md` describes (`phase`, `figure`, `chart`), so
    // the query's phase is mapped onto `state` by hand.
    <ChartCard
      title="Order value per day"
      facts={{ value: Math.round(total).toLocaleString('en'), unit: 'EUR', period: 'in range' }}
      state={{
        pending: list.isPending,
        error: list.isError ? list.error : undefined,
        empty: list.isSuccess && days.length === 0 ? 'No order matches these filters.' : undefined,
      }}
      onRetry={() => void list.refetch()}
      retrying={list.isFetching}
    >
      <Bars<Day, Date>
        ariaLabel="Order value per day"
        data={days}
        x={(d) => d.day}
        bars={[
          {
            key: 'total',
            label: 'Order value',
            color: demoColors.revenue,
            getValue: (d) => d.total,
          },
        ]}
      />
    </ChartCard>
  )
}

const OrderSchema = z.object({
  customer: z.string().trim().min(2, 'Name the customer.'),
  status: z.enum(['paid', 'pending', 'failed', 'refunded']),
  amount: z.number('Enter an amount.').min(0.01, 'At least 0.01.'),
  flagged: z.boolean(),
  note: z.string().max(280, 'Keep the note under 280 characters.'),
})

const STATUS_OPTIONS = STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))
const valuesOf = ({ id: _id, date: _date, ...values }: Order): OrderValues => values

function EditOrderForm({ order }: { order: Order }): ReactElement {
  const save = useMutation({
    mutationFn: (values: OrderValues) => ordersApi.save(order.id, values),
    ...optimistic<OrderValues>({
      key: ['orders', 'save', order.id],
      targets: [
        {
          queryKey: orderQuery(order.id).queryKey,
          // cycle-state-1: state-1.19 — `apply` receives `prev: unknown`, so the cached record needs a cast.
          apply: (prev, values) => ({ ...(prev as Order), ...values }),
        },
      ],
    }),
  })
  const form = useForm({
    defaultValues: valuesOf(order),
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: OrderSchema,
      onSubmitAsync: toSubmitErrors((values: OrderValues) => save.mutateAsync(values)),
    },
  })
  const draft = useFormDraft(form, {
    key: `cycle-state-order:${order.id}`,
    version: 1,
    schema: OrderSchema,
    owner: 'demo',
  })

  // cycle-state-1: state-1.6 — the submit helper ends at the server: clearing the draft, re-basing
  // the form on the saved value and closing the record are the app's, after every successful save.
  async function submit(): Promise<void> {
    await form.handleSubmit()
    if (!form.state.isSubmitSuccessful) return
    draft.clear()
    form.reset(form.state.values)
    orders.field.edit.clear()
  }

  return (
    <Form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <Fieldset disabled={form.state.isSubmitting}>
        <p role="status" className="m-0 text-sm text-muted-foreground empty:hidden">
          {draft.status === 'restored' ? 'Draft restored from this device.' : null}
        </p>
        <form.Field name="customer">
          {(f) => (
            <FormField label="Customer" required field={f}>
              <Input />
            </FormField>
          )}
        </form.Field>
        <FormRow>
          <form.Field name="status">
            {(f) => (
              <FormField label="Status" field={f}>
                <Select aria-label="Status" options={STATUS_OPTIONS} />
              </FormField>
            )}
          </form.Field>
          <form.Field name="amount">
            {(f) => (
              <FormField label="Amount (EUR)" description="Above 50,000 needs approval." field={f}>
                <NumberField min={0} format={{ style: 'currency', currency: 'EUR' }} />
              </FormField>
            )}
          </form.Field>
        </FormRow>
        <form.Field name="flagged">
          {(f) => (
            <FormField label="Flag for review" field={f}>
              <Switch />
            </FormField>
          )}
        </form.Field>
        <form.Field name="note">
          {(f) => (
            <FormField label="Note" field={f}>
              <Textarea rows={4} />
            </FormField>
          )}
        </form.Field>
        <FormFooter
          form={form}
          actions={[
            { label: 'Cancel', onClick: () => orders.field.edit.clear() },
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
  const [view] = orders.field.view.use()
  const [edit] = orders.field.edit.use()
  const connection = useConnection()
  const freshness = useFreshness([['orders', 'list']])

  return (
    <Page area="cycle-state-orders">
      <PageBar title="Orders" tabs={TABS} refresh={{ scope: 'page', ...freshness.button }} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterSet specs={FILTERS} />
        {/* cycle-state-1: state-1.8 — the indicator's slot is "the end slot of the page bar", and
            PageBar has no prop that takes it, so it sits on the filter row. */}
        <ConnectionIndicator connection={connection} />
      </div>
      <Section title={view === 'table' ? 'All orders' : 'Value per day'}>
        {view === 'table' ? <OrdersTable list={list} /> : <OrdersChart list={list} />}
      </Section>
      {/* cycle-state-1: state-1.10 — the open record is a URL field, and the sheet takes `open` and
          `onOpenChange`, so the page maps the string onto both by hand. */}
      <Sheet
        open={edit !== ''}
        onOpenChange={(open) => {
          if (!open) orders.field.edit.clear()
        }}
      >
        <SheetContent title={`Edit order ${edit}`} className="md:w-120">
          {edit === '' ? null : <EditOrder key={edit} id={edit} />}
        </SheetContent>
      </Sheet>
    </Page>
  )
}

/** "Somebody else" edits an order every 20 s; the push feed is how this page learns of it. */
const ELSEWHERE_MS = 20_000

export function OrdersPage(): ReactElement {
  useV3Tokens()
  // cycle-state-1: state-1.20 — the binding's documented root effect is the app's to write.
  useEffect(() => ordersLive.start(), [])
  useEffect(() => {
    // The stand-in for other users' edits: fixture, not glue.
    const timer = setInterval(() => ordersApi.touchElsewhere(), ELSEWHERE_MS)
    return () => clearInterval(timer)
  }, [])
  return (
    <QueryClientProvider client={ordersClient}>
      <OrdersBody />
    </QueryClientProvider>
  )
}
