/**
 * `SelectFilter` — one closed enum, one pill (`docs/CONTROLS-SPEC.md` §3). Takes `field`, never
 * `value`/`onChange`/`size` (C2/C5): the handle owns the URL write, the localStorage mirror and the
 * option labels (`store.labels()`), so the call site is the field plus its human name.
 *
 * @example
 * <SelectFilter field={analytics.field.currency} label="Currency" clearable />
 */
import type { ReactNode } from 'react'
import type { EnumField, FieldHandle } from '../state'
import { EnumFilter } from './enum-filter'

export type SelectFilterProps<T extends string> = {
  readonly field: FieldHandle<EnumField<T>>
  readonly label: string
  readonly icon?: ReactNode
  /** Adds a `Clear` action that writes the field back to its fallback. */
  readonly clearable?: boolean
}

export function SelectFilter<T extends string>(props: SelectFilterProps<T>): ReactNode {
  return <EnumFilter {...props} />
}
