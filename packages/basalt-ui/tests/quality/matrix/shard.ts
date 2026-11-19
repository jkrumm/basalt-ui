/**
 * The matrix shard (.github/workflows/ci.yml, job `quality-matrix`). The matrix is one file of `test.each` cells, so
 * `bun test --shard` (which splits by file) cannot divide it: `BASALT_MATRIX_SHARD=<i>/<n>` keeps the cells whose
 * position in the list is congruent to i modulo n. The shards partition the list, so together they run each cell once.
 * Unset, the whole matrix runs.
 */

export type Shard = { index: number; count: number }

/** `2/5` -> { index: 2, count: 5 }; unset or empty -> null; anything else throws (a typo must not run the whole matrix). */
export function parseShard(value: string | undefined): Shard | null {
  if (value === undefined || value === '') return null
  const m = /^(\d+)\/(\d+)$/.exec(value)
  const index = Number(m?.[1])
  const count = Number(m?.[2])
  if (m === null || index < 1 || index > count)
    throw new Error(`matrix: BASALT_MATRIX_SHARD must be <i>/<n> with 1 <= i <= n, got "${value}"`)
  return { index, count }
}

/** The items of `shard` (all of them without one): position p belongs to shard (p mod count) + 1. */
export function inShard<T>(items: readonly T[], shard: Shard | null): T[] {
  if (shard === null) return [...items]
  return items.filter((_, position) => position % shard.count === shard.index - 1)
}

/** What a shard prints when it ends, and `scripts/check-matrix-shards.ts` reads: cells it ran of the cells the matrix has. */
export function shardLine(shard: Shard | null, ran: number, total: number): string {
  const label = shard === null ? '1/1' : `${shard.index}/${shard.count}`
  return `matrix-shard ${label} ran=${ran} total=${total}`
}
