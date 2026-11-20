/**
 * The plan of one project, as the factory owner reads it: rows that wait on other rows. Authored and
 * seeded (no clock, no random), so a shot is the same shot. The default fixture holds one blocked row
 * with five rows behind it, three rows with no Issue yet and one open row that holds back the most.
 * `?fixture=clear` has no blocked row; `?fixture=stalled` has no row that can start.
 */

export type PlanState = 'done' | 'open' | 'waiting' | 'blocked'
/** What a row shows: the one open row that should start next reads `next`. */
export type Shown = PlanState | 'next'

export type PlanRow = {
  key: string
  title: string
  state: PlanState
  /** Keys of the rows this one waits on. */
  waitsOn: readonly string[]
  /** UTC midnight, epoch ms; `null` while the row has no Issue yet. */
  filed: number | null
  closed: number | null
}

export type PlanView = PlanRow & {
  /** Rows that wait on this one, directly or through other rows. */
  behind: number
  /** Whole days from filing to closing, or to today while the row is open; `null` with no Issue. */
  days: number | null
  shown: Shown
  /** The key, with the missing Issue named. */
  sub: string
}

const DAY = 86_400_000
/** The fixture's today, so ages never read the clock. */
const TODAY = Date.UTC(2026, 10, 19)
const START = Date.UTC(2026, 8, 21)

type Spec = readonly [
  key: string,
  title: string,
  state: PlanState,
  waitsOn: readonly string[],
  noIssue?: true,
]

const SPECS: readonly Spec[] = [
  ['schema', 'Draft the ledger schema', 'done', []],
  ['adr', 'Record the storage decision', 'done', []],
  ['envs', 'Provision staging and prod', 'done', []],
  ['migrate', 'Migration runner', 'done', ['schema']],
  ['api-spec', 'Write the API contract', 'done', ['schema', 'adr']],
  ['ci', 'CI pipeline', 'done', ['envs']],
  ['authz', 'Choose the auth scheme', 'done', ['adr']],
  ['obs', 'Metrics and tracing', 'done', ['envs']],
  ['entry-model', 'Ledger entry model', 'done', ['schema', 'migrate']],
  ['acct-model', 'Account model', 'done', ['schema', 'migrate']],
  ['api-stub', 'Generate the API stub', 'done', ['api-spec', 'ci']],
  ['auth-mw', 'Auth middleware', 'done', ['authz', 'ci']],
  ['dashboards', 'Service dashboards', 'done', ['obs']],
  ['entries-api', 'Entries endpoints', 'done', ['entry-model', 'api-stub', 'auth-mw']],
  ['accounts-api', 'Accounts endpoints', 'done', ['acct-model', 'api-stub', 'auth-mw']],
  ['alerts', 'Alert rules', 'done', ['dashboards']],
  ['backup', 'Nightly backups', 'done', ['envs', 'migrate']],
  ['backfill', 'Backfill legacy entries', 'blocked', ['entry-model', 'acct-model']],
  ['reconcile', 'Reconcile backfilled balances', 'waiting', ['backfill']],
  ['audit', 'Audit trail export', 'waiting', ['backfill', 'entries-api']],
  ['monthly', 'Monthly ledger report', 'waiting', ['reconcile']],
  ['rehearsal', 'Cutover rehearsal', 'waiting', ['backfill']],
  ['legacy-off', 'Switch off the legacy ledger', 'waiting', ['rehearsal', 'audit'], true],
  ['idem', 'Idempotency keys', 'open', ['entries-api']],
  ['rate-limit', 'Rate limits per account', 'open', ['auth-mw', 'api-stub']],
  ['pagination', 'Cursor pagination', 'open', ['entries-api', 'accounts-api']],
  ['multi-ccy', 'Multi-currency amounts', 'open', ['entry-model']],
  ['retention', 'Retention policy', 'open', ['adr']],
  ['sec-scope', 'Security review scope', 'open', ['authz']],
  ['webhooks', 'Webhook delivery', 'waiting', ['idem', 'alerts']],
  ['refunds', 'Refund flow', 'waiting', ['idem', 'accounts-api']],
  ['fx', 'FX rate feed', 'waiting', ['multi-ccy']],
  ['sdk-ts', 'TypeScript client', 'waiting', ['pagination', 'api-spec']],
  ['sdk-py', 'Python client', 'waiting', ['pagination', 'sdk-ts'], true],
  ['docs', 'API reference docs', 'waiting', ['api-spec', 'pagination']],
  ['load-test', 'Load test the endpoints', 'waiting', ['rate-limit', 'entries-api', 'pagination']],
  ['sandbox', 'Customer sandbox', 'waiting', ['rate-limit', 'envs', 'pagination'], true],
  ['statements', 'Customer statements', 'waiting', ['refunds', 'webhooks', 'fx']],
  ['pen-test', 'Penetration test', 'waiting', ['sec-scope', 'rate-limit']],
  [
    'beta',
    'Invite beta customers',
    'waiting',
    ['sandbox', 'sdk-ts', 'load-test', 'docs', 'pen-test'],
  ],
]

