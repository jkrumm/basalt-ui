/**
 * Helpers shared by the scenario fixtures: the seeded generator and the day label.
 */

/** mulberry32 — a 32-bit seeded generator, the smallest one with a flat enough spread for noise. */
export function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const fmtDay = (date: Date): string =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** The value at `index`, or a throw naming the fixture — a fixture list is never sparse. */
export function itemAt<T>(items: readonly T[], index: number): T {
  const resolved = index < 0 ? items.length + index : index
  if (resolved < 0 || resolved >= items.length) {
    throw new Error(`fixture list of ${items.length} has no item at ${index}`)
  }
  return items[resolved] as T
}
