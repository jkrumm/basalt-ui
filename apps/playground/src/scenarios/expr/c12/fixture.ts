/** Daily AI gateway cost per model for 14 days, seeded and deterministic. Today is the last day and partial. */
import type { CalendarDate } from 'basalt-ui'

export type ModelId = 'orion-max' | 'orion-mini' | 'vela-code' | 'lyra-embed'
export type Costs = Record<ModelId, number>
export type Day = { date: CalendarDate; costs: Costs }
export type SpendFixture = {
  days: readonly Day[]
  /** USD for the calendar week that contains today. */
  budget: number
  weekStart: CalendarDate
  /** Hours of today that have passed: the last day holds only these. */
  hoursElapsed: number
}

export const MODELS: readonly { id: ModelId; name: string }[] = [
  { id: 'orion-max', name: 'Orion Max' },
  { id: 'orion-mini', name: 'Orion Mini' },
  { id: 'vela-code', name: 'Vela Code' },
  { id: 'lyra-embed', name: 'Lyra Embed' },
]

const WEEKDAY: Costs = { 'orion-max': 58, 'orion-mini': 24, 'vela-code': 16, 'lyra-embed': 8 }
/** Share of a weekday's cost a Saturday or Sunday keeps: the coding and embedding jobs stop. */
const WEEKEND: Costs = { 'orion-max': 0.2, 'orion-mini': 0.3, 'vela-code': 0, 'lyra-embed': 0 }

const FIRST_DAY = Date.UTC(2026, 10, 6)
const DAY_MS = 86_400_000
const BUDGET = 700
const WEEK_START: CalendarDate = '2026-11-16'
const HOURS_ELAPSED = 14.4

const isCalendarDate = (s: string): s is CalendarDate => /^\d{4}-\d{2}-\d{2}$/.test(s)

function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cents = (n: number): number => Math.round(n * 100) / 100
const mapCosts = (c: Costs, f: (v: number, id: ModelId) => number): Costs => ({
  'orion-max': f(c['orion-max'], 'orion-max'),
  'orion-mini': f(c['orion-mini'], 'orion-mini'),
  'vela-code': f(c['vela-code'], 'vela-code'),
  'lyra-embed': f(c['lyra-embed'], 'lyra-embed'),
})

function baseDays(hoursElapsed: number): Day[] {
  const rand = seeded(1212)
  return Array.from({ length: 14 }, (_, i) => {
    const at = new Date(FIRST_DAY + i * DAY_MS)
    const iso = at.toISOString().slice(0, 10)
    const date = isCalendarDate(iso) ? iso : WEEK_START
    const weekend = at.getUTCDay() === 0 || at.getUTCDay() === 6
    const today = i === 13
    const costs = mapCosts(WEEKDAY, (v, id) => {
      const day = v * (weekend ? WEEKEND[id] : 1) * (0.88 + rand() * 0.24)
      return cents(today ? (day * hoursElapsed) / 24 : day)
    })
    // The gateway was paused all day Sunday 8 Nov: a true zero.
    if (date === '2026-11-08') return { date, costs: mapCosts(costs, () => 0) }
    // A batch eval ran on Wednesday 11 Nov: one day far above the rest.
    if (date === '2026-11-11')
      return { date, costs: mapCosts(costs, (v, id) => (id === 'orion-max' ? cents(v * 4.6) : v)) }
    return { date, costs }
  })
}

/**
 * `?fixture=` names: `under` (a quiet week), `over` (a runaway job today), `zero` (just after
 * midnight, Lyra Embed idle all week). Any other value is the default week.
 */
export function spendFixture(name: string | undefined): SpendFixture {
  const hoursElapsed = name === 'zero' ? 0.5 : HOURS_ELAPSED
  const days = baseDays(hoursElapsed).map((d) => {
    const thisWeek = d.date >= WEEK_START
    if (!thisWeek) return d
    if (name === 'under') return { ...d, costs: mapCosts(d.costs, (v) => cents(v * 0.55)) }
    if (name === 'zero') {
      const today = d.date === '2026-11-19'
      return { ...d, costs: mapCosts(d.costs, (v, id) => (today || id === 'lyra-embed' ? 0 : v)) }
    }
    if (name === 'over' && d.date === '2026-11-19')
      return {
        ...d,
        costs: mapCosts(d.costs, (v, id) => (id === 'orion-max' ? cents(v + 640) : v)),
      }
    return d
  })
  return { days, budget: BUDGET, weekStart: WEEK_START, hoursElapsed }
}
