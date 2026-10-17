/**
 * Set by a host that already shows the reading as its hero (a `StatCard` sparkline slot, a strip
 * cell's `visual`). A `Meter` in zones mode reads it and drops the reading it would draw at the
 * marker, so the headline value is not printed twice. Internal: never exported.
 */
import { createContext } from 'react'

export const VisualSlotContext = createContext(false)
