import { createContext } from 'react'

/**
 * `ChartCard`'s internal legend slot — the empty header-row box a chart will portal its legend into
 * (RESPONSIVE-SPEC §3), so a card has one chrome band, not two. `null` until the slot mounts, and
 * outside any card. Deliberately not exported from any barrel.
 */
export const ChartCardContext = createContext<{ legendSlot: HTMLElement | null }>({
  legendSlot: null,
})
