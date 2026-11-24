/** What the walker asks of the nowcast: does rain come, from when, until when, how heavy, and where it is. */
import { CELL_KM, HEAVY, MODERATE, RAIN_MIN, SIZE, type Cell, type Step } from './nowcast'

export type Grade = 'light' | 'moderate' | 'heavy'

export const gradeOf = (mmh: number): Grade =>
  mmh < MODERATE ? 'light' : mmh < HEAVY ? 'moderate' : 'heavy'

export type Outlook =
  | { kind: 'dry' }
  | {
      kind: 'rain'
      /** The first step that holds rain at the viewer's spot. */
      first: Step
      /** The first step rain could have started on: the missing steps just before `first` count. */
      earliest: Step
      /** The first step seen dry after the rain, or `null` when the window ends wet. */
      dryAt: Step | null
      peak: Step
    }

const wet = (s: Step): boolean => (s.mmh ?? 0) >= RAIN_MIN

export function outlookOf(steps: readonly Step[]): Outlook {
  const first = steps.find(wet)
  if (first === undefined) return { kind: 'dry' }
  let earliest = first
  for (let i = first.index - 1; i >= 0 && steps[i]?.missing; i -= 1) earliest = steps[i] ?? earliest
  const dryAt = steps.find((s) => s.index > first.index && !s.missing && !wet(s)) ?? null
  const run = steps.filter(
    (s) => s.index >= first.index && (dryAt === null || s.index < dryAt.index),
  )
  const peak = run.reduce((best, s) => ((s.mmh ?? 0) > (best.mmh ?? 0) ? s : best), first)
  return { kind: 'rain', first, earliest, dryAt, peak }
}

const POINTS = [
  'east',
  'north-east',
  'north',
  'north-west',
  'west',
  'south-west',
  'south',
  'south-east',
]

export type Nearest = { km: number; toward: string }

/** The wet cell nearest the viewer, by distance between cell centres; `null` when the grid is dry. */
export function nearestRain(step: Step): Nearest | null {
  let best: Cell | null = null
  for (const c of step.cells) {
    if ((c.mmh ?? 0) < RAIN_MIN) continue
    if (best === null || Math.hypot(c.east, c.north) < Math.hypot(best.east, best.north)) best = c
  }
  if (best === null) return null
  const km = Math.round(Math.hypot(best.east, best.north))
  const octant = Math.round(Math.atan2(best.north, best.east) / (Math.PI / 4))
  return { km, toward: POINTS[(octant + 8) % 8] ?? 'west' }
}

export function gridStats(step: Step): { heaviest: number; wetShare: number } {
  const rates = step.cells.map((c) => c.mmh ?? 0)
  return {
    heaviest: Math.max(...rates),
    wetShare: rates.filter((r) => r >= RAIN_MIN).length / (SIZE * SIZE),
  }
}

export const GRID_KM = SIZE * CELL_KM
