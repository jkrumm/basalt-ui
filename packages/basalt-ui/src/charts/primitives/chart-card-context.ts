import { createContext } from 'react'

/**
 * `ChartCard`'s internal context: `inCard` (a frame inside a card treats its computed height as a
 * MINIMUM and grows into the card body), the legend slot — the empty header-row box a chart will portal its legend into
 * (`docs/CHARTS-SPEC.md` §5, Legend), so a card has one chrome band, not two — and `short`, the same
 * `measuredHeight < CARD_SHORT_HEIGHT` flag `ChartCard` already computes for the header-fold law
 * (`data-basalt-card-short`), threaded through so `ChartFrame` can fold its header-slot legend to
 * 'dots' before it eats the plot floor (`docs/CHARTS-SPEC.md` §5, wave 11). `null`/`false` until the slot
 * mounts, and outside any card. Deliberately not exported from any barrel.
 *
 * `claimLegendSlot`/`releaseLegendSlot` arbitrate the slot when a card hosts more than one
 * `ChartFrame` (`docs/waves/PLAN.md` wave 3, P2-9): the first frame to claim an id keeps it for as
 * long as it holds it, every later claimant is told no and falls back to its own band legend
 * instead of a second frame silently portalling into the same node. Outside any card there is no
 * slot to contend for, so the default always grants the claim.
 */
export const ChartCardContext = createContext<{
  legendSlot: HTMLDivElement | null
  inCard: boolean
  short: boolean
  claimLegendSlot: (id: string) => boolean
  releaseLegendSlot: (id: string) => void
}>({
  legendSlot: null,
  inCard: false,
  short: false,
  claimLegendSlot: () => true,
  releaseLegendSlot: () => {},
})
