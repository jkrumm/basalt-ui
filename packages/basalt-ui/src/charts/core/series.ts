/**
 * The series dictionary entry point (`docs/v3/concepts/charts-cards-kanban.md` § 3: `defineSeries`
 * sits in `./charts`). Identity at runtime: the value is the typed authoring seam, read by
 * `groupTokens`, `seriesTokens` and the `series-palette` audit.
 */
import type { SeriesColor } from '../contract'

/** A named series map: each key a `{ light, dark }` color pair. */
export type SeriesDictionary = Record<string, SeriesColor>

/**
 * Defines a named series map. The exact literal keys come back, so a rename is a type error at every
 * call site, and the colors stay one app-owned dictionary (a guard-exempt series file) that the
 * `series-palette` audit judges for lightness, chroma, color-vision and contrast.
 *
 * ```ts
 * export const SERIES = defineSeries({
 *   requests: { light: '#0b6bcb', dark: '#5aa9f0' },
 *   errors: { light: '#b3261e', dark: '#f2a29b' },
 * })
 * ```
 *
 * @useWhen a chart or card names a metric whose color belongs to the app, not the palette
 * @neverWhen the color is one of the five `chart-N` tokens or a status role: use the token
 */
export function defineSeries<const T extends SeriesDictionary>(map: T): T {
  return map
}
