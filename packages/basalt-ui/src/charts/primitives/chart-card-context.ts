import { createContext } from 'react'

/**
 * `ChartCard`'s internal context: `inCard` (a frame inside a card treats its computed height as a
 * MINIMUM and grows into the card body), the legend slot — the empty header-row box a chart will portal its legend into
 * (RESPONSIVE-SPEC §3), so a card has one chrome band, not two — and `short`, the same
 * `measuredHeight < CARD_SHORT_HEIGHT` flag `ChartCard` already computes for the header-fold law
 * (`data-basalt-card-short`), threaded through so `ChartFrame` can fold its header-slot legend to
 * 'dots' before it eats the plot floor (RESPONSIVE-SPEC §4, wave 11). `null`/`false` until the slot
 * mounts, and outside any card. Deliberately not exported from any barrel.
 */
export const ChartCardContext = createContext<{
  legendSlot: HTMLDivElement | null
  inCard: boolean
  short: boolean
}>({
  legendSlot: null,
  inCard: false,
  short: false,
})
