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
import type { BasaltProps } from '../common/props'
import { assertRequiredProps } from '../common/validate'
import type { EnumField, FieldHandle } from '../state'
import { EnumFilter } from './enum-filter'
import { SwapGlyph } from './glyphs'

/** The three comparison bases — declare the field as `field.enum(COMPARE_VALUES, 'none')`. */
export type CompareValue = 'none' | 'previous' | 'year'

/** The declared value order, so a consumer's `field.enum` and this control cannot disagree. */
export const COMPARE_VALUES: readonly CompareValue[] = ['none', 'previous', 'year']

/**
 * The three option labels basalt names — the other half of "the same on every page instead of three
 * per app", which this control promised and did not deliver.
 *
 * `field.enum` labels an option with the raw VALUE until a consumer calls `store.labels()`, so a
 * `CompareFilter` over an unlabelled field printed `none` / `previous` / `year` in its popover and,
 * now that the pill reads the value (see `EnumFilter`'s doc), in the bar too. Every app then wrote
 * the same three strings into its own `labels()` call, which is three chances to disagree about what
 * `year` means.
 *
 * These are DEFAULTS, not overrides: a field whose label differs from its value has been labelled
 * deliberately, and that label wins. Detecting it as `label !== value` is exactly the signal
 * `optionsFor` leaves behind (`state/fields.ts` — `label: map?.[value] ?? value`), so nothing new
 * has to be threaded through the store to ask the question.
 */
export const COMPARE_LABELS: Readonly<Record<CompareValue, string>> = {
  none: 'No comparison',
  previous: 'Previous period',
  year: 'Same period last year',
}

export type CompareFilterProps = BasaltProps & {
  readonly field: FieldHandle<EnumField<CompareValue>>
  /** @default 'Compare' */
  readonly label?: string
  /** Leading pill icon. Defaults to an arrows-swap glyph — like `RangeFilter`'s calendar, the mark
   *  is part of what makes the pill legible as a period comparison. */
  readonly icon?: ReactNode
}

export function CompareFilter(props: CompareFilterProps): ReactNode {
  // F-ERR-1 — without this a missing `field` surfaces from inside `EnumFilter` as
  // `undefined is not an object (evaluating 'field.use')`, caught by `BasaltErrorBoundary`.
  assertRequiredProps('CompareFilter', props, ['field'], {
    field: 'bind it to a store field (`store.field.<name>`), never a value/onChange pair.',
  })
  const { field, label = 'Compare', icon, className, style } = props
  // Read through the handle's own options so a consumer's `labels()` and its option ORDER both
  // survive; only an UNLABELLED row (label === value) takes basalt's default string.
  const options = field.options.map((option) =>
    option.label === option.value && isCompareValue(option.value)
      ? { value: option.value, label: COMPARE_LABELS[option.value] }
      : option,
  )
  return (
    <EnumFilter
      field={field}
      label={label}
      icon={icon ?? <SwapGlyph />}
      options={options}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    />
  )
}

function isCompareValue(value: string): value is CompareValue {
  return (COMPARE_VALUES as readonly string[]).includes(value)
}
