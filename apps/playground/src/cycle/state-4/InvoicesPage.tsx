/**
 * State cycle 4 (docs/v3/cycles/state-4.md): one realistic data page built on the published surface
 * only. Four filters in the URL (a range, a multi-select, a search and a toggle), a table and a chart
 * of the same query behind the page tabs, a pushed list and a polled receivables figure, a connection
 * indicator, and a row that opens an edit form with a draft, validation, a submit helper and a
 * FormFooter through the table's own detail door. Every workaround carries a `cycle-state-4:`
 * comment naming its finding.
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
import { STATUSES, STATUS_LABELS, invoicesApi } from './invoices-api'
import type { Invoice, InvoiceQuery, InvoiceStatus, InvoiceValues } from './invoices-api'
import { invoiceQuery, invoicesQuery, receivablesQuery } from './invoices-live'
import { invoices } from './invoices-store'

const field = invoices.field

const FILTERS = filterSlot([
  spec(field.issued, 'Issued'),
  spec(field.status, 'Status'),
  spec(field.q, 'Search', { placeholder: 'Customer or invoice id' }),
  spec(field.disputed, 'Disputed only'),
])

/** The filters alone, for every Clear filters: the view tab and the open invoice stay. */
// cycle-state-4: state-4.5 — `FILTERS` already names these four fields; `useReset({ only })` takes
// handles, not the slot, so the list is written a second time here.
const useClearFilters = (): (() => void) =>
  invoices.useReset({ only: [field.issued, field.status, field.q, field.disputed] })

/** The list query, read from the store: the window resolves to ISO days through the field. */
function useInvoiceQuery(): InvoiceQuery {
  const { issued, status, q, disputed } = invoices.useValues()
  return { ...field.issued.toWindow(issued), status, q, disputed }
}

const c = col<Invoice>()
const STATUS_TONE: Record<InvoiceStatus, 'good' | 'warn' | 'info' | 'neutral'> = {
  draft: 'neutral',
  sent: 'info',
  paid: 'good',
  void: 'warn',
}
const columns = [
  c.entity('id', { header: 'Invoice', priority: 1 }),
  c.text('customer', { header: 'Customer', priority: 1 }),
  c.status('status', {
    header: 'Status',
    options: STATUSES,
    labels: STATUS_LABELS,
    tone: (value) => STATUS_TONE[value],
    priority: 2,
  }),
  c.money('amount', { header: 'Amount', currency: 'EUR', priority: 2 }),
  c.boolean('disputed', { header: 'Disputed', labels: ['Disputed', 'No'], priority: 3 }),
  c.date('issued', { header: 'Issued', priority: 2 }),
]

type Day = { day: Date; amount: number }

function perDay(rows: readonly Invoice[]): Day[] {
  const sums = new Map<string, number>()
  for (const row of rows) sums.set(row.issued, (sums.get(row.issued) ?? 0) + row.amount)
  return [...sums.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([day, amount]) => ({ day: new Date(`${day}T00:00:00Z`), amount }))
}

type ListResult = ReturnType<typeof useQuery<Invoice[]>>

const EMPTY_CAUSE = 'No invoice matches these filters.'

function InvoicesTable({ list, query }: { list: ListResult; query: InvoiceQuery }): ReactElement {
  const reset = useClearFilters()
  const table = useDataTable<Invoice>({
    id: 'cycle-state-4-invoices',
    label: 'Invoices',
    columns,
    data: list.data,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    phase: list,
    resetOn: [query],
    empty: { cause: EMPTY_CAUSE, filtered: { reset } },
    detail: (row) => <EditInvoice key={row.id} id={row.id} />,
    detailTitle: (row) => `Edit invoice ${row.id}`,
    detailState: field.invoice,
    // cycle-state-4: state-4.2, state-4.4 — the same body again for a record no loaded row has; its
    // sheet reads the table label, since `detailTitle` takes a row only.
    detailById: (id) => <EditInvoice key={id} id={id} />,
  })
  return <DataTable table={table} height="auto" />
}

function InvoicesChart({ list }: { list: ListResult }): ReactElement {
  const reset = useClearFilters()
  return (
    <ChartCard
      title="Invoiced per day"
      phase={list}
      empty={{ cause: EMPTY_CAUSE, filtered: { reset } }}
      figure={{ value: list.data?.length ?? null, unit: 'invoices', period: 'in range' }}
      chart={(box) => (
        <Bars<Day>
          label="Invoiced amount per day"
          data={perDay(list.data ?? [])}
          x={{ value: (d) => d.day }}
          height={box.height}
          series={[
            {
              mark: 'bar',
              key: 'amount',
              label: 'Invoiced (EUR)',
              color: DEMO_SERIES.sessions,
              y: (d) => d.amount,
            },
          ]}
        />
      )}
    />
  )
}

