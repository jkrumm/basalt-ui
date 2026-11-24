/**
 * A seeded precipitation nowcast around the viewer: 25 steps of 5 minutes (now to +2 h) on a
 * 20 x 20 grid of 2 km cells (about 40 x 40 km), the viewer in the middle. One rain band moves in
 * from the west; a few steps never arrived. No randomness: every value is a function of cell and step.
 */

export const STEP_MIN = 5
const STEPS = 25
export const CELL_KM = 2
export const SIZE = 20
/** The viewer's cell; its centre is the grid's middle, give or take half a cell. */
const VIEWER = { col: 10, row: 10 } as const
/** The nowcast's first step, a fixed instant so every render prints the same clock. */
const NOW = new Date(Date.UTC(2026, 10, 17, 14, 0))

/** Rain rates in mm/h: a cell under RAIN_MIN is dry, the classes follow the usual radar bands. */
export const RAIN_MIN = 0.1
export const MODERATE = 2.5
export const HEAVY = 7.6

export type Cell = {
  id: string
  /** Kilometres north of the viewer (south is negative) and east of it (west is negative). */
  north: number
  east: number
  /** `null` when the step never arrived. */
  mmh: number | null
  viewer: boolean
}

export type Step = {
  index: number
  at: Date
  missing: boolean
  /** The rate in the viewer's own cell. */
  mmh: number | null
  cells: readonly Cell[]
}

export type Variant = 'rest' | 'dry' | 'cloudburst' | 'raining'

type Band = {
  peak: number
  /** Half-width of the band along its track, km. */
  sigma: number
  /** Km a minute, west to east. */
  speed: number
  /** Minutes after the first step when the band's core crosses the viewer's column. */
  coreMin: number
  missing: readonly number[]
}

const BANDS: Record<Variant, Band | null> = {
  rest: { peak: 9, sigma: 5, speed: 0.5, coreMin: 65, missing: [7, 10, 17] },
  dry: null,
  cloudburst: { peak: 46, sigma: 3.5, speed: 0.6, coreMin: 45, missing: [3] },
  raining: { peak: 5.5, sigma: 8, speed: 0.5, coreMin: 15, missing: [4] },
}

/** The cell's centre in km from the grid's west and south-west corner is (col + 0.5) * CELL_KM. */
function rate(band: Band, col: number, row: number, minute: number): number {
  const east = (col - VIEWER.col) * CELL_KM
  const north = (VIEWER.row - row) * CELL_KM
  const along = east - 0.15 * north - band.speed * (minute - band.coreMin)
  const core = Math.exp(-(along * along) / (2 * band.sigma * band.sigma))
  const ridge = Math.exp(-((north + 3) * (north + 3)) / (2 * 16 * 16))
  const texture =
    1 + 0.16 * Math.sin(0.7 * col + 0.5 * row + 0.15 * minute) * Math.cos(0.4 * row - 0.3 * col)
  const value = band.peak * core * ridge * texture
  return value < RAIN_MIN ? 0 : Math.round(value * 10) / 10
}

function stepOf(band: Band | null, index: number): Step {
  const minute = index * STEP_MIN
  const missing = band?.missing.includes(index) ?? (index === 12 || index === 13)
  const cells: Cell[] = []
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const east = (col - VIEWER.col) * CELL_KM
      const north = (VIEWER.row - row) * CELL_KM
      cells.push({
        id: `${east},${north}`,
        north,
        east,
        mmh: missing || band === null ? (missing ? null : 0) : rate(band, col, row, minute),
        viewer: col === VIEWER.col && row === VIEWER.row,
      })
    }
  }
  const spot = cells.find((c) => c.viewer)
  return {
    index,
    at: new Date(NOW.getTime() + minute * 60_000),
    missing,
    mmh: spot?.mmh ?? null,
    cells,
  }
}

/** The grid's bands in reading order: north to south down the rows, west to east along the columns. */
export const ROW_KEYS = Array.from({ length: SIZE }, (_, row) =>
  String((VIEWER.row - row) * CELL_KM),
)
export const COL_KEYS = Array.from({ length: SIZE }, (_, col) =>
  String((col - VIEWER.col) * CELL_KM),
)

export type Nowcast = { steps: readonly Step[]; now: Step }

const CACHE = new Map<Variant, Nowcast>()

export function variantOf(fixture: string | undefined): Variant {
  return fixture === 'dry' || fixture === 'cloudburst' || fixture === 'raining' ? fixture : 'rest'
}

export function nowcast(variant: Variant): Nowcast {
  const cached = CACHE.get(variant)
  if (cached !== undefined) return cached
  const band = BANDS[variant]
  const steps = Array.from({ length: STEPS }, (_, i) => stepOf(band, i))
  const now = steps[0]
  if (now === undefined) throw new Error('the nowcast has no steps')
  const made = { steps, now }
  CACHE.set(variant, made)
  return made
}
