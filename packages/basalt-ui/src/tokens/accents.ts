/**
 * The named accent set: six seeds the package derives at build time, each through the same
 * `deriveV3` and the same gates as the default. `blue` is the default seed; the other five were
 * picked for spread in HCT hue (268, 309, 22, 50, 146, 185). An app ships the ones it names with
 * `basalt-ui tokens:css --accents`, and `data-accent="<name>"` on `<html>` picks one at runtime.
 * Pure data: no runtime derive.
 */

/**
 * Each accent's seed: the hue a derive starts from. `blue` is `DEFAULT_DERIVE_V3_CONFIG.accent`.
 *
 * @useWhen code names an accent the reader can pick (`setAppearance({ accent: 'violet' })`) or lists the set
 * @neverWhen styling: an accent reaches the page as `--basalt-brand` once `data-accent` is set, never as this hex
 */
export const ACCENTS = {
  blue: '#0077bd',
  violet: '#7c3aed',
  rose: '#e11d48',
  orange: '#ea580c',
  green: '#16a34a',
  teal: '#0d9488',
} as const

export type AccentName = keyof typeof ACCENTS

/**
 * The names in set order, the default first.
 *
 * @useWhen validating or listing accent names (a settings schema, a picker)
 * @neverWhen the app ships fewer: list its own accents, the ones its `tokens:css --accents` sheet carries
 */
export const ACCENT_NAMES = Object.keys(ACCENTS) as readonly AccentName[]

/**
 * Each accent's derived `brand-fill` (one value in both schemes), for a swatch that shows an accent
 * the page does not wear. Literals so nothing derives at runtime; `accents.test.ts` pins them to
 * `deriveV3`.
 */
export const ACCENT_FILLS: Readonly<Record<AccentName, string>> = {
  blue: '#4374a6',
  violet: '#8856d2',
  rose: '#c34551',
  orange: '#b95222',
  green: '#2d8043',
  teal: '#217e74',
}

export function isAccentName(value: unknown): value is AccentName {
  return typeof value === 'string' && Object.hasOwn(ACCENTS, value)
}
