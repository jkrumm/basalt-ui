/**
 * The two responsive tables (`docs/DESIGN-CORE.md` § Layout, elevation, shapes) — pure data, Mantine-free. Each
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

/**
 * `CONTAINER_CLASSES` as the CSS lengths `<SimpleGrid type="container">` keys take — Mantine writes
 * each key verbatim into `@container simple-grid (min-width: <key>)`, so a theme name (`sm`) is a
 * dead query and the key has to be a px length: `cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}`.
 * `micro` has no key — `base` is that class. `basalt/raw-breakpoint` judges theme names only, so a
 * computed key is green.
 */
export const CONTAINER_KEYS = {
  compact: `${CONTAINER_CLASSES.compact}px`,
  regular: `${CONTAINER_CLASSES.regular}px`,
  wide: `${CONTAINER_CLASSES.wide}px`,
} as const

/**
 * `CONTAINER_CLASSES` as the five-key map `<Grid type="container" breakpoints={…}>` takes (Mantine
 * types it `Record<MantineSize, string>`), so `Grid.Col` keys resolve onto the grid's own width:
 * `xs` opens compact, `sm` regular, `md`/`lg`/`xl` wide. `basalt/raw-breakpoint` trusts this import
 * by name (from `basalt-ui/tokens`) — any other imported map is unreadable to it and flagged.
 */
export const CONTAINER_GRID_BREAKPOINTS = {
  xs: CONTAINER_KEYS.compact,
  sm: CONTAINER_KEYS.regular,
  md: CONTAINER_KEYS.wide,
  lg: CONTAINER_KEYS.wide,
  xl: CONTAINER_KEYS.wide,
} as const

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
