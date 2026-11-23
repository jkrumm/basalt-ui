import { useFormat } from 'basalt-ui'
import { StatCell, StatGroup } from 'basalt-ui/cards'
import type { QueryStateLike } from 'basalt-ui/cards'
import { Page, PageBar } from 'basalt-ui/page'
import type { NavTarget } from 'basalt-ui/core/ports'
import { col, DataTable, useDataTable, useTableViews } from 'basalt-ui/table'
import type { TableState, View, ViewStore } from 'basalt-ui/table'
import { drag } from 'basalt-ui/ui/sortable-list'
import { PackagePlus, Upload } from 'lucide-react'
import { useState } from 'react'
import type { ReactElement } from 'react'
import {
  CATEGORY_LABELS,
  PLANS,
  STOCK,
  STOCK_LABELS,
  STOCK_TONE,
  TAG_LABELS,
  TAG_TONE,
} from './model'
import type { Part, Plan } from './model'

const c = col<Part>()

/** A saved view's state: the declared table with these filters, this grouping and this layout. */
const viewState = (
  filters: TableState['request']['filters'],
  display: Partial<TableState['display']> = {},
): TableState => ({
  v: 1,
  request: { q: '', filters, sort: [], page: 1, pageSize: 25 },
  display: { visibility: {}, ...display },
})

/** The views the team shares: the tabs of the view row, in this order. */
const SEEDED: View[] = [
  {
    id: 'reorder',
    name: 'To reorder',
    sharing: 'shared',
    state: viewState([{ id: 'plan', op: 'anyOf', values: ['Reorder'] }]),
  },
  {
    id: 'out',
    name: 'Out of stock',
    sharing: 'shared',
    state: viewState([{ id: 'stock', op: 'anyOf', values: ['out'] }]),
  },
  {
    id: 'by-category',
    name: 'By category',
    sharing: 'shared',
    state: viewState([], { groupBy: 'category' }),
  },
  {
    id: 'replenishment',
    name: 'Replenishment',
    sharing: 'shared',
    state: viewState([], { layout: 'board' }),
  },
  {
    id: 'catalogue',
    name: 'Catalogue',
    sharing: 'shared',
    state: viewState([], { layout: 'gallery' }),
  },
]

/** Whether a part passes a view's filters: the one predicate the tab counts read. */
const passes = (part: Part, view: View): boolean =>
  view.state.request.filters.every((f) => {
    const value = part[f.id as keyof Part]
    if (f.op !== 'anyOf') return true
    return Array.isArray(value)
      ? value.some((v) => f.values.includes(String(v)))
      : f.values.includes(String(value))
  })

/** The team's views, held in memory over the parts they count: a stand-in for the server that stores and counts them. */
export function createPartViews(parts: readonly Part[]): ViewStore {
  let views = SEEDED
  return {
    share: true,
    list: async () => views,
    save: async (_table, view) => {
      views = views.some((v) => v.id === view.id)
        ? views.map((v) => (v.id === view.id ? view : v))
        : [...views, view]
    },
    remove: async (_table, id) => {
      views = views.filter((v) => v.id !== id)
    },
    reorder: async (_table, ids) => {
      views = ids.flatMap((id) => views.filter((v) => v.id === id))
    },
    count: async (_table, view) => parts.filter((part) => passes(part, view)).length,
  }
}

export type ListPageProps = {
  /** The parts query state: its rows and its phase. */
  parts: QueryStateLike & { data?: readonly Part[] | undefined }
  /** The saved views, from `createPartViews`. */
  viewStore: ViewStore
  /** The reading time in ms: countdowns, relative times and the seven-day figure. */
  now: number
  /** Last month's readings the summary strip compares against. */
  baseline: { stockValue: number; deliveries: number }
  /** The link to a supplier's record. */
  supplierHref: (supplierId: string) => NavTarget
  /** Called with the part ids and the new plan on a replan edit or a bulk hold. */
  onReplan: (ids: ReadonlySet<string>, plan: Plan) => void
}

/**
 * The reference list page: one view row (saved views with counts; the table's search, filters, layout,
 * view settings and the one primary), a summary strip, and one grid of parts edge to edge on the work
 * surface; the same set as a board by replenishment and as a gallery.
 */
