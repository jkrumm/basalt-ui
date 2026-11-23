import { useFormat } from 'basalt-ui'
import type { Format } from 'basalt-ui'
import { EventList, RelationshipCard } from 'basalt-ui/cards'
import type { QueryStateLike } from 'basalt-ui/cards'
import { CardGrid, EmptyState, Page, PageBar, PropertyList, Section } from 'basalt-ui/page'
import type { NavTarget } from 'basalt-ui/core/ports'
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { Lozenge } from 'basalt-ui/ui/badge'
import { Card } from 'basalt-ui/ui/card'
import {
  Factory,
  Mail,
  Package,
  Pencil,
  Phone,
  Plus,
  StickyNote,
  TriangleAlert,
  Truck,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import {
  CATEGORY_LABELS,
  NOTE_TYPE_LABELS,
  ORDER_LABELS,
  ORDER_STATES,
  ORDER_TONE,
  RATING_LABELS,
  RATING_TONE,
  STOCK,
  STOCK_LABELS,
  STOCK_TONE,
} from './model'
import type { Note, NoteType, Order, Part, Supplier, SupplierRecords } from './model'

const TABS = ['overview', 'activity', 'orders', 'parts', 'notes'] as const

/** The record's tab and the create flow are fields: a link opens either, Back walks the tabs. The route wires it. */
export const recordControls = defineControls({
  id: 'ref-supplier',
  scope: 'page',
  fields: {
    tab: field.enum(TABS, 'overview', { history: 'push' }).labels({
      overview: 'Overview',
      activity: 'Activity',
      orders: 'Orders',
      parts: 'Parts',
      notes: 'Notes',
    }),
    order: field.boolean(false),
  },
})

const NOTE_ICONS: Record<NoteType, typeof Phone> = {
  call: Phone,
  meeting: Users,
  quality: TriangleAlert,
  email: Mail,
  memo: StickyNote,
}

const TERMS = ['Net 30', 'Net 45', 'Net 60', 'Letter of credit'].map((value) => ({
  value,
  label: value,
}))

const percent = (share: number): string => `${Math.round(share * 100)} %`
const isOpen = (o: Order): boolean => o.state !== 'received'

const oc = col<Order>()
const pc = col<Part>()
const nc = col<Note>()

type Related<T> = { rows: readonly T[] | undefined; phase: QueryStateLike }

function OrdersTable({
  rows,
  phase,
  id,
  now,
  compact = false,
}: Related<Order> & { id: string; now: number; compact?: boolean }): ReactElement {
  const t = useDataTable<Order>({
    id,
    label: 'Purchase orders',
    columns: [
      oc.entity('number', { header: 'Order', mono: true }),
      oc.status('state', {
        header: 'State',
        options: ORDER_STATES,
        labels: ORDER_LABELS,
        tone: (s) => ORDER_TONE[s],
      }),
      oc.countdown('due', { header: 'Due' }),
      ...(compact
        ? []
        : [
            oc.person('buyer', { header: 'Buyer' }),
            oc.date('ordered', { header: 'Ordered', priority: 2 }),
            oc.number('lines', { header: 'Lines', priority: 3 }),
          ]),
      oc.money('total', {
        header: 'Total',
        currency: 'EUR',
        ...(compact ? {} : { footer: 'sum' as const }),
      }),
    ],
    data: rows,
    phase,
    getRowId: (o) => o.id,
    mode: { kind: 'client' },
    now,
    empty: { cause: 'No open orders with this supplier. New order starts one.' },
  })
  return <DataTable table={t} />
}

function PartsTable({ rows, phase, now }: Related<Part> & { now: number }): ReactElement {
  const t = useDataTable<Part>({
    id: 'ref-supplier-parts',
    label: 'Parts supplied',
    columns: [
      pc.entity('name', { header: 'Part', ref: (p) => p.sku }),
      pc.status('stock', {
        header: 'Stock',
        options: STOCK,
        labels: STOCK_LABELS,
        tone: (s) => STOCK_TONE[s],
      }),
      pc.number('onHand', { header: 'On hand', unit: 'pcs' }),
      pc.countdown('nextDelivery', { header: 'Next delivery' }),
      pc.money('value', { header: 'Stock value', currency: 'EUR', footer: 'sum' }),
    ],
    data: rows,
    phase,
    getRowId: (p) => p.id,
    mode: { kind: 'client' },
    now,
  })
  return <DataTable table={t} />
}

function NotesTable({ rows, phase, now }: Related<Note> & { now: number }): ReactElement {
  const t = useDataTable<Note>({
    id: 'ref-supplier-notes',
    label: 'Notes',
    columns: [
      nc.title('title', { header: 'Note', type: (n) => n.type, icons: NOTE_ICONS }),
      nc.text('body', { header: 'Preview', quiet: true }),
      nc.person('author', { header: 'Author' }),
      nc.relativeTime('updated', { header: 'Updated' }),
    ],
    data: rows,
    phase,
    getRowId: (n) => n.id,
    mode: { kind: 'client' },
    now,
  })
  return <DataTable table={t} />
}

/** What happened with the supplier, newest first: orders placed and received, and notes written. */
function activityOf(f: Format, orders: readonly Order[], notes: readonly Note[], now: number) {
  const placed = orders.map((o) => ({
    id: `${o.id}-placed`,
    at: Date.parse(o.ordered) + 10 * 3_600_000,
    actor: { name: o.buyer },
    title: `placed ${o.number}`,
    body: `${o.lines} ${o.lines === 1 ? 'line' : 'lines'}, due ${f.date(Date.parse(o.due))}`,
    icon: Plus,
  }))
  const received = orders
    .filter((o) => o.state === 'received')
    .map((o) => ({
      id: `${o.id}-received`,
      at: Date.parse(o.due) + 14 * 3_600_000,
      actor: { name: 'Goods in', shape: 'object' as const, icon: Truck },
      title: `received ${o.number}`,
      icon: Truck,
    }))
  const written = notes.map((n) => ({
    id: n.id,
    at: Date.parse(n.updated),
    actor: { name: n.author },
    title: n.title,
    chips: [NOTE_TYPE_LABELS[n.type], n.part],
    icon: NOTE_ICONS[n.type],
  }))
  return [...placed, ...received, ...written]
    .filter((e) => e.at <= now)
    .toSorted((a, b) => b.at - a.at)
}

/** The parts that tie most stock value to this supplier, each a relationship card that opens its record. */
function RelatedParts({
  parts,
  partHref,
}: {
  parts: readonly Part[] | undefined
  partHref: (partId: string) => NavTarget
}): ReactElement {
  const f = useFormat()
  const top = (parts ?? []).toSorted((a, b) => b.value - a.value).slice(0, 4)
  if (top.length === 0) return <p className="m-0 text-sm text-muted-foreground">No parts yet.</p>
  return (
    <CardGrid>
      {top.map((p) => (
        <RelationshipCard
          key={p.id}
          title={p.name}
          subtitle={p.sku}
          avatar={{ shape: 'object', icon: Package }}
          relation={CATEGORY_LABELS[p.category]}
          facts={[
            { label: 'On hand', value: `${f.number(p.onHand)} pcs` },
            { label: 'Stock value', value: f.money(p.value, 'EUR') },
            { label: 'Delivery', value: f.date(Date.parse(p.nextDelivery), 'day') },
          ]}
          href={partHref(p.id)}
        />
      ))}
    </CardGrid>
  )
}

function Overview({
  supplier,
  records,
  edit,
  now,
  partHref,
}: {
  supplier: Supplier
  records: QueryStateLike & { data?: SupplierRecords | undefined }
  edit: (change: Partial<Supplier>) => void
  now: number
  partHref: (partId: string) => NavTarget
}): ReactElement {
  const f = useFormat()
  const open = records.data?.orders.filter(isOpen)
  return (
    <div className="grid gap-4 @wide:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 @wide:col-span-2">
        <Card>
          <PropertyList
            rows={[
              {
                id: 'contact',
                kind: 'text',
                label: 'Contact',
                value: supplier.contact,
                autoComplete: 'name',
                onCommit: (contact) => {
                  edit({ contact })
                },
              },
              {
                id: 'role',
                kind: 'text',
                label: 'Role',
                value: supplier.contactRole,
                autoComplete: 'organization-title',
                onCommit: (contactRole) => {
                  edit({ contactRole })
                },
              },
              {
                id: 'domain',
                kind: 'text',
                label: 'Website',
                value: supplier.domain,
                type: 'url',
                inputMode: 'url',
                autoComplete: 'url',
                onCommit: (domain) => {
                  edit({ domain })
                },
              },
              {
                id: 'email',
                kind: 'text',
                label: 'Email',
                value: supplier.email,
                type: 'email',
                inputMode: 'email',
                autoComplete: 'email',
                validate: (next) => (next.includes('@') ? undefined : 'Error: an email has an @.'),
                onCommit: (email) => {
                  edit({ email })
                },
              },
              {
                id: 'phone',
                kind: 'text',
                label: 'Phone',
                value: supplier.phone,
                type: 'tel',
                inputMode: 'tel',
                autoComplete: 'tel',
                onCommit: (phone) => {
                  edit({ phone })
                },
              },
              {
                id: 'lead',
                kind: 'number',
                label: 'Quoted lead time',
                value: supplier.leadDays,
                unit: 'days',
                min: 0,
                max: 365,
                onCommit: (leadDays) => {
                  edit({ leadDays })
                },
              },
              { id: 'on-time', label: 'On time, 12 months', value: percent(supplier.onTime) },
              {
                id: 'terms',
                kind: 'select',
                label: 'Payment terms',
                value: supplier.terms,
                options: TERMS,
                onCommit: (terms) => {
                  edit({ terms })
                },
              },
              { id: 'since', label: 'Supplier since', value: f.date(Date.parse(supplier.since)) },
              { id: 'currency', label: 'Quoted currency', value: 'EUR' },
            ]}
          />
        </Card>
        <Section title="Open orders" summary="Placed and not yet received in full">
          <OrdersTable rows={open} phase={records} id="ref-supplier-open" now={now} compact />
        </Section>
      </div>
      <Section
        title="Parts supplied"
        {...(records.data !== undefined && {
          summary: `${Math.min(4, records.data.parts.length)} of ${records.data.parts.length} by stock value`,
        })}
      >
        <RelatedParts parts={records.data?.parts} partHref={partHref} />
      </Section>
    </div>
  )
}

/** The create flow the record opens: the caller renders it with the record's supplier and dialog state. */
export type NewOrderSlot = {
  supplier: Supplier
  open: boolean
  onOpenChange: (open: boolean) => void
}

export type RecordPageProps = {
  /** The supplier id the route opened. */
  id: string
  /** The supplier record, or undefined when no supplier has the id. */
  supplier: Supplier | undefined
  /** The supplier's related records: its orders, parts and notes. */
  records: QueryStateLike & { data?: SupplierRecords | undefined }
  /** The reading time in ms, for the countdowns, the relative times and the activity feed. */
  now: number
  /** The parts list link, the PageBar parent. */
  partsHref: NavTarget
  /** This record's own link, the favourite target. */
  recordHref: NavTarget
  /** The link to a part's record. */
  partHref: (partId: string) => NavTarget
  /** Renders the create flow over the page; it receives the dialog state the page owns. */
  newOrder: (dialog: NewOrderSlot) => ReactNode
}

/**
 * The reference record page: the supplier's identity and properties, tabs with counts over its
 * related records, an activity feed, and New order, which opens the create flow over the page.
 */
export function RecordPage({
  id,
  supplier,
  records,
  now,
  partsHref,
  recordHref,
  partHref,
  newOrder,
}: RecordPageProps): ReactElement {
  // The demo has no server: an edit lives in the page, per supplier, over the one the inventory holds.
  const [edits, setEdits] = useState<Readonly<Record<string, Partial<Supplier>>>>({})
  const record = supplier === undefined ? undefined : { ...supplier, ...edits[id] }
  const [tab] = recordControls.field.tab.use()
  const [ordering, setOrdering] = recordControls.field.order.use()
  const related = records.data
  const f = useFormat()
  const activity = related === undefined ? [] : activityOf(f, related.orders, related.notes, now)
  const parent = { label: 'Parts', href: partsHref }
  if (record === undefined) {
    return (
      <Page area="ref-supplier">
        <PageBar title="Supplier" parent={parent} />
        <EmptyState cause={`No supplier has the id ${id}.`} />
      </Page>
    )
  }
  return (
    <Page area="ref-supplier">
      <PageBar
        title={record.name}
        identity={{
          avatar: { shape: 'object', icon: Factory },
          subtitle: `${record.city}, ${record.country}`,
          tags: <Lozenge tone={RATING_TONE[record.rating]}>{RATING_LABELS[record.rating]}</Lozenge>,
        }}
        parent={parent}
        favourite={{
          id: `supplier-${id}`,
          label: record.name,
          icon: Factory,
          target: recordHref,
        }}
        tabs={{
          state: recordControls.field.tab,
          label: 'Supplier',
          badges:
            related === undefined
              ? {}
              : {
                  activity: { count: activity.length },
                  orders: { count: related.orders.length },
                  parts: {
                    count: related.parts.length,
                  },
                  notes: { count: related.notes.length },
                },
        }}
        actions={[
          { id: 'email', label: 'Email contact', icon: Mail, onClick: () => undefined },
          { id: 'edit', label: 'Edit', icon: Pencil, onClick: () => undefined },
          {
            id: 'order',
            label: 'New order',
            icon: Plus,
            primary: true,
            onClick: () => setOrdering(true),
          },
        ]}
      />
      {tab === 'overview' && (
        <Overview
          supplier={record}
          records={records}
          now={now}
          partHref={partHref}
          edit={(change) => {
            setEdits((previous) => ({ ...previous, [id]: { ...previous[id], ...change } }))
          }}
        />
      )}
      {tab === 'activity' && (
        <EventList
          title="Activity"
          phase={records}
          items={activity}
          group="period"
          bodyRows={14}
          pageSize={30}
          now={now}
        />
      )}
      {tab === 'orders' && (
        <OrdersTable rows={related?.orders} phase={records} id="ref-supplier-orders" now={now} />
      )}
      {tab === 'parts' && <PartsTable rows={related?.parts} phase={records} now={now} />}
      {tab === 'notes' && <NotesTable rows={related?.notes} phase={records} now={now} />}
      {newOrder({
        supplier: record,
        open: ordering,
        onOpenChange: (next) => (next ? setOrdering(true) : recordControls.field.order.clear()),
      })}
    </Page>
  )
}
