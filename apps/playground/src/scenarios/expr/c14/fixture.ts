/** Eval-race fixture: five models on one 400-case suite, seeded so every build draws the same page. */

export const SUITE = 400

export type Run = {
  name: string
  /** Cases finished, passed or failed. */
  done: number
  passed: number
  /** The live pass rate, passed / done, or null before the first case finishes. */
  rate: number | null
}

const NAMES = ['Atlas', 'Boreal', 'Cinder', 'Dryad', 'Ember'] as const

/** mulberry32: a small seeded generator, so the fixture never changes between builds. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const run = (name: string, done: number, passed: number): Run => ({
  name,
  done,
  passed,
  rate: done === 0 ? null : passed / done,
})

/** Mid-race: every model between 45% and 85% through, pass rates close together. */
function midRace(): Run[] {
  const next = seeded(414)
  return NAMES.map((name) => {
    const done = 180 + Math.floor(next() * 160)
    const passed = Math.round(done * (0.68 + next() * 0.18))
    return run(name, done, passed)
  })
}

/** `rest`: mid-race. `start`: nothing has finished. `tie`: two models level on rate. `done`: the extreme, one model at 400 of 400. */
export function fixtureRuns(fixture: string | undefined): Run[] {
  if (fixture === 'start') return NAMES.map((name) => run(name, 0, 0))
  const rest = midRace()
  if (fixture === 'tie') {
    return rest.map((r, i) => {
      if (i === 0) return run(r.name, 200, 180)
      if (i === 1) return run(r.name, 300, 270)
      return r
    })
  }
  if (fixture === 'done') {
    return rest.map((r, i) => {
      if (i === 0) return run(r.name, SUITE, 352)
      if (i === 1) return run(r.name, 12, 0)
      return r
    })
  }
  return rest
}

/** Best pass rate first; a model with no finished case last. */
export function rank(runs: readonly Run[]): Run[] {
  return [...runs].sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.done - a.done)
}

/** The leader's margin over the runner-up in whole-and-tenth points, 0 when level at one decimal. */
export function leadPoints(ranked: readonly Run[]): number | null {
  const [first, second] = ranked
  if (first?.rate == null || second?.rate == null) return null
  return Math.round((first.rate - second.rate) * 1000) / 10
}
