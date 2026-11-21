import {
  CUTOVER_INDEX,
  DAY_COUNT,
  WINDOW_DAYS,
  dayAt,
  type KeyId,
  type ModelId,
  type Report,
} from './fixture'

/** One day of the 30-day window, the grain every part of the page shares. */
export type Day = {
  index: number
  day: string
  at: Date
  /** Team key spend, `null` for a day the report has no row for. */
  team: number | null
  gateway: number
  nokey: number
  /** Billed outside the gateway: team key plus no key; `null` when the team report is missing. */
  outside: number | null
  /** Spend over the 30 days ending that day, per key. */
  rollTeam: number
  rollGateway: number
  /** The `LeakRow` ids that billed that day after the cutover. */
  billed: readonly string[]
}

export type Through = 'team' | 'nokey'
/** A model billed outside the gateway since the cutover, per key it went through. */
export type LeakRow = {
  id: string
  model: ModelId
  through: Through
  spend: number
  days: number
  last: string
  billedOn: readonly string[]
}

export type Summary = {
  team: number
  gateway: number
  nokey: number
  /** The 30 days before the window, for the figure with no cap. */
  nokeyBefore: number
  outside: number
  /** Outside spend over the same number of days before the cutover. */
  outsideBefore: number
  daysAfter: number
  daysBilled: number
  missing: string | null
}

export type Model = {
  days: readonly Day[]
  rows: readonly LeakRow[]
  summary: Summary
  empty: boolean
}

export const atOf = (day: string): Date => new Date(`${day}T00:00:00Z`)

const sum = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0)

export function buildModel(report: Report): Model {
  const spend = (index: number, key: KeyId | null): number =>
    sum(report.entries.filter((e) => e.day === dayAt(index) && e.key === key).map((e) => e.spend))
  const unreported = (index: number, key: KeyId): boolean =>
    report.unreported.some((u) => u.key === key && u.day === dayAt(index))
  const teamAt = (index: number): number | null =>
    unreported(index, 'team') ? null : spend(index, 'team')
  const rolling = (index: number, key: KeyId): number =>
    sum(
      Array.from({ length: WINDOW_DAYS }, (_, k) => index - k).map((i) =>
        key === 'team' ? (teamAt(i) ?? 0) : spend(i, 'gateway'),
      ),
    )

  const rowsById = new Map<string, LeakRow>()
  const days: Day[] = []
  for (let index = DAY_COUNT - WINDOW_DAYS; index < DAY_COUNT; index++) {
    const day = dayAt(index)
    const billed: string[] = []
    if (index >= CUTOVER_INDEX) {
      for (const e of report.entries.filter(
        (x) => x.day === day && x.key !== 'gateway' && x.spend > 0,
      )) {
        const through: Through = e.key === null ? 'nokey' : 'team'
        const id = `${through}:${e.model}`
        const row = rowsById.get(id) ?? {
          id,
          model: e.model,
          through,
          spend: 0,
          days: 0,
          last: day,
          billedOn: [],
        }
        rowsById.set(id, {
          ...row,
          spend: row.spend + e.spend,
          days: row.days + 1,
          last: day,
          billedOn: [...row.billedOn, day],
        })
        billed.push(id)
      }
    }
    const team = teamAt(index)
    const nokey = spend(index, null)
    days.push({
      index,
      day,
      at: new Date(`${day}T00:00:00Z`),
      team,
      gateway: spend(index, 'gateway'),
      nokey,
      outside: team === null ? null : team + nokey,
      rollTeam: rolling(index, 'team'),
      rollGateway: rolling(index, 'gateway'),
      billed,
    })
  }

  const last = days.at(-1)
  const after = days.filter((d) => d.index >= CUTOVER_INDEX)
  const beforeSpan = Array.from(
    { length: DAY_COUNT - CUTOVER_INDEX },
    (_, k) => CUTOVER_INDEX - 1 - k,
  )
  const summary: Summary = {
    team: last?.rollTeam ?? 0,
    gateway: last?.rollGateway ?? 0,
    nokey: sum(days.map((d) => d.nokey)),
    nokeyBefore: sum(
      Array.from({ length: WINDOW_DAYS }, (_, k) => DAY_COUNT - WINDOW_DAYS - 1 - k).map((i) =>
        spend(i, null),
      ),
    ),
    outside: sum(after.map((d) => (d.team ?? 0) + d.nokey)),
    outsideBefore: sum(beforeSpan.map((i) => (teamAt(i) ?? 0) + spend(i, null))),
    daysAfter: after.length,
    daysBilled: after.filter((d) => d.billed.length > 0).length,
    missing: report.unreported.map((u) => u.day).find((d) => days.some((x) => x.day === d)) ?? null,
  }
  const rows = [...rowsById.values()].sort((a, b) => b.spend - a.spend)
  return { days, rows, summary, empty: report.entries.length === 0 }
}
