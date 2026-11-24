/** What the page reads off the fixture: day totals, the week against its budget, and the driving model. */
import type { CalendarDate } from 'basalt-ui'
import { MODELS, type Costs, type ModelId, type SpendFixture } from './fixture'

export type Role = 'lead' | 'second' | 'third' | 'fourth'
const ROLES: readonly Role[] = ['lead', 'second', 'third', 'fourth']

export type DayRow = {
  key: CalendarDate
  costs: Costs
  total: number
  partial: boolean
  top: { name: string; cost: number }
}
export type RankedModel = { id: ModelId; name: string; week: number; role: Role }

export type Spend = {
  rows: readonly DayRow[]
  /** Models by this week's cost, the one that drives it first. */
  models: readonly RankedModel[]
  budget: number
  dailyPace: number
  /** The budget's share for the days elapsed this week, today counted for the hours that passed. */
  paceSoFar: number
  weekTotal: number
  projected: number
  hoursElapsed: number
  weekStart: CalendarDate
  today: CalendarDate
  cap: number
}

const sum = (c: Costs): number => MODELS.reduce((t, m) => t + c[m.id], 0)

export function readSpend(f: SpendFixture): Spend {
  const todayKey = f.days.at(-1)?.date ?? f.weekStart
  const rows = f.days.map((d) => {
    const ranked = MODELS.map((m) => ({ name: m.name, cost: d.costs[m.id] })).sort(
      (a, b) => b.cost - a.cost,
    )
    return {
      key: d.date,
      costs: d.costs,
      total: sum(d.costs),
      partial: d.date === todayKey,
      top: ranked[0] ?? { name: '', cost: 0 },
    }
  })
  const week = rows.filter((r) => r.key >= f.weekStart)
  const weekTotal = week.reduce((t, r) => t + r.total, 0)
  const models = MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    week: week.reduce((t, r) => t + r.costs[m.id], 0),
  }))
    .sort((a, b) => b.week - a.week)
    .map((m, i) => ({ ...m, role: ROLES[i] ?? 'fourth' }))
  const elapsed = week.length - 1 + f.hoursElapsed / 24
  const dailyPace = f.budget / 7
  return {
    rows,
    models,
    budget: f.budget,
    dailyPace,
    paceSoFar: dailyPace * elapsed,
    weekTotal,
    projected: (weekTotal / elapsed) * 7,
    hoursElapsed: f.hoursElapsed,
    weekStart: f.weekStart,
    today: todayKey,
    cap: Math.round(dailyPace * 2),
  }
}
