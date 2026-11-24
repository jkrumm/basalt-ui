import { createFormat } from 'basalt-ui'

/** One usage record: when it landed (an ISO instant), the tool that produced it, its cost (null when the provider sent none) and its tokens. */
export type UsageRecord = { at: string; tool: string; cost: number | null; tokens: number }

/** One weekday-by-hour cell of the owner's week, folded from the records that landed in it. */
export type Cell = {
  id: string
  weekday: string
  hour: string
  records: number
  priced: number
  cost: number | null
  tokens: number
}

export const OWNER_ZONE = 'Europe/Berlin'
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))

export type FixtureName = 'rest' | 'no-batch' | 'no-cost'

/** The largest record by cost or by tokens, with the Monday-to-Sunday week it fell in. */
export type Largest = { at: string; value: number; week: number }
export type Fixture = {
  key: FixtureName
  records: readonly UsageRecord[]
  cells: readonly Cell[]
  largest: { cost: Largest | null; tokens: Largest | null }
}

export function fixtureKey(name: string | undefined): FixtureName {
  return name === 'no-batch' || name === 'no-cost' ? name : 'rest'
}

/** The batch that carries most of one week's cost: Wed 4 Nov, 03:00 in the owner's zone. */
const BATCH_DAY = '2026-11-04'

const TOOLS = ['Claude Code', 'Codex', 'OpenCode', 'Hermes'] as const

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Local wall time in the owner's zone to a UTC instant; the clocks fell back at 03:00 on Sun 25 Oct 2026. */
function instant(day: Date, hour: number, minute: number, summer?: boolean): string {
  const isFallback = day.getUTCMonth() === 9 && day.getUTCDate() === 25
  const before = day.getUTCMonth() === 9 && day.getUTCDate() < 25
  const offset = (summer ?? (before || (isFallback && hour < 3))) ? 2 : 1
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour - offset, minute),
  ).toISOString()
}

function build(name: FixtureName): readonly UsageRecord[] {
  const rand = mulberry32(8301)
  const out: UsageRecord[] = []
  const add = (day: Date, hour: number, minute: number, cost: number, summer?: boolean) => {
    const forced = summer !== undefined
    const tool = TOOLS[Math.floor(rand() * rand() * TOOLS.length)] ?? 'Claude Code'
    const unpriced = name === 'no-cost' || (!forced && rand() < 0.07)
    out.push({
      at: instant(day, hour, minute, summer),
      tool,
      cost: unpriced ? null : Math.round(cost * 100) / 100,
      tokens: Math.round(cost * (150_000 + rand() * 90_000)),
    })
  }
  for (let i = 0; i < 30; i++) {
    const day = new Date(Date.UTC(2026, 9, 22 + i))
    const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6
    const iso = day.toISOString().slice(0, 10)
    if (!weekend) {
      const batch = iso === BATCH_DAY && name !== 'no-batch' ? 186.4 : 1.4 + rand() * 1.6
      add(day, 3, 4 + Math.floor(rand() * 8), batch)
      for (let h = 9; h < 18; h++) {
        if (rand() < 0.18) continue
        const n = 1 + Math.floor(rand() * 3)
        for (let k = 0; k < n; k++)
          add(day, h, Math.floor(rand() * 60), 0.3 + rand() * rand() * 5.5)
      }
      for (const h of [19, 20, 21, 22]) {
        if (rand() < 0.72) continue
        add(day, h, Math.floor(rand() * 60), 0.2 + rand() * 2.4)
      }
    } else {
      for (let h = 10; h < 18; h++) {
        if (rand() < 0.88) continue
        add(day, h, Math.floor(rand() * 60), 0.2 + rand() * 1.6)
      }
    }
    for (const h of [0, 1, 4, 5, 6]) {
      if (rand() < 0.96) continue
      add(day, h, Math.floor(rand() * 60), 0.1 + rand() * 0.9)
    }
    if (iso === '2026-10-25') {
      // The hour that happens twice: 02:20 summer time and 02:20 winter time.
      add(day, 2, 20, 1.15, true)
      add(day, 2, 20, 2.35, false)
    }
  }
  if (name !== 'no-cost') {
    // A Sunday evening hour whose only record has no cost.
    const day = new Date(Date.UTC(2026, 10, 8))
    out.push({ at: instant(day, 21, 40), tool: 'Codex', cost: null, tokens: 212_000 })
  }
  return out.toSorted((a, b) => a.at.localeCompare(b.at))
}

// cycle-expression-17: the kit has no fold of instants into weekday-by-hour cells in a named zone; `createFormat` gives the zone-aware weekday and hour, the sums are written here.
const owner = createFormat({ locale: 'en-GB', timeZone: OWNER_ZONE })

function foldCells(records: readonly UsageRecord[]): Cell[] {
  const cells = new Map<string, Cell>()
  for (const weekday of WEEKDAYS) {
    for (const hour of HOURS) {
      cells.set(`${weekday}-${hour}`, {
        id: `${weekday}-${hour}`,
        weekday,
        hour,
        records: 0,
        priced: 0,
        cost: null,
        tokens: 0,
      })
    }
  }
  for (const r of records) {
    const at = new Date(r.at)
    const weekday = owner.date(at, 'weekday')
    const hour = owner.time(at, { hour: '2-digit', minute: undefined, hour12: false }).slice(0, 2)
    const cell = cells.get(`${weekday}-${hour}`)
    if (cell === undefined) continue
    cell.records += 1
    cell.tokens += r.tokens
    if (r.cost !== null) {
      cell.priced += 1
      cell.cost = Math.round(((cell.cost ?? 0) + r.cost) * 100) / 100
    }
  }
  return [...cells.values()]
}

const DAY_MS = 86_400_000

/** The local Monday-based week of an instant; the weeks that hold a largest record sit after the clock change, so one hour east of UTC. */
function weekOf(at: string): number {
  const day = Math.floor((Date.parse(at) + 3_600_000) / DAY_MS)
  return day - ((day + 3) % 7)
}

function largestOf(
  records: readonly UsageRecord[],
  read: (r: UsageRecord) => number | null,
): Largest | null {
  let top: UsageRecord | undefined
  for (const r of records) {
    const v = read(r)
    if (v === null) continue
    if (top === undefined || v > (read(top) ?? 0)) top = r
  }
  if (top === undefined) return null
  const week = weekOf(top.at)
  const total = records.reduce((s, r) => s + (weekOf(r.at) === week ? (read(r) ?? 0) : 0), 0)
  return { at: top.at, value: read(top) ?? 0, week: total }
}

const CACHE = new Map<FixtureName, Fixture>()

/** The usage records of the 30 days to Fri 20 Nov 2026 and their 168 cells; `name` picks a variant. */
export function fixtureOf(name: string | undefined): Fixture {
  const key = fixtureKey(name)
  const hit = CACHE.get(key)
  if (hit !== undefined) return hit
  const records = build(key)
  const made: Fixture = {
    key,
    records,
    cells: foldCells(records),
    largest: {
      cost: largestOf(records, (r) => r.cost),
      tokens: largestOf(records, (r) => r.tokens),
    },
  }
  CACHE.set(key, made)
  return made
}
