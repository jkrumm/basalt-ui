/**
 * The prop and option shapes every filter shares (`docs/CONTROLS-SPEC.md` §3). INTERNAL — the
 * filters re-state their own props from these, so a new member lands on the whole family at once.
 */
import type { ReactNode } from 'react'

/**
 * What every filter takes besides its `field`. A filter picks the members that mean something to it
 * (`Omit<FilterBase, 'clearable'>` for a toggle) and tightens `label` to required where no sensible
 * default exists — a store field declares no name of its own, only its VALUES' labels.
 */
export type FilterBase = {
  /** The popover/sheet heading and the accessible name — never the pill text, which reads the VALUE. */
  readonly label?: string
  /** Leading pill icon. */
  readonly icon?: ReactNode
  /** Adds a `Clear` action that clears the field — the same `field.clear()` `Reset all` calls. */
  readonly clearable?: boolean
  /** Renders the control inert: a pill that will not open, a row that will not edit. */
  readonly disabled?: boolean
}

/**
 * One row of any option list. `disabled` renders the row and refuses the selection — a live
 * catalogue cannot leave an archived value out, because rows already pointing at it still label it.
 */
export type Option<V extends string | number = string> = {
  readonly value: V
  readonly label: string
  readonly disabled?: boolean
}
