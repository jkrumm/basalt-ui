/** Host memory fixture (scenario expr-n17): a seeded 24 h at one sample a minute, and resident memory by process class. */

export const LIMIT = 80
export const TOTAL_GB = 64
export const SWAP_GB = 16
export const CORES = 10
const MINUTES = 24 * 60
const NOW_MS = Date.UTC(2026, 10, 16, 12, 0)

export type Sample = { at: Date; pressure: number; swap: number; load: number }
export type ProcessClass = { label: string; gb: number }
export type HostMemory = { samples: readonly Sample[]; classes: readonly ProcessClass[] }

/** mulberry32: the same seed always draws the same day. */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Shape = {
  base: number
  swing: number
  spike: { at: number; len: number; peak: number } | null
  swapMax: number
}

function sample(shape: Shape, seed: number): readonly Sample[] {
  const next = rng(seed)
  let swap = 0
  return Array.from({ length: MINUTES }, (_, i) => {
    const hoursAgo = (MINUTES - 1 - i) / 60
    const day = Math.sin(((i / MINUTES) * 2 + 0.3) * Math.PI)
    let pressure = shape.base + shape.swing * day + (next() - 0.5) * 1.2
    if (shape.spike !== null) {
      const d = i - shape.spike.at
      if (d >= 0 && d < shape.spike.len)
        pressure = Math.max(
          pressure,
          shape.spike.peak - (d / shape.spike.len) * 8 + (next() - 0.5) * 3,
        )
    }
    pressure = Math.min(100, Math.max(0, pressure))
    const target = shape.swapMax === 0 ? 0 : Math.max(0, ((pressure - 55) / 45) * shape.swapMax)
    swap = shape.swapMax === 0 ? 0 : swap + (target - swap) * (target > swap ? 0.2 : 0.01)
    const load = Math.max(0, shape.swapMax === 0 ? 0 : 2 + pressure / 12 + next() * 1.5)
    return {
      at: new Date(NOW_MS - hoursAgo * 3_600_000),
      pressure: Math.round(pressure * 10) / 10,
      swap: Math.round(swap * 100) / 100,
      load: Math.round(load * 10) / 10,
    }
  })
}

const REST: HostMemory = {
  samples: sample({ base: 52, swing: 12, spike: { at: 190, len: 45, peak: 93 }, swapMax: 6 }, 17),
  classes: [
    { label: 'Agent sessions', gb: 31.4 },
    { label: 'Services', gb: 6.2 },
    { label: 'Check steps', gb: 4.1 },
    { label: 'Browsers', gb: 2.3 },
  ],
}

/** The limit is the problem right now: pressure pinned above it, swap deep. */
const OVER: HostMemory = {
  samples: sample({ base: 78, swing: 8, spike: { at: 1300, len: 140, peak: 99 }, swapMax: 14 }, 29),
  classes: [
    { label: 'Agent sessions', gb: 47.9 },
    { label: 'Services', gb: 6.4 },
    { label: 'Check steps', gb: 5.2 },
    { label: 'Browsers', gb: 3.1 },
  ],
}

/** An idle host: zero swap and zero load all day, one class holding nothing. */
const IDLE: HostMemory = {
  samples: sample({ base: 4, swing: 1, spike: null, swapMax: 0 }, 5),
  classes: [
    { label: 'Services', gb: 5.8 },
    { label: 'Agent sessions', gb: 0.4 },
    { label: 'Check steps', gb: 0.1 },
    { label: 'Browsers', gb: 0 },
  ],
}

const FIXTURES: Record<string, HostMemory> = { over: OVER, idle: IDLE }

export const hostMemory = (fixture: string | undefined): HostMemory =>
  (fixture === undefined ? undefined : FIXTURES[fixture]) ?? REST
