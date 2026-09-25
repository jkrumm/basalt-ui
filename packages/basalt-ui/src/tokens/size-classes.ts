/**
 * The two responsive tables (`docs/waves/RESPONSIVE-SPEC.md` §1) — pure data, Mantine-free. Each
 * value is the class's minimum width in px.
 *
 * A `@media`/`@container` condition cannot read a custom property, so CSS writes the literal and
 * `breakpoint-literals.test.ts` pins every literal to these tables.
 */

/** Viewport classes — shell chrome only (bottom bar / rail / sidebar, aside docking). */
export const SIZE_CLASSES = { compact: 0, medium: 840, expanded: 1200 } as const

/** A component's own inline size — card chrome, chart tier, forms. No CSS reads it yet. */
export const CONTAINER_CLASSES = { micro: 0, compact: 240, regular: 480, wide: 800 } as const

export type ContainerClass = keyof typeof CONTAINER_CLASSES

/** The class a MEASURED inline size falls in (`px` is a min-width boundary, so 240 is `compact`). */
export function resolveContainerClass(px: number): ContainerClass {
  if (px >= CONTAINER_CLASSES.wide) return 'wide'
  if (px >= CONTAINER_CLASSES.regular) return 'regular'
  if (px >= CONTAINER_CLASSES.compact) return 'compact'
  return 'micro'
}

/**
 * `theme.breakpoints`, derived — a consumer cannot retune it. Mantine needs all five keys:
 * `base` (no key) is compact, `xs`/`sm` open the medium class, `md`/`lg`/`xl` the expanded one, so
 * every `visibleFrom`/`hiddenFrom` in the package stays "desktop chrome" from `sm` up.
 */
export const SIZE_CLASS_BREAKPOINTS = {
  xs: `${SIZE_CLASSES.medium / 16}em`,
  sm: `${SIZE_CLASSES.medium / 16}em`,
  md: `${SIZE_CLASSES.expanded / 16}em`,
  lg: `${SIZE_CLASSES.expanded / 16}em`,
  xl: `${SIZE_CLASSES.expanded / 16}em`,
} as const

/** A px width as the `em` length media queries use (16px root). */
export function toEm(px: number): string {
  return `${Number((px / 16).toFixed(5))}em`
}

/** The `max-width` complement of a class boundary — 0.1px under it, Mantine's own convention. */
export function sizeClassMaxEm(minPx: number): string {
  return toEm(minPx - 0.1)
}
