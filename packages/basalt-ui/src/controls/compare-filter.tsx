/**
 * `CompareFilter` — the period-comparison enum every dashboard grows
 * (`docs/CONTROLS-SPEC.md` §3). A `SelectFilter` narrowed to the three values basalt names, so the
 * label, the option order and the fallback are the same on every page instead of three per app.
 *
 * @example
 * // compare: field.enum(['none', 'previous', 'year'], 'none')
 * <CompareFilter field={analytics.field.compare} />
 */
import type { ReactNode } from 'react'
import type { EnumField, FieldHandle } from '../state'
import { EnumFilter } from './enum-filter'

/** The three comparison bases — declare the field as `field.enum(COMPARE_VALUES, 'none')`. */
export type CompareValue = 'none' | 'previous' | 'year'

/** The declared value order, so a consumer's `field.enum` and this control cannot disagree. */
export const COMPARE_VALUES: readonly CompareValue[] = ['none', 'previous', 'year']

export type CompareFilterProps = {
  readonly field: FieldHandle<EnumField<CompareValue>>
  /** @default 'Compare' */
  readonly label?: string
  readonly icon?: ReactNode
}

export function CompareFilter({ field, label = 'Compare', icon }: CompareFilterProps): ReactNode {
  return <EnumFilter field={field} label={label} {...(icon !== undefined && { icon })} />
}