/** mulberry32: a fixed seed gives the same dates on every run. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function build(): readonly PlanRow[] {
  const rand = seeded(53)
  const closedOf = new Map<string, number>()
  const doneCount = SPECS.filter((s) => s[2] === 'done').length
  let doneIndex = 0
  return SPECS.map(([key, title, state, waitsOn, noIssue]): PlanRow => {
    if (state === 'done') {
      const planned =
        START + (3 + Math.round((doneIndex / (doneCount - 1)) * 53) + Math.floor(rand() * 3)) * DAY
      const after = Math.max(0, ...waitsOn.map((k) => (closedOf.get(k) ?? 0) + DAY))
      const closed = Math.min(Math.max(planned, after), TODAY - DAY)
      const filed = closed - (2 + Math.floor(rand() * 7)) * DAY
      closedOf.set(key, closed)
      doneIndex += 1
      return { key, title, state, waitsOn, filed, closed }
    }
    if (noIssue) return { key, title, state, waitsOn, filed: null, closed: null }
    const age =
      key === 'backfill'
        ? 34
        : state === 'open'
          ? 5 + Math.floor(rand() * 14)
          : 4 + Math.floor(rand() * 20)
    return { key, title, state, waitsOn, filed: TODAY - age * DAY, closed: null }
  })
}

const BASE = build()

/** The default plan, or a variant the `?fixture=` param names. */
export function planFor(fixture: string | undefined): readonly PlanRow[] {
  if (fixture === 'clear')
    return BASE.map((r) => (r.state === 'blocked' ? { ...r, state: 'open' } : r))
  if (fixture === 'stalled') {
    return BASE.map((r) =>
      r.state === 'open' ? { ...r, state: 'waiting', waitsOn: [...r.waitsOn, 'backfill'] } : r,
    )
  }
  return BASE
}

/** Every row with what it holds back, its age and what it shows; the open row that holds back the most reads `next`. */
export function derive(rows: readonly PlanRow[]): readonly PlanView[] {
  const dependents = new Map<string, string[]>()
  for (const r of rows)
    for (const k of r.waitsOn) dependents.set(k, [...(dependents.get(k) ?? []), r.key])
  const behindOf = (key: string): number => {
    const seen = new Set<string>()
    const walk = (k: string): void => {
      for (const d of dependents.get(k) ?? []) {
        if (seen.has(d)) continue
        seen.add(d)
        walk(d)
      }
    }
    walk(key)
    return seen.size
  }
  const withBehind = rows.map((r) => ({ r, behind: behindOf(r.key) }))
  const next = withBehind
    .filter((x) => x.r.state === 'open')
    .sort((a, b) => b.behind - a.behind || (a.r.filed ?? 0) - (b.r.filed ?? 0))[0]
  return withBehind.map(({ r, behind }) => ({
    ...r,
    behind,
    days: r.filed === null ? null : Math.round(((r.closed ?? TODAY) - r.filed) / DAY),
    shown: r.key === next?.r.key ? 'next' : r.state,
    sub: r.filed === null ? `${r.key} · no Issue yet` : r.key,
  }))
}

export type Summary = {
  total: number
  done: number
  blocked: readonly PlanView[]
  ready: readonly PlanView[]
  next: PlanView | undefined
  noIssue: number
  closedWeek: number
  closedBefore: number
  lastClosed: number | null
  /** Rows in the longest run of unfinished rows that wait on one another. */
  chainLeft: number
}

export function summarize(rows: readonly PlanView[]): Summary {
  const byKey = new Map(rows.map((r) => [r.key, r]))
  const depth = new Map<string, number>()
  const chainOf = (r: PlanView): number => {
    const known = depth.get(r.key)
    if (known !== undefined) return known
    const below = r.waitsOn
      .map((k) => byKey.get(k))
      .filter((b) => b !== undefined && b.state !== 'done')
    const d = 1 + Math.max(0, ...below.map((b) => (b === undefined ? 0 : chainOf(b))))
    depth.set(r.key, d)
    return d
  }
  const open = rows.filter((r) => r.state !== 'done')
  const closedAt = rows.flatMap((r) => (r.closed === null ? [] : [r.closed]))
  return {
    total: rows.length,
    done: rows.length - open.length,
    blocked: open.filter((r) => r.state === 'blocked').sort((a, b) => b.behind - a.behind),
    ready: open.filter((r) => r.state === 'open'),
    next: rows.find((r) => r.shown === 'next'),
    noIssue: rows.filter((r) => r.filed === null).length,
    closedWeek: closedAt.filter((t) => t > TODAY - 7 * DAY).length,
    closedBefore: closedAt.filter((t) => t > TODAY - 14 * DAY && t <= TODAY - 7 * DAY).length,
    lastClosed: closedAt.length === 0 ? null : Math.max(...closedAt),
    chainLeft: Math.max(0, ...open.map(chainOf)),
  }
}
