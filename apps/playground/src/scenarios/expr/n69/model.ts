/** What the page reads off a snapshot: who takes the next lead, who fills early and what each reset left unused. */
import type { Account, Snapshot } from './fixture'

/** A reading older than this is stale: its use and its forecast are not trusted. */
const STALE_AFTER_MS = 2 * 3_600_000

export type Route = 'next' | 'open' | 'fills' | 'closed' | 'stale'

export type Row = Account & {
  route: Route
  /** Hours since the reading, when stale. */
  readAgeH: number | null
}

/** A cell of the reset grid: one account at one reset; `next` is the forecast for the coming one. */
export type Cell = {
  id: string
  name: string
  col: string
  unused: number | null
  /** `full` fills before its reset, `none` has no forecast. */
  state: 'full' | 'none' | undefined
  fullAt: string | null
  /** Why a forecast is missing. */
  missing: 'paused' | 'stale' | null
}

export const NEXT_COL = 'next'
/** Column keys of the eight past resets, oldest first: `-8` is eight resets ago. */
export const PAST_COLS = [-8, -7, -6, -5, -4, -3, -2, -1].map(String)
export const COLS: readonly string[] = [...PAST_COLS, NEXT_COL]

const isStale = (a: Account, now: number) => now - Date.parse(a.readAt) > STALE_AFTER_MS
const isClosed = (a: Account) =>
  a.mode === 'paused' || a.mode === 'held' || a.seatsTaken >= a.seatCap || a.weekUse >= 100

/** Fill-first accounts take a lead first, then the one with the most week left; closed and stale accounts take none. */
export function routeRows(snapshot: Snapshot): readonly Row[] {
  const now = Date.parse(snapshot.now)
  const open = snapshot.accounts
    .filter((a) => !isClosed(a) && !isStale(a, now))
    .toSorted(
      (a, b) =>
        Number(b.mode === 'fill-first') - Number(a.mode === 'fill-first') || a.weekUse - b.weekUse,
    )
  const nextId = open[0]?.id
  return snapshot.accounts.map((a) => {
    const stale = isStale(a, now)
    const route: Route = stale
      ? 'stale'
      : isClosed(a)
        ? 'closed'
        : a.id === nextId
          ? 'next'
          : a.fullAt !== null
            ? 'fills'
            : 'open'
    return {
      ...a,
      route,
      readAgeH: stale ? Math.round((now - Date.parse(a.readAt)) / 3_600_000) : null,
    }
  })
}

/** Every account at every reset, row by row in reading order; the last column is the forecast. */
export function cellsOf(rows: readonly Row[]): readonly Cell[] {
  return rows.flatMap((r) => [
    ...r.useAtReset.map((use, i): Cell => ({
      id: r.id,
      name: r.name,
      col: PAST_COLS[i] ?? NEXT_COL,
      unused: 100 - use,
      state: undefined,
      fullAt: null,
      missing: null,
    })),
    nextCell(r),
  ])
}

function nextCell(r: Row): Cell {
  const base = { id: r.id, name: r.name, col: NEXT_COL, fullAt: r.fullAt }
  if (r.mode === 'paused') return { ...base, unused: null, state: 'none', missing: 'paused' }
  if (r.route === 'stale') return { ...base, unused: null, state: 'none', missing: 'stale' }
  if (r.fullAt !== null) return { ...base, unused: 0, state: 'full', missing: null }
  return {
    ...base,
    unused: Math.max(0, 100 - (r.projectedAtReset ?? r.weekUse)),
    state: undefined,
    missing: null,
  }
}

const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(xs.length, 1)

/** The share of each past reset's allowance left unused across the accounts, oldest first. */
export const fleetUnusedPerReset = (rows: readonly Row[]): readonly number[] =>
  PAST_COLS.map((_, i) => mean(rows.map((r) => 100 - (r.useAtReset[i] ?? 100))))

export const worstReset = (cells: readonly Cell[]): Cell | undefined =>
  cells
    .filter((c) => c.col !== NEXT_COL)
    .reduce<Cell | undefined>((w, c) => ((c.unused ?? 0) > (w?.unused ?? -1) ? c : w), undefined)

/** Resets that used the whole allowance, per account. */
export const fullResets = (r: Row): number => r.useAtReset.filter((u) => u >= 100).length
