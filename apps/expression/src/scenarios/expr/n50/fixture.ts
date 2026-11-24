/**
 * Factory projects over one 30-day month (scenario expr-n50): Issues shipped per day, open Issues
 * and model cost per day, seeded so every build draws the same month.
 *
 * `?fixture=` names: none is the month with two quiet projects and one cost spike; `calm` is the
 * same month with the spike taken out; `quiet` is a month in which no project shipped.
 */

const DAYS = 30

export type ProjectState = 'shipping' | 'quiet' | 'spike'

export type Project = {
  id: string
  name: string
  shipped: number
  open: number
  spent: number
  /** Dollars of model cost per shipped Issue; a project that shipped nothing has none. */
  perIssue: number | undefined
  /** Issues shipped on each of the 30 days. */
  daily: readonly number[]
  state: ProjectState
}

type Seed = { name: string; rate: number; cost: number; open: number }

/** Mean Issues shipped per day, mean model dollars per day and Issues open at month end. */
const SEEDS: readonly Seed[] = [
  { name: 'argo', rate: 3.1, cost: 14, open: 22 },
  { name: 'basalt-ui', rate: 2.6, cost: 22, open: 31 },
  { name: 'rollhook', rate: 1.9, cost: 6, open: 9 },
  { name: 'linewatch', rate: 1.5, cost: 5, open: 14 },
  { name: 'weatherorb', rate: 1.3, cost: 4.5, open: 17 },
  { name: 'brain-web', rate: 1.1, cost: 7, open: 12 },
  { name: 'image-gen', rate: 0.9, cost: 9, open: 8 },
  { name: 'image-share', rate: 0.7, cost: 3, open: 6 },
  { name: 'meteo', rate: 0.6, cost: 2.5, open: 5 },
  { name: 'dotfiles', rate: 0.5, cost: 1.5, open: 11 },
  { name: 'vps', rate: 0.4, cost: 2, open: 7 },
  { name: 'agent-workflows', rate: 0.35, cost: 8, open: 19 },
  { name: 'homelab', rate: 0.25, cost: 1.2, open: 4 },
  { name: 'rb', rate: 0, cost: 1.1, open: 18 },
  { name: 'obsidian', rate: 0, cost: 0, open: 9 },
]

/** The project and day of the dollar spike: one runaway agent day. */
const SPIKE = { name: 'agent-workflows', day: 21, dollars: 340 }

export const PROJECT_COUNT = SEEDS.length

/** Mulberry32: a small seeded generator, so the month never changes between builds. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Knuth's Poisson draw; a mean of zero is always zero. */
function poisson(mean: number, next: () => number): number {
  if (mean === 0) return 0
  const limit = Math.exp(-mean)
  let k = 0
  let p = 1
  do {
    k += 1
    p *= next()
  } while (p > limit)
  return k - 1
}

export const median = (values: readonly number[]): number => {
  const sorted = values.toSorted((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length === 0) return 0
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

const isWeekend = (day: number): boolean => day % 7 === 5 || day % 7 === 6

function build(spiked: boolean, silent: boolean): Project[] {
  const next = seeded(50)
  const projects = SEEDS.map((seed, i): Project => {
    const daily = Array.from({ length: DAYS }, (_, day) =>
      silent ? 0 : poisson(seed.rate * (isWeekend(day) ? 0.35 : 1.25), next),
    )
    const cost = Array.from({ length: DAYS }, (_, day) => {
      const base = seed.cost * (0.6 + next() * 0.8)
      return spiked && seed.name === SPIKE.name && day === SPIKE.day ? SPIKE.dollars : base
    })
    const shipped = daily.reduce((sum, n) => sum + n, 0)
    const spent = cost.reduce((sum, n) => sum + n, 0)
    const surge = Math.max(...cost) > 5 * median(cost)
    return {
      id: `p${i}`,
      name: seed.name,
      shipped,
      open: seed.open,
      spent,
      perIssue: shipped === 0 ? undefined : spent / shipped,
      daily,
      state: shipped === 0 ? 'quiet' : surge ? 'spike' : 'shipping',
    }
  })
  return projects.toSorted((a, b) => b.shipped - a.shipped || a.name.localeCompare(b.name))
}

/** The projects of a `?fixture=` name, most shipped first; an unknown name is the default month. */
export function projectsNamed(fixture: string | undefined): Project[] {
  if (fixture === 'calm') return build(false, false)
  if (fixture === 'quiet') return build(true, true)
  return build(true, false)
}
