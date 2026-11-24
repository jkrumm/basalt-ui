/**
 * The rail's own strings. `shell.*` message keys belong to the messages concept (v3-qa-i2); until
 * they land these English defaults stand in, and the swap is one import (same stance as
 * `SHELL_TEXT` in `a11y.tsx`).
 */
export const RAIL_TEXT = {
  search: 'Search',
  resize: 'Resize sidebar',
  favorites: 'Favorites',
  switchWorkspace: 'Switch workspace',
  expand: 'Expand sidebar',
  removeFavorite: (label: string): string => `Remove ${label} from favorites`,
  /** The cue on a folded section's header while the current page sits inside it. */
  containsActive: 'Contains the current page',
} as const

/** The accessible name of a row: its label, plus the count when it carries one. */
export function rowName(label: string, count: number | undefined): string {
  return count === undefined ? label : `${label}, ${count}`
}

/** The first two graphemes of a name: the icon an icon-less item falls back to, so `Orders` and `Overview` differ. */
const segmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : undefined

export function monogramOf(name: string): string {
  const graphemes = segmenter
    ? Array.from(segmenter.segment(name), (part) => part.segment)
    : [...name]
  return graphemes.slice(0, 2).join('').toUpperCase() || '?'
}
