/**
 * TablePerfPage — the fixture behind the `table-perf` evidence lane (`scripts/evidence/table-perf.ts`):
 * `BasaltDataTable` over 10 000 deterministic rows, sorting + global search on, pagination OFF, so
 * every row is in the DOM inside the table's own capped scroll container. Not a demo of anything —
 * the lane keys on `ROWS`, the `acct-0NNNN` names and the column headers below, so change them
 * together with the lane.
 */
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'

type Account = {
  id: number
  name: string
  region: string
  plan: string
  seats: number
  mrr: number
  signedUp: string
  status: string
}

const ROWS = 10_000
const REGIONS = ['us-east', 'eu-west', 'ap-south', 'sa-east', 'af-south']
const PLANS = ['free', 'team', 'business', 'enterprise']
const STATUSES = ['active', 'trial', 'churned', 'paused']
const DAY_MS = 86_400_000
const EPOCH_MS = Date.UTC(2024, 0, 1)

/** Seeded PRNG (mulberry32): the same 10 000 rows on every load, in every build. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildRows(): Account[] {
  const rand = mulberry32(0xba5a17)
  return Array.from({ length: ROWS }, (_, i) => ({
    id: i + 1,
    // 7919 is coprime with 10 000, so names are a permutation: unique, but not in row order.
    name: `acct-${String((i * 7919) % ROWS).padStart(5, '0')}`,
    region: REGIONS[Math.floor(rand() * REGIONS.length)]!,
    plan: PLANS[Math.floor(rand() * PLANS.length)]!,
    seats: 1 + Math.floor(rand() * 500),
    mrr: Math.round(rand() * 1_000_000) / 100,
    signedUp: new Date(EPOCH_MS + Math.floor(rand() * 900) * DAY_MS).toISOString().slice(0, 10),
    status: STATUSES[Math.floor(rand() * STATUSES.length)]!,
  }))
}

const DATA = buildRows()
const col = createColumnHelper<Account>()

const COLUMNS = [
  col.accessor('id', { header: 'ID', meta: { align: 'right' } }),
  col.accessor('name', { header: 'Name' }),
  col.accessor('region', { header: 'Region' }),
  col.accessor('plan', { header: 'Plan' }),
  col.accessor('seats', { header: 'Seats', meta: { align: 'right' } }),
  col.accessor('mrr', { header: 'MRR', meta: { align: 'right' } }),
  col.accessor('signedUp', { header: 'Signed up' }),
  col.accessor('status', { header: 'Status' }),
]

export function TablePerfPage() {
  return (
    <BasaltDataTable
      title="Accounts"
      data={DATA}
      columns={COLUMNS}
      enableSorting
      enableGlobalFilter
      stickyHeader
      maxHeight={600}
      minWidth={900}
    />
  )
}
