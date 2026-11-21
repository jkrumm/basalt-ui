/** Detector noise fixture (scenario expr-n94): seeded and deterministic, one row per detector in the last 30 days. */

export type Loop = 'Build' | 'Review' | 'Deploy'

export type Detector = {
  id: string
  name: string
  loop: Loop
  /** Issues decided in the window: kept or dropped as noise. */
  decided: number
  /** Decided Issues dropped as noise; never above `decided`. */
  noise: number
  /** Issues filed and not yet decided. */
  open: number
  /** Epoch ms the mute ends; null when the detector was never muted. */
  muteUntil: number | null
}

/** The fixed clock of the page, so a mute that ran out is the same on every shot. */
export const TODAY = Date.UTC(2026, 10, 21)

const DAY = 86_400_000
const at = (days: number): number => TODAY + days * DAY

/** mulberry32: the same seed always draws the same open counts. */
function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = seeded(9412)
const quietOpen = (): number => Math.floor(rand() * 4)

/** Fourteen detectors in three loops; the comment names the edge each one holds. */
const BASE: readonly Detector[] = [
  {
    id: 'flaky-tests',
    name: 'Flaky tests',
    loop: 'Build',
    decided: 10,
    noise: 8,
    open: 2,
    muteUntil: at(23),
  },
  {
    id: 'dead-exports',
    name: 'Dead exports',
    loop: 'Build',
    decided: 9,
    noise: 6,
    open: 1,
    muteUntil: at(14),
  },
  // The mute ran out a week ago: due to be asked again.
  {
    id: 'stale-branches',
    name: 'Stale branches',
    loop: 'Build',
    decided: 6,
    noise: 4,
    open: 0,
    muteUntil: at(-7),
  },
  {
    id: 'todo-aging',
    name: 'Todo aging',
    loop: 'Review',
    decided: 8,
    noise: 5,
    open: quietOpen(),
    muteUntil: at(10),
  },
  {
    id: 'duplicate-helpers',
    name: 'Duplicate helpers',
    loop: 'Review',
    decided: 7,
    noise: 5,
    open: 1,
    muteUntil: at(18),
  },
  {
    id: 'slow-queries',
    name: 'Slow queries',
    loop: 'Deploy',
    decided: 5,
    noise: 3,
    open: 1,
    muteUntil: at(6),
  },
  // Exactly half of ten: on the line, not past it, not muted.
  {
    id: 'lockfile-drift',
    name: 'Lockfile drift',
    loop: 'Deploy',
    decided: 10,
    noise: 5,
    open: 2,
    muteUntil: null,
  },
  // Two of two dropped: under the floor of three decided.
  {
    id: 'unused-flags',
    name: 'Unused flags',
    loop: 'Review',
    decided: 2,
    noise: 2,
    open: quietOpen(),
    muteUntil: null,
  },
  // Nothing decided and nothing open: the share is missing, not zero.
  {
    id: 'orphan-docs',
    name: 'Orphan docs',
    loop: 'Review',
    decided: 0,
    noise: 0,
    open: 0,
    muteUntil: null,
  },
  // Open Issues and none decided.
  {
    id: 'env-drift',
    name: 'Env drift',
    loop: 'Deploy',
    decided: 0,
    noise: 0,
    open: 4,
    muteUntil: null,
  },
  {
    id: 'large-files',
    name: 'Large files',
    loop: 'Build',
    decided: 10,
    noise: 1,
    open: quietOpen(),
    muteUntil: null,
  },
  {
    id: 'type-holes',
    name: 'Type holes',
    loop: 'Review',
    decided: 7,
    noise: 2,
    open: quietOpen(),
    muteUntil: null,
  },
  {
    id: 'retry-storms',
    name: 'Retry storms',
    loop: 'Deploy',
    decided: 9,
    noise: 3,
    open: quietOpen(),
    muteUntil: null,
  },
  // A real zero: six decided, none noise.
  {
    id: 'naming-nits',
    name: 'Naming nits',
    loop: 'Review',
    decided: 6,
    noise: 0,
    open: 1,
    muteUntil: null,
  },
]

/** The raw row set for a `?fixture=` name; an unknown name is the rest state. */
export function detectorsFor(fixture: string | undefined): readonly Detector[] {
  if (fixture === 'quiet') {
    // No detector past the line, none muted: the zero of the headline.
    return BASE.map((d) => ({
      ...d,
      noise: Math.min(d.noise, Math.floor(d.decided / 2)),
      muteUntil: null,
    }))
  }
  if (fixture === 'young') {
    // A new loop: every detector under the floor or with nothing decided.
    return BASE.map((d) => ({
      ...d,
      decided: Math.min(d.decided, 2),
      noise: Math.min(d.noise, 1),
      muteUntil: null,
    }))
  }
  if (fixture === 'extreme') {
    // One long name with 212 decided Issues, far above the other counts.
    return [
      {
        id: 'dependency-update-drift',
        name: 'Dependency update drift across lockfiles',
        loop: 'Deploy',
        decided: 212,
        noise: 190,
        open: 31,
        muteUntil: at(40),
      },
      ...BASE,
    ]
  }
  return BASE
}
