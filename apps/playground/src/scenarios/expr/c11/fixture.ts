/** Seeded, deterministic chunk scores for the c11 scenario. */

export type Chunk = { relevance: number; recency: number }
export type Bin = { lo: number; hi: number; count: number }

export const CHUNK_COUNT = 2400
export const BIN_WIDTH = 0.05
export const RECENCY_BIN_WIDTH = 0.1

/** A relevance cut-off the slider moves, aligned to bin edges. */
export const CUTOFF_STEP = BIN_WIDTH

/** Names the `?fixture=` query knows. */
export type FixtureName = 'default' | 'zero' | 'pileup'

export function resolveFixture(raw: string | undefined): FixtureName {
  if (raw === 'zero' || raw === 'pileup') return raw
  return 'default'
}

/** mulberry32: a small seeded generator, so every load draws the same 2,400 chunks. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))
const round3 = (n: number): number => Math.round(n * 1000) / 1000

/** Three-uniform mean: a cheap bell around `centre`, spread by `width`. */
function bell(rand: () => number, centre: number, width: number): number {
  return centre + ((rand() + rand() + rand()) / 3 - 0.5) * width
}

/**
 * Relevance is bimodal: a large low bulk of near-misses and a smaller cluster of true matches.
 * `zero` tops out at 0.93 so a cut-off above it keeps nothing; `pileup` stacks 780 chunks on
 * exactly 1.00 (duplicates of the query text), the extreme bar of the histogram.
 */
export function buildChunks(name: FixtureName): readonly Chunk[] {
  const rand = seeded(name === 'pileup' ? 11 : 7)
  const ceiling = name === 'zero' ? 0.93 : 1
  return Array.from({ length: CHUNK_COUNT }, (_, i) => {
    if (name === 'pileup' && i < 780)
      return { relevance: 1, recency: round3(clamp01(bell(rand, 0.5, 1))) }
    const match = rand() < 0.34
    const relevance = match ? bell(rand, 0.74, 0.4) : bell(rand, 0.3, 0.46)
    return {
      relevance: round3(Math.min(ceiling, clamp01(relevance))),
      recency: round3(clamp01(bell(rand, 0.4 + relevance * 0.25, 1.1))),
    }
  })
}

/** The default cut-off per fixture: `zero` opens above every score. */
export const initialCutoff = (name: FixtureName): number => (name === 'zero' ? 0.95 : 0.55)

/** One band of a score, `[lo, hi)` in score units. */
export function binScores(scores: readonly number[], width: number): readonly Bin[] {
  const count = Math.round(1 / width)
  const widthMilli = Math.round(width * 1000)
  const counts = Array.from({ length: count }, () => 0)
  for (const score of scores) {
    const index = Math.min(count - 1, Math.floor(Math.round(score * 1000) / widthMilli))
    counts[index] = (counts[index] ?? 0) + 1
  }
  return counts.map((n, i) => ({
    lo: Math.round(i * width * 1000) / 1000,
    hi: Math.round((i + 1) * width * 1000) / 1000,
    count: n,
  }))
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = values.toSorted((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const upper = sorted[mid] ?? 0
  if (sorted.length % 2 === 1) return upper
  return ((sorted[mid - 1] ?? 0) + upper) / 2
}

/** Integer thousandths, so a cut-off on a bin edge compares exactly with a score on it. */
export const milli = (n: number): number => Math.round(n * 1000)
