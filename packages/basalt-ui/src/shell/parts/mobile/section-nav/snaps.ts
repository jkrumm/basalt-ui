/**
 * The two heights the phone drawer rests at, from what is measured: the natural height of its head
 * and rows, the area above the bar (where the drawer may stand) and the bar's own height.
 *
 * - short: the whole list when it is short, else as tall as keeps the drawer's top at or below the
 *   middle of the screen, where a thumb on the bar still reaches the first row.
 * - tall: the whole list, at most 85 % of the screen counted from its bottom edge (the bar included),
 *   so the status bar and a strip of the page stay in view.
 *
 * A list that fits the short height has one rest and no tall snap to drag to.
 */

/** The drawer's top stays at or below this share of the screen at its short snap. */
const REACH = 0.5
/** The tallest the drawer goes, as a share of the screen, the bar included. */
const TALL_SHARE = 0.85
/** The shortest rest, so a tiny viewport (a phone on its side) still shows a row and a half. */
const MIN_SHORT = 120
/** Two rests closer than this are one. */
const MIN_GAP = 24

export type DrawerSizes = {
  /** The popup's own height: the tallest the drawer may stand. */
  popup: number
  short: number
  tall: number
  /** Whether a tall snap exists beyond the short one. */
  snaps: boolean
}

export function drawerSizes(measured: {
  natural: number
  area: number
  bar: number
}): DrawerSizes | null {
  const { natural, area, bar } = measured
  if (natural <= 0 || area <= 0) return null
  const screen = area + bar
  const popup = Math.max(MIN_SHORT, Math.floor(TALL_SHARE * screen - bar))
  const tall = Math.min(Math.ceil(natural), popup)
  const reach = Math.max(MIN_SHORT, Math.floor(area - screen * REACH))
  const snaps = tall - Math.min(tall, reach) >= MIN_GAP
  // A list only a few px over the reach has one rest, the whole list: a clipped last row has no drag to it.
  return { popup, short: snaps ? reach : tall, tall, snaps }
}
