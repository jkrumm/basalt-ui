import { createFileRoute } from '@tanstack/react-router'
import { Page, PageBar } from 'basalt-ui/page'
import { col, DataTable, useDataTable, useTableViews } from 'basalt-ui/table'
import type { TableLayoutSpec, TableLayoutView } from 'basalt-ui/table'
import { Button } from 'basalt-ui/ui/button'
import { CalendarRange } from 'lucide-react'
import { drag } from 'basalt-ui/ui/sortable-list'
import { useState } from 'react'
import type { ReactElement } from 'react'

type Stage = 'Lead' | 'Trial' | 'Customer' | 'Churned'
type Rating = 'excellent' | 'good' | 'normal' | 'poor'
type Account = {
  id: string
  name: string
  city: string
  rating: Rating
  owner: string
  stage: Stage
  arr: number
  since: string
  /** The chance the deal renews, 0 to 1. */
  odds: number
}

const NAMES = [
  'Northwind',
  'Contoso',
  'Fabrikam',
  'Tailspin',
  'Wingtip',
  'Litware',
  'Adatum',
  'Proseware',
  'Lucerne',
  'Woodgrove',
  'Coho',
  'Alpine',
]
const CITIES = ['Berlin', 'Lisbon', 'Austin', 'Osaka', 'Leeds', 'Lyon', 'Oslo', 'Porto']
const OWNERS = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson']
const STAGES: readonly Stage[] = ['Lead', 'Trial', 'Customer', 'Churned']
const RATINGS: readonly Rating[] = ['excellent', 'good', 'normal', 'poor']

const ACCOUNTS: Account[] = Array.from({ length: 24 }, (_, i) => ({
  id: `acc-${i + 1}`,
  name: `${NAMES[i % NAMES.length]}${i >= NAMES.length ? ' Labs' : ''}`,
  city: CITIES[(i * 5) % CITIES.length]!,
  rating: RATINGS[(i * 7) % RATINGS.length]!,
  owner: OWNERS[(i * 3) % OWNERS.length]!,
  stage: STAGES[(i * 5 + 1) % STAGES.length]!,
  arr: 4_800 + ((i * 7919) % 91_000),
  since: `202${3 + (i % 3)}-${String((i % 12) + 1).padStart(2, '0')}-1${i % 9}`,
  odds: ((i * 37) % 100) / 100,
}))

/**
 * A fifth layout from app code: the accounts in one lane per year they became customers. It draws
 * the rows the view shows (search, filters and sort hold) and opens one as a table row does.
 */
function YearLanes({ view }: { view: TableLayoutView<Account> }): ReactElement {
  const years = [...new Set(view.rows.map((a) => a.since.slice(0, 4)))].toSorted()
  return (
    <div data-slot="year-lanes" className="flex flex-wrap items-start gap-4">
      {years.map((year) => (
        <section
          key={year}
          aria-label={`Customers since ${year}`}
          className="flex min-w-40 flex-1 flex-col gap-1"
        >
          <span className="text-xs font-medium text-muted-foreground tabular-nums">{year}</span>
          {view.rows
            .filter((a) => a.since.startsWith(year))
            .map((a) => (
              <Button
                key={view.rowId(a)}
                variant="ghost"
                size="sm"
                className="justify-start"
                aria-current={view.activeId === view.rowId(a) ? 'true' : undefined}
                onClick={() => view.open(a)}
              >
                {a.name}
              </Button>
            ))}
        </section>
      ))}
    </div>
  )
}

const BY_YEAR: TableLayoutSpec<Account> = {
  id: 'by-year',
  label: 'By year',
  hint: 'Accounts in a lane per year they joined',
  icon: CalendarRange,
  render: (view) => <YearLanes view={view} />,
}

/** The account a commit refuses: its move on the board rolls back. */
const LOCKED = 'acc-3'

/** One record set as a table, a list, a board, a gallery or the app's own lanes, the layout saved with each view. */
function LayoutsRoute(): ReactElement {
  const [accounts, setAccounts] = useState(ACCOUNTS)
  const [archived, setArchived] = useState(0)
  const c = col<Account>()
  const t = useDataTable<Account>({
    id: 'kit-accounts',
    label: 'Accounts',
    columns: [
      c.entity('name', { header: 'Account', sub: (a) => a.city }),
      c.status('rating', {
        options: RATINGS,
        labels: { excellent: 'Excellent', good: 'Good', normal: 'Normal', poor: 'Poor' },
        tone: (r) =>
          r === 'excellent' ? 'good' : r === 'poor' ? 'bad' : r === 'good' ? 'info' : 'neutral',
      }),
      c.select('stage', {
        label: (a) => `Stage of ${a.name}`,
        options: STAGES,
        commit: (a, next) =>
          new Promise<void>((resolve, reject) => {
            setTimeout(() => {
              if (a.id === LOCKED) {
                reject(new Error('locked'))
                return
              }
              setAccounts((prev) =>
                prev.map((x) => (x.id === a.id ? { ...x, stage: next as Stage } : x)),
              )
              resolve()
            }, 300)
          }),
      }),
      c.person('owner'),
      c.money('arr', { header: 'Annual revenue', currency: 'USD', footer: 'sum' }),
      c.date('since', { header: 'Customer since' }),
      c.progress('odds', { header: 'Renewal odds', filter: 'range', footer: 'mean' }),
      c.custom('segment', {
        header: 'Segment',
        render: (a) => (a.arr >= 50_000 ? 'Enterprise' : 'Growth'),
        sortValue: (a) => a.arr,
        search: (a) => (a.arr >= 50_000 ? 'Enterprise' : 'Growth'),
        filter: 'text',
        card: 'meta',
        priority: 3,
      }),
    ],
    data: accounts,
    getRowId: (a) => a.id,
    mode: { kind: 'client' },
    layouts: ['table', 'list', 'board', 'gallery', BY_YEAR],
    selection: {
      bulk: [{ id: 'archive', label: 'Archive', onClick: (rows) => setArchived(rows.length) }],
    },
  })
  const views = useTableViews(t)
  return (
    <Page area="kit-layouts">
      <PageBar
        title="Accounts"
        tabs={views.tabs}
        search={views.search}
        controls={views.controls}
        layout={views.layout}
        settings={views.settings}
      />
      {views.chips}
      <div data-shot="accounts">
        <DataTable table={t} drag={drag} />
      </div>
      {archived > 0 && (
        <output className="text-xs text-muted-foreground">Archived {archived}</output>
      )}
      {views.panel}
    </Page>
  )
}

export const Route = createFileRoute('/kit/layouts')({
  staticData: { title: 'Layouts' },
  component: LayoutsRoute,
})
