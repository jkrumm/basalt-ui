import { oneOf } from '../common/errors'

/** A run of adjacent slots drawn as one band; `items` are the source data it stands for. */
export type Group<T> = { start: number; items: T[] }

/** Adjacent data in groups of equal size, the last possibly shorter, at most `cap` groups. */
export function groupsOf<T>(data: readonly T[], cap: number): Group<T>[] {
  const size = Math.max(1, Math.ceil(data.length / Math.max(cap, 1)))
  const out: Group<T>[] = []
  data.forEach((d, i) => {
    const last = out.at(-1)
    if (last && last.items.length < size) last.items.push(d)
    else out.push({ start: i, items: [d] })
  })
  return out
}

/**
 * The width-driven fold `BandStrip` and `MirroredBars` run: at most `cap` slots, adjacent data
 * merged in equal runs by the consumer's `merge` (a lone datum passes through unmerged). Exported
 * so a consumer can test its `merge` against the real grouping; `cap` is
 * `floor(width / minBandPx)`.
 */
export function foldBands<T>(data: readonly T[], cap: number, merge: (group: T[]) => T): T[] {
  if (cap <= 0) return []
  if (data.length <= cap) return [...data]
  return groupsOf(data, cap).map((g) => merge(g.items))
}

/**
 * Resolves a prop that names a `series` / `states` key (`absentState`): the key when it names an
 * entry, `undefined` when it is unset. A key naming nothing throws in dev, naming the valid set;
 * in production the chart degrades to the unset behaviour.
 */
export function resolveNamedState<K extends string>(
  component: string,
  prop: string,
  requested: K | undefined,
  known: readonly string[],
): K | undefined {
  if (requested === undefined) return undefined
  if (known.includes(requested)) return requested
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(oneOf(component, prop, [...known], requested))
  }
  return undefined
}
