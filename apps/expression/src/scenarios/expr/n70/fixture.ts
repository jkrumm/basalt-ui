/** Household events of one year: a seeded, fixed fixture, so every build and every shot reads the same rows. */

export type EventStatus = 'over' | 'waiting' | 'settled' | 'partial'

export type HouseholdEvent = {
  id: string
  name: string
  from: string
  to: string
  bookings: number
  paid: number
  reimbursed: number
}

/** The net a household keeps once reimbursements are in; one limit for every event. */
export const LIMIT = 300

export const EVENTS: readonly HouseholdEvent[] = [
  {
    id: 'ski',
    name: 'Ski trip',
    from: '2026-01-16',
    to: '2026-01-18',
    bookings: 7,
    paid: 1240,
    reimbursed: 760,
  },
  {
    id: 'easter',
    name: 'Easter',
    from: '2026-04-02',
    to: '2026-04-09',
    bookings: 14,
    paid: 1560,
    reimbursed: 1100,
  },
  {
    id: 'bike',
    name: 'Bike repair',
    from: '2026-05-11',
    to: '2026-05-11',
    bookings: 1,
    paid: 85,
    reimbursed: 0,
  },
  {
    id: 'garden',
    name: 'Garden party',
    from: '2026-06-20',
    to: '2026-06-20',
    bookings: 3,
    paid: 340,
    reimbursed: 340,
  },
  {
    id: 'camp',
    name: 'Camp',
    from: '2026-07-18',
    to: '2026-08-01',
    bookings: 11,
    paid: 3100,
    reimbursed: 700,
  },
  {
    id: 'gift',
    name: 'Gift',
    from: '2026-09-05',
    to: '2026-09-05',
    bookings: 2,
    paid: 150,
    reimbursed: 210,
  },
  {
    id: 'dinner',
    name: 'Dinner',
    from: '2026-10-10',
    to: '2026-10-10',
    bookings: 4,
    paid: 180,
    reimbursed: 0,
  },
  {
    id: 'cabin',
    name: 'Cabin',
    from: '2026-10-24',
    to: '2026-10-26',
    bookings: 6,
    paid: 620,
    reimbursed: 280,
  },
  {
    id: 'market',
    name: 'Market',
    from: '2026-12-05',
    to: '2026-12-06',
    bookings: 5,
    paid: 270,
    reimbursed: 100,
  },
]

/** Every event inside the limit and every one with some money back: the page at rest with nothing to chase. */
const QUIET: readonly HouseholdEvent[] = EVENTS.map((e) => {
  if (e.id === 'bike') return { ...e, reimbursed: 40 }
  if (e.id === 'dinner') return { ...e, reimbursed: 60 }
  if (e.id === 'ski') return { ...e, reimbursed: 960 }
  if (e.id === 'easter') return { ...e, reimbursed: 1300 }
  if (e.id === 'camp') return { ...e, reimbursed: 2900 }
  if (e.id === 'cabin') return { ...e, reimbursed: 340 }
  return e
})

const FIXTURES: Readonly<Record<string, readonly HouseholdEvent[]>> = {
  quiet: QUIET,
  single: EVENTS.filter((e) => e.id === 'bike'),
}

export const eventsFor = (fixture: string | undefined): readonly HouseholdEvent[] =>
  (fixture === undefined ? undefined : FIXTURES[fixture]) ?? EVENTS

export const netOf = (e: HouseholdEvent): number => e.paid - e.reimbursed

/** Over the limit wins; nothing reimbursed yet is waiting; net at or under zero is settled. */
export function statusOf(e: HouseholdEvent): EventStatus {
  if (netOf(e) > LIMIT) return 'over'
  if (e.reimbursed === 0) return 'waiting'
  return netOf(e) <= 0 ? 'settled' : 'partial'
}

export const backPctOf = (e: HouseholdEvent): number => Math.round((e.reimbursed / e.paid) * 100)
