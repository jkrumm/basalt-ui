/**
 * c05 fixture: twelve vendor contracts read on a fixed "today". Dates are plain `YYYY-MM-DD`
 * strings; no clock is read. `default` holds a zero value (a free pilot), an extreme value
 * (a EUR 1.24M hosting contract) and a notice deadline that already passed. `crunch` pulls every
 * open notice deadline into the next seven weeks.
 */
export type Contract = {
  id: string
  vendor: string
  /** The day the term renews or ends. */
  renewal: string
  /** The last day to give notice. */
  notice: string
  autoRenew: boolean
  /** Annual value in EUR; 0 is a measurement (a free pilot). */
  value: number
}

export const TODAY = '2026-11-14'
/** The track covers the next twelve months. */
export const HORIZON_DAYS = 365
/** A notice this close is "soon". */
export const SOON_DAYS = 60

export const FIXTURE_NAMES = ['default', 'crunch'] as const
export type FixtureName = (typeof FIXTURE_NAMES)[number]

const DEFAULT: readonly Contract[] = [
  {
    id: 'c01',
    vendor: 'Northwind Logistics',
    notice: '2026-10-31',
    renewal: '2026-12-31',
    autoRenew: true,
    value: 184_000,
  },
  {
    id: 'c02',
    vendor: 'Helix Cloud Hosting',
    notice: '2026-11-26',
    renewal: '2027-01-01',
    autoRenew: true,
    value: 1_240_000,
  },
  {
    id: 'c03',
    vendor: 'Brightline Payroll',
    notice: '2026-12-05',
    renewal: '2027-01-15',
    autoRenew: false,
    value: 96_500,
  },
  {
    id: 'c04',
    vendor: 'Orchard Office Lease',
    notice: '2026-12-30',
    renewal: '2027-03-31',
    autoRenew: false,
    value: 412_000,
  },
  {
    id: 'c05',
    vendor: 'Veritas Audit Partners',
    notice: '2027-01-10',
    renewal: '2027-03-10',
    autoRenew: true,
    value: 58_000,
  },
  {
    id: 'c06',
    vendor: 'Kestrel Security',
    notice: '2027-02-01',
    renewal: '2027-04-01',
    autoRenew: true,
    value: 73_200,
  },
  {
    id: 'c07',
    vendor: 'Lumen Analytics Licences',
    notice: '2027-03-15',
    renewal: '2027-05-15',
    autoRenew: true,
    value: 31_800,
  },
  {
    id: 'c08',
    vendor: 'Atlas Translation Pilot',
    notice: '2027-04-01',
    renewal: '2027-06-01',
    autoRenew: true,
    value: 0,
  },
  {
    id: 'c09',
    vendor: 'Fernhill Insurance Broker',
    notice: '2027-05-20',
    renewal: '2027-07-20',
    autoRenew: false,
    value: 22_400,
  },
  {
    id: 'c10',
    vendor: 'Coastal Facilities',
    notice: '2027-07-01',
    renewal: '2027-09-01',
    autoRenew: true,
    value: 148_000,
  },
  {
    id: 'c11',
    vendor: 'Quill Legal Research',
    notice: '2027-08-15',
    renewal: '2027-10-15',
    autoRenew: false,
    value: 19_900,
  },
  {
    id: 'c12',
    vendor: 'Meridian Telecom',
    notice: '2027-09-30',
    renewal: '2027-11-12',
    autoRenew: true,
    value: 66_000,
  },
]

const DAY_MS = 86_400_000

/** Whole days since 1970-01-01 of a `YYYY-MM-DD` string, calendar-exact in any zone. */
export function dayNumber(iso: string): number {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

const isoOf = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10)

/** Every open notice lands 3 + 4i days out; the renewal keeps its gap to the notice. */
const CRUNCH: readonly Contract[] = DEFAULT.map((c, i) => {
  if (i === 0) return c
  const gap = dayNumber(c.renewal) - dayNumber(c.notice)
  const notice = dayNumber(TODAY) + 3 + 4 * i
  return { ...c, notice: isoOf(notice), renewal: isoOf(notice + gap) }
})

export const fixtureFor = (name: FixtureName): readonly Contract[] =>
  name === 'crunch' ? CRUNCH : DEFAULT