function Receivables(): ReactElement {
  const stats = useQuery(receivablesQuery())
  return (
    <StatGroup variant="strip" label="Receivables">
      <StatCell
        phase={stats}
        title="Outstanding"
        value={stats.data?.outstanding ?? null}
        unit="EUR"
        sub="Polled every 5 s"
      />
      <StatCell
        phase={stats}
        title="Overdue"
        value={stats.data?.overdue ?? null}
        status={{ tone: 'bad', label: 'Past 30 days' }}
      />
    </StatGroup>
  )
}

const InvoiceSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'void']),
  reference: z
    .string()
    .trim()
    .regex(/^(SEPA-\d{5,})?$/, 'SEPA- and five digits or more, like SEPA-41017.'),
  disputed: z.boolean(),
  note: z.string().max(280, 'Keep the note under 280 characters.'),
})

const STATUS_OPTIONS = STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))
const valuesOf = ({ status, reference, disputed, note }: Invoice): InvoiceValues => ({
  status,
  reference,
  disputed,
  note,
})

function EditInvoiceForm({ invoice }: { invoice: Invoice }): ReactElement {
  const save = useMutation({
    mutationFn: (values: InvoiceValues) => invoicesApi.save(invoice.id, values),
    ...optimistic<InvoiceValues, Invoice>({
      key: ['invoices', 'save', invoice.id],
      targets: [
        {
          queryKey: invoiceQuery(invoice.id).queryKey,
          apply: (prev, values) => ({ ...prev, ...values }),
        },
      ],
    }),
    onSuccess: () => field.invoice.clear(),
  })
  const form = useForm({
    defaultValues: valuesOf(invoice),
    validationLogic: revalidateLogic({ mode: 'blur', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: InvoiceSchema,
      onSubmitAsync: toSubmitErrors((values: InvoiceValues) => save.mutateAsync(values)),
    },
  })
  const draft = useFormDraft(form, {
    key: `cycle-state-4-invoice:${invoice.id}`,
    version: 1,
    schema: InvoiceSchema,
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
        <form.Field name="status">
          {(f) => (
            <FormField label="Status" field={f}>
              <Select aria-label="Status" options={STATUS_OPTIONS} />
            </FormField>
          )}
        </form.Field>
        <FormRow>
          <form.Field name="reference">
            {(f) => (
              <FormField label="Payment reference" description="Needed once paid." field={f}>
                <Input autoComplete="off" />
              </FormField>
            )}
          </form.Field>
          <form.Field name="disputed">
            {(f) => (
              <FormField label="Disputed by the customer" field={f}>
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
            { label: 'Cancel', onClick: () => field.invoice.clear() },
            { label: 'Save', primary: true },
          ]}
        />
      </Fieldset>
    </Form>
  )
}

function EditInvoice({ id }: { id: string }): ReactElement {
  const invoice = useQuery(invoiceQuery(id))
  return (
    <QueryState phase={invoice}>
      {invoice.data === undefined ? null : <EditInvoiceForm invoice={invoice.data} />}
    </QueryState>
  )
}

function InvoicesBody(): ReactElement {
  const query = useInvoiceQuery()
  const list = useQuery(invoicesQuery(query))
  const { view } = invoices.useValues()
  const connection = useConnection()
  const freshness = useFreshness([['invoices']])

  return (
    <Page area="cycle-state-4-invoices">
      <PageBar
        title="Invoices"
        tabs={{ state: field.view, label: 'Invoices view' }}
        controls={FILTERS}
        connection={connection}
        refresh={{ scope: 'page', ...freshness.button }}
      />
      <Receivables />
      <Section title={view === 'table' ? 'All invoices' : 'Invoiced per day'}>
        {view === 'table' ? (
          <InvoicesTable list={list} query={query} />
        ) : (
          <InvoicesChart list={list} />
        )}
      </Section>
    </Page>
  )
}

/** "Somebody else" marks or clears a dispute every 20 s; the push feed is how this page learns of it. */
const ELSEWHERE_MS = 20_000

export function InvoicesPage(): ReactElement {
  useEffect(() => {
    // The stand-in for other users' edits: fixture, not glue.
    const timer = setInterval(() => invoicesApi.touchElsewhere(), ELSEWHERE_MS)
    return () => clearInterval(timer)
  }, [])
  return <InvoicesBody />
}
