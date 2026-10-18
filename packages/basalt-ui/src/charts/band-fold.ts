import { oneOf } from '../common/errors'
import { VX } from '../tokens'
import type { ChartSeries } from './types'

/**
 * The fields a named state carries wherever one is declared (`BandStrip`'s `states`, `Heatmap`'s):
 * the key, its legend label and color, its fill opacity, and the legend / tooltip / note switches.
 * One base so a field means the same thing on every kind.
 */
export type NamedChartState = Pick<
  ChartSeries<never>,
  'key' | 'label' | 'color' | 'tooltip' | 'legend' | 'note' | 'fillOpacity'
> & {
  /**
   * A short mark (`!`, `×`) drawn in the middle of each cell in this state, so a state is not told
   * apart by hue alone; `''` opts out of the default. Default: `!` for a `warn` state and `×` for a
   * `bad` one (by `tone`, or by a `color` that is `VX.status.warn` / `VX.status.bad`); none
   * otherwise. Skipped on a cell too narrow to hold it.
   */
  glyph?: string | undefined
  /** The status this state means. `Heatmap` also fills from it; on `BandStrip` it only picks the
   * default `glyph` (the fill is `color`). */
  tone?: StatusTone | undefined
}

/** The status inks a state can name: `VX.status.*`. */
export type StatusTone = 'good' | 'warn' | 'bad' | 'neutral'

/** `warn` and `bad` carry a glyph by default: a status state is not told apart by hue alone. */
const TONE_GLYPH: Partial<Record<StatusTone, string>> = { warn: '!', bad: '×' }

/** The glyph a state draws: its own, else its status tone's default, else none. */
export function glyphOf(
  s: Pick<NamedChartState, 'glyph' | 'tone'> & { color?: string | undefined },
): string | undefined {
  const tone =
    s.tone ?? (s.color === VX.status.warn ? 'warn' : s.color === VX.status.bad ? 'bad' : undefined)
  return s.glyph ?? (tone === undefined ? undefined : TONE_GLYPH[tone])
}

/** A cell narrower than this (px) draws no glyph: it would not fit inside the fill. */
export const GLYPH_MIN_PX = 12

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