export function ListPage({
  parts: query,
  viewStore,
  now,
  baseline,
  supplierHref,
  onReplan,
}: ListPageProps): ReactElement {
  const f = useFormat()
  const parts = query.data
  const [last, setLast] = useState<string | null>(null)
  const t = useDataTable<Part>({
    id: 'ref-parts',
    label: 'Parts',
    columns: [
      c.entity('name', {
        header: 'Part',
        ref: (p) => p.sku,
      }),
      c.status('stock', {
        header: 'Stock',
        options: STOCK,
        labels: STOCK_LABELS,
        tone: (s) => STOCK_TONE[s],
        filter: 'multi',
      }),
      c.number('onHand', { header: 'On hand', unit: 'pcs' }),
      c.money('value', { header: 'Stock value', currency: 'EUR', footer: 'sum' }),
      c.countdown('nextDelivery', { header: 'Next delivery' }),
      c.select('plan', {
        header: 'Replenishment',
        label: (p) => `Replenishment of ${p.name}`,
        options: PLANS,
        filter: 'multi',
        commit: (p, next) => onReplan(new Set([p.id]), next as Plan),
      }),
      c.link('supplier', {
        header: 'Supplier',
        href: (p) => supplierHref(p.supplierId),
      }),
      c.person('buyer', { header: 'Buyer', filter: 'multi' }),
      c.tags('tags', {
        header: 'Tags',
        labels: TAG_LABELS,
        tone: (tag) => TAG_TONE[tag as keyof typeof TAG_TONE] ?? 'neutral',
        filter: 'multi',
      }),
      c.text('category', { header: 'Category', labels: CATEGORY_LABELS, priority: 3 }),
    ],
    data: parts,
    phase: query,
    bodyRows: 24,
    getRowId: (p) => p.id,
    mode: { kind: 'client' },
    now,
    look: 'grid',
    phone: 'cards',
    empty: { cause: 'No part matches this view. Clear its filters or open All rows.' },
    layouts: ['table', 'board', 'gallery'],
    views: { store: viewStore },
    selection: {
      bulk: [
        {
          id: 'order',
          label: 'Add to order',
          icon: PackagePlus,
          onClick: (rows) => setLast(`${rows.length} added to the draft order`),
        },
        {
          id: 'hold',
          label: 'Put on hold',
          onClick: (rows) => onReplan(new Set(rows.map((r) => r.id)), 'On hold'),
        },
      ],
    },
  })
  const views = useTableViews(t)

  // The figures read the loaded rows only: while the query is pending or failed each cell shows its phase.
  const all = parts ?? []
  const below = all.filter((p) => p.stock !== 'in-stock')
  const out = all.filter((p) => p.stock === 'out')
  const critical = out.filter((p) => p.tags.includes('critical')).length
  const week = all.filter((p) => Date.parse(p.nextDelivery) - now <= 7 * 86_400_000).length
  const onOrder = all.filter((p) => p.plan === 'On order').length
  const outOnOrder = out.filter((p) => p.plan === 'On order').length
  const stockValue = all.reduce((sum, p) => sum + p.value, 0)
  const ready = parts !== undefined

  return (
    <Page area="ref-parts" fill>
      <PageBar
        tabs={views.tabs}
        layout={views.layout}
        search={views.search}
        controls={views.controls}
        settings={views.settings}
        actions={[
          { id: 'import', label: 'Import', icon: Upload, onClick: () => setLast('Import opened') },
          {
            id: 'new',
            label: 'New part',
            icon: PackagePlus,
            primary: true,
            onClick: () => setLast('New part opened'),
          },
        ]}
      />
      <div data-shot="summary">
        <StatGroup variant="flush" label="Inventory">
          <StatCell
            label="Stock value"
            phase={query}
            value={ready ? f.money(stockValue, 'EUR', { maximumFractionDigits: 0 }) : null}
            delta={
              ready
                ? {
                    value: f.money(stockValue - baseline.stockValue, 'EUR', {
                      maximumFractionDigits: 0,
                      signDisplay: 'always',
                    }),
                    polarity: 'neutral',
                    label: 'vs 30 days ago',
                  }
                : undefined
            }
            sub={ready ? 'At unit cost' : undefined}
          />
          <StatCell
            label="Below reorder point"
            phase={query}
            value={ready ? below.length : null}
            meter={
              ready
                ? {
                    label: 'Parts below their reorder point',
                    value: below.length,
                    max: all.length,
                    caption: `of ${all.length} parts`,
                  }
                : undefined
            }
            sub={ready ? `${below.length - out.length} low, ${out.length} out` : undefined}
          />
          <StatCell
            label="Out of stock"
            phase={query}
            value={ready ? out.length : null}
            status={
              ready
                ? critical > 0
                  ? { tone: 'bad', label: `${critical} critical` }
                  : { tone: 'good', label: 'None critical' }
                : undefined
            }
            sub={ready ? `${outOnOrder} already on order` : undefined}
          />
          <StatCell
            label="Deliveries in 7 days"
            phase={query}
            value={ready ? week : null}
            delta={
              ready
                ? {
                    value: `${week - baseline.deliveries >= 0 ? '+' : ''}${week - baseline.deliveries}`,
                    polarity: 'neutral',
                    label: 'vs the 7 days before',
                  }
                : undefined
            }
            sub={ready ? `${onOrder} parts on order` : undefined}
          />
        </StatGroup>
      </div>
      {views.chips}
      <div data-shot="parts" className="flex min-h-0 flex-1 flex-col">
        <DataTable table={t} drag={drag} />
      </div>
      {last !== null && <output className="sr-only">{last}</output>}
      {views.panel}
    </Page>
  )
}
