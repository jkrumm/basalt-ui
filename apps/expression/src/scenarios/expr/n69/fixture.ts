/**
 * Fixture for expr-n69: five Claude accounts with their live use, their forecast to the weekly reset and
 * the weekly use at each of the last eight resets. Fixed clock and hand-authored values, so every shot
 * draws the same page; `?fixture=` names a variant of the same shape.
 */

/** Seats one account holds. */
export const SEAT_CAP = 10

export type Mode = 'normal' | 'fill-first' | 'held' | 'paused'

export type Account = {
  id: string
  name: string
  mode: Mode
  /** The one model a `held` account is kept for. */
  heldFor: string | null
  /** The 5-hour window, % used, and when it resets (ISO, UTC). */
  fiveHourUse: number
  fiveHourResetAt: string
  /** The weekly window, % used, and when it resets (ISO, UTC). */
  weekUse: number
  weekResetAt: string
  seatsTaken: number
  seatCap: number
  /** When the usage reading was taken. */
  readAt: string
  /** The forecast at the current pace: when the week fills, and the use it ends on. `null` is no forecast. */
  fullAt: string | null
  projectedAtReset: number | null
  /** Weekly use, %, at each of the last eight resets, oldest first. */
  useAtReset: readonly number[]
}

export type Snapshot = { now: string; accounts: readonly Account[] }

export const NOW = '2026-11-18T10:00:00Z'

const BASE: readonly Account[] = [
  {
    id: 'atlas',
    name: 'Atlas',
    mode: 'fill-first',
    heldFor: null,
    fiveHourUse: 24,
    fiveHourResetAt: '2026-11-18T12:10:00Z',
    weekUse: 47,
    weekResetAt: '2026-11-22T08:00:00Z',
    seatsTaken: 4,
    seatCap: 10,
    readAt: '2026-11-18T09:56:00Z',
    fullAt: null,
    projectedAtReset: 83,
    useAtReset: [88, 93, 85, 91, 62, 90, 87, 94],
  },
  {
    id: 'birch',
    name: 'Birch',
    mode: 'normal',
    heldFor: null,
    fiveHourUse: 82,
    fiveHourResetAt: '2026-11-18T13:40:00Z',
    weekUse: 71,
    weekResetAt: '2026-11-21T08:00:00Z',
    seatsTaken: 9,
    seatCap: 10,
    readAt: '2026-11-18T09:58:00Z',
    fullAt: '2026-11-20T14:00:00Z',
    projectedAtReset: 110,
    useAtReset: [97, 100, 94, 99, 96, 100, 98, 95],
  },
  {
    id: 'cobalt',
    name: 'Cobalt',
    mode: 'held',
    heldFor: 'Opus',
    fiveHourUse: 12,
    fiveHourResetAt: '2026-11-18T14:25:00Z',
    weekUse: 55,
    weekResetAt: '2026-11-23T06:00:00Z',
    seatsTaken: 3,
    seatCap: 10,
    readAt: '2026-11-18T09:55:00Z',
    fullAt: null,
    projectedAtReset: 76,
    useAtReset: [86, 89, 83, 91, 87, 90, 85, 88],
  },
  {
    id: 'drift',
    name: 'Drift',
    mode: 'paused',
    heldFor: null,
    fiveHourUse: 0,
    fiveHourResetAt: '2026-11-18T15:00:00Z',
    weekUse: 9,
    weekResetAt: '2026-11-22T20:00:00Z',
    seatsTaken: 0,
    seatCap: 10,
    readAt: '2026-11-18T09:57:00Z',
    fullAt: null,
    projectedAtReset: null,
    useAtReset: [89, 92, 85, 90, 88, 93, 87, 91],
  },
  {
    id: 'ember',
    name: 'Ember',
    mode: 'normal',
    heldFor: null,
    fiveHourUse: 40,
    fiveHourResetAt: '2026-11-18T11:00:00Z',
    weekUse: 63,
    weekResetAt: '2026-11-21T22:00:00Z',
    seatsTaken: 7,
    seatCap: 10,
    readAt: '2026-11-18T03:00:00Z',
    fullAt: null,
    projectedAtReset: null,
    useAtReset: [90, 86, 92, 88, 84, 93, 89, 91],
  },
]

const set = (id: string, patch: Partial<Account>) => (a: Account) =>
  a.id === id ? { ...a, ...patch } : a

/** Every account just reset: all zeros, nothing to forecast. */
const quiet = (): readonly Account[] =>
  BASE.map((a) => ({
    ...a,
    fiveHourUse: 0,
    weekUse: 0,
    seatsTaken: 0,
    fullAt: null,
    projectedAtReset: a.mode === 'paused' || a.id === 'ember' ? null : 0,
  }))

/** Birch is full on both windows with every seat taken; Drift left its whole last week unused. */
const extreme = (): readonly Account[] =>
  BASE.map(
    set('birch', {
      fiveHourUse: 100,
      weekUse: 100,
      seatsTaken: 10,
      fullAt: '2026-11-17T21:30:00Z',
      projectedAtReset: 100,
    }),
  ).map(set('drift', { useAtReset: [89, 92, 85, 90, 88, 93, 87, 0] }))

/** No account can take a lead: Atlas has no seat, Birch is full, Cobalt is held, Drift paused, Ember stale. */
const none = (): readonly Account[] =>
  BASE.map(set('atlas', { seatsTaken: 10 })).map(
    set('birch', { weekUse: 100, fullAt: '2026-11-17T21:30:00Z', projectedAtReset: 100 }),
  )

export function snapshotFor(fixture: string | undefined): Snapshot {
  if (fixture === 'quiet') return { now: NOW, accounts: quiet() }
  if (fixture === 'extreme') return { now: NOW, accounts: extreme() }
  if (fixture === 'none') return { now: NOW, accounts: none() }
  return { now: NOW, accounts: BASE }
}
