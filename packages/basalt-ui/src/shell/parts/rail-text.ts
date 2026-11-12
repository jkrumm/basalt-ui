/**
 * The rail's own strings. `shell.*` message keys belong to the messages concept (v3-qa-i2); until
 * they land these English defaults stand in, and the swap is one import (same stance as
 * `SHELL_TEXT` in `a11y.tsx`).
 */
export const RAIL_TEXT = {
  search: 'Search',
  /** The cue on a folded section's header while the current page sits inside it. */
  containsActive: 'Contains the current page',
} as const

/** The accessible name of a row: its label, plus the count when it carries one. */
export function rowName(label: string, count: number | undefined): string {
  return count === undefined ? label : `${label}, ${count}`
}
