/**
 * Set by a host that already shows the reading as its hero (a `StatCard` sparkline slot, a strip
 * cell's `visual`). A `Meter` reads it: a zoned track drops the reading it would draw at the marker
 * (the headline is not printed twice; `reading` overrides), and a plain bar or ring with no `tone` or
 * `color` of its own takes the host's `tone` as its verdict colour. Internal: never exported.
 */
import { createContext } from 'react'
import type { Tone } from '../common/props'

export interface VisualSlot {
  readonly tone?: Tone
  /** The host is loading: a `Meter` in the slot draws its loading state without its own `loading`. */
  readonly loading?: boolean
}

/** A host with no verdict of its own: one shared object, so a provider never re-renders its readers. */
export const HOSTED: VisualSlot = {}

/** `HOSTED` while the host loads. */
export const HOSTED_LOADING: VisualSlot = { loading: true }

export const VisualSlotContext = createContext<VisualSlot | null>(null)
