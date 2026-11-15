import { createContext } from 'react'

/** The pill homes whose controls slot draws as a folding `FilterSet` (F2 amendment n12). */
export type FoldingHome = 'page-bar' | 'section-header'

/**
 * Which pill home a controls slot renders in. `PageBar` and `Section` set it around their slot, a
 * `ControlHome` sets it for the same two homes, and `filterSlot` reads it: inside one the specs
 * render as `FilterSet`, so the measured fold and the phone's `Filters (n)` sheet apply. Elsewhere
 * (a card, a toolbar, a `row` home, no home) it is `undefined` and the slot draws its own form.
 */
export const SlotHomeContext = createContext<FoldingHome | undefined>(undefined)
