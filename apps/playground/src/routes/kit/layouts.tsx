import { createFileRoute } from '@tanstack/react-router'
import { Page, PageBar } from 'basalt-ui/page'
import { col, DataTable, TableToolbar, useDataTable, useTableViews } from 'basalt-ui/table'
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
}))

/** The account a commit refuses: its move on the board rolls back. */
const LOCKED = 'acc-3'

/** One record set as a table, a list, a board or a gallery, the layout saved with each view. */
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
      c.money('arr', { header: 'ARR', currency: 'USD', footer: 'sum' }),
      c.date('since', { header: 'Customer since' }),
    ],
    data: accounts,
    getRowId: (a) => a.id,
    mode: { kind: 'client' },
    layouts: ['table', 'list', 'board', 'gallery'],
    selection: {
      bulk: [{ id: 'archive', label: 'Archive', onClick: (rows) => setArchived(rows.length) }],
    },
  })
  const views = useTableViews(t)
  return (
    <Page area="kit-layouts" fill>
      <PageBar title="Accounts" tabs={views.tabs} layout={views.layout} settings={views.settings} />
      <TableToolbar table={t} views={false} />
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
