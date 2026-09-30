import { createContext } from 'react'
import type { Dispatch } from 'react'

/** One frame claiming or releasing the card's header legend slot. */
export type LegendSlotAction = { type: 'claim' | 'release'; id: string }

/**
 * The ONE owner of the legend-slot protocol (`docs/waves/PLAN.md` wave 3, P2-9): claimants in claim
 * order, and the head owns the slot. A later claimant is denied simply by not being the head, and
 * it takes over the moment everything ahead of it releases — no retry signal, no ownership mirrored
 * in a ref. Returns the same array on a no-op so a repeated claim/release never re-renders the card.
 */
export function legendSlotReducer(
  claimants: readonly string[],
  { type, id }: LegendSlotAction,
): readonly string[] {
  const held = claimants.includes(id)
  if (type === 'claim') return held ? claimants : [...claimants, id]
  return held ? claimants.filter((c) => c !== id) : claimants
}

/**
 * `ChartCard`'s internal context: `inCard` (a frame inside a card treats its computed height as a
 * MINIMUM and grows into the card body), the legend slot — the empty header-row box a chart will portal its legend into
 * (`docs/CHARTS-SPEC.md` §5, Legend), so a card has one chrome band, not two — and `short`, the same
 * `measuredHeight < CARD_SHORT_HEIGHT` flag `ChartCard` already computes for the header-fold law
 * (`data-basalt-card-short`), threaded through so `ChartFrame` can fold its header-slot legend to
 * 'dots' before it eats the plot floor (`docs/CHARTS-SPEC.md` §5, wave 11). `null`/`false` until the slot
 * mounts, and outside any card. Deliberately not exported from any barrel.
 *
 * `legendOwner` is the head of {@link legendSlotReducer}'s claimants and `dispatchLegendSlot` feeds
 * it. Outside any card there is no slot, so nothing ever claims.
 */
export const ChartCardContext = createContext<{
  legendSlot: HTMLDivElement | null
  inCard: boolean
  short: boolean
  legendOwner: string | null
  dispatchLegendSlot: Dispatch<LegendSlotAction>
}>({
  legendSlot: null,
  inCard: false,
  short: false,
  legendOwner: null,
  dispatchLegendSlot: () => {},
})
