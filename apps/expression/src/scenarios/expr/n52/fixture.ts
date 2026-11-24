/**
 * The household month as seeded data: this month's spending per day for the days gone, six
 * earlier months of daily spending (the usual pace is their per-day median of the running total),
 * the bills still due and one large one-off purchase. The same names give the same numbers.
 */
import type { CalendarDate } from 'basalt-ui'

export const DAYS_IN_MONTH = 30
export const TODAY = 19
export const PAYDAY = 25
export const CURRENCY = 'EUR'

export type Bill = { id: string; name: string; day: number; due: CalendarDate; amount: number }
export type OneOff = { name: string; day: number; amount: number }
/** One day of the month: running totals in euros, `null` where the line is not drawn. */
export type Day = {
  day: number
  date: CalendarDate
  /** What was spent that day. */
  daily: number | null
  spent: number | null
  usual: number
  /** The usual spending of that day: the step of the usual running total. */
  usualDaily: number
  committed: number | null
  oneOff: number | null
}
export type Month = {
  income: number
  days: readonly Day[]
  bills: readonly Bill[]
  oneOff: OneOff | null
}
export type Summary = {
  spent: number
  usual: number
  billsDue: number
  left: number
  /** Spent minus usual by today, without the one-off: negative is under the usual pace. */
  paceWithoutOneOff: number
  /** The mean spent per day so far, and what the usual pace spends on the same days. */
  perDay: number
  usualPerDay: number
  biggestDay: number
  emptyDays: number
}

const pad = (n: number): string => String(n).padStart(2, '0')
const isCalendarDate = (s: string): s is CalendarDate => /^\d{4}-\d{2}-\d{2}$/.test(s)

function dateOf(day: number): CalendarDate {
  const date = `2026-11-${pad(day)}`
  if (!isCalendarDate(date)) throw new Error(`bad day ${day}`)
  return date
}

/** mulberry32: a small seeded generator, so a fixture never changes between builds. */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** November 1 2026 is a Sunday. */
const isWeekend = (day: number): boolean => (day - 1) % 7 === 0 || (day - 1) % 7 === 6

const FIXED: Readonly<Record<number, number>> = { 1: 780, 3: 120 }
const BILLS: readonly Omit<Bill, 'due' | 'id'>[] = [
  { name: 'Phone', day: 21, amount: 39 },
  { name: 'Car insurance', day: 24, amount: 186 },
  { name: 'Electricity', day: 26, amount: 84 },
  { name: 'Childcare', day: 28, amount: 310 },
]

/** Daily spending of the six earlier months, bills included on their days. */
function history(): number[][] {
  const next = rng(52)
  return Array.from({ length: 6 }, () =>
    Array.from({ length: DAYS_IN_MONTH }, (_, i) => {
      const day = i + 1
      const bill = BILLS.find((b) => b.day === day)?.amount ?? 0
      const everyday = Math.round(28 + next() * 34 + (isWeekend(day) ? 24 : 0))
      return (FIXED[day] ?? 0) + bill + everyday
    }),
  )
}

const running = (xs: readonly number[]): number[] => {
  let sum = 0
  return xs.map((x) => (sum += x))
}

/** The middle of six running totals on each day of the month. */
function usualPace(): number[] {
  const totals = history().map(running)
  return Array.from({ length: DAYS_IN_MONTH }, (_, i) => {
    const sorted = totals.map((t) => t[i] ?? 0).sort((a, b) => a - b)
    return Math.round(((sorted[2] ?? 0) + (sorted[3] ?? 0)) / 2)
  })
}

type Variant = { income: number; oneOff: OneOff | null; bills: boolean; everyday: number }

const VARIANTS: Readonly<Record<string, Variant>> = {
  rest: {
    income: 4200,
    oneOff: { name: 'Washing machine', day: 11, amount: 890 },
    bills: true,
    everyday: 0.62,
  },
  /** A repair eats the month: the bills still due push the total past the income. */
  overdrawn: {
    income: 3100,
    oneOff: { name: 'Car repair', day: 12, amount: 1750 },
    bills: true,
    everyday: 0.8,
  },
  /** Nothing left to pay and a quiet month: spending under the usual pace, no one-off. */
  nobills: { income: 4200, oneOff: null, bills: false, everyday: 0.5 },
}

export function monthNamed(name: string | undefined): Month {
  const v = VARIANTS[name ?? 'rest'] ?? VARIANTS['rest']
  if (v === undefined) throw new Error('missing rest fixture')
  const usual = usualPace()
  const next = rng(2026)
  const daily = Array.from({ length: TODAY }, (_, i) => {
    const day = i + 1
    // Two weekdays with nothing spent: the running total stays flat there.
    if (day === 4 || day === 5) return 0
    const everyday = Math.round((28 + next() * 34 + (isWeekend(day) ? 24 : 0)) * v.everyday)
    return (FIXED[day] ?? 0) + everyday + (v.oneOff?.day === day ? v.oneOff.amount : 0)
  })
  const spent = running(daily)
  const bills: Bill[] = v.bills
    ? BILLS.map((b) => ({ ...b, id: `bill-${b.day}`, due: dateOf(b.day) }))
    : []
  const spentToday = spent[TODAY - 1] ?? 0
  const days = usual.map((u, i): Day => {
    const day = i + 1
    const paid = bills.filter((b) => b.day <= day).reduce((sum, b) => sum + b.amount, 0)
    return {
      day,
      date: dateOf(day),
      daily: day <= TODAY ? (daily[i] ?? 0) : null,
      spent: day <= TODAY ? (spent[i] ?? 0) : null,
      usual: u,
      usualDaily: u - (usual[i - 1] ?? 0),
      committed: day >= TODAY ? spentToday + paid : null,
      oneOff: v.oneOff?.day === day ? (spent[i] ?? 0) : null,
    }
  })
  return { income: v.income, days, bills, oneOff: v.oneOff }
}

export function summarize(month: Month): Summary {
  const today = month.days[TODAY - 1]
  const spent = today?.spent ?? 0
  const usual = today?.usual ?? 0
  const gone = month.days.flatMap((d) => (d.daily === null ? [] : [d.daily]))
  const billsDue = month.bills.reduce((sum, b) => sum + b.amount, 0)
  return {
    spent,
    usual,
    billsDue,
    left: month.income - spent - billsDue,
    paceWithoutOneOff: spent - (month.oneOff?.amount ?? 0) - usual,
    perDay: spent / TODAY,
    usualPerDay: usual / TODAY,
    biggestDay: Math.max(...gone),
    emptyDays: gone.filter((x) => x === 0).length,
  }
}
