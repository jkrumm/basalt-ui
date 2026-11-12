/**
 * `FilterSet`: the filter home's container. Hand it `specs` and it draws one nowrap row of pills,
 * folds what does not fit behind `+N`, and on a phone swaps the row for a `Filters (n)` button that
 * opens a sheet of row forms. It never scrolls and never wraps. See `filter-set-spec.tsx`.
 *
 * The `children` form (`<FilterSet><SelectFilter field=… /></FilterSet>`) is the 2.x container,
 * kept while `BasaltDataTable` and the 2.x pages still compose it; it moves to `specs` with them.
 */
import type { ReactElement, ReactNode } from 'react'
import type { FilterSetProps as SpecProps } from './contract'
import { LegacyFilterSet } from './filter-set-legacy'
import type { LegacyFilterSetProps } from './filter-set-legacy'
import { SpecFilterSet } from './filter-set-spec'

export type FilterSetProps =
  | (SpecProps & { children?: never })
  | (LegacyFilterSetProps & { specs?: never })

/**
 * Draws a list of `spec(...)`s as pills in one row: each pill prints its value, opens as a row form,
 * and the tail that does not fit folds into `+N`. Below the `@regular` container the row becomes one
 * `Filters (n)` button that opens a sheet. `n` counts the filters off their default (a multi that
 * holds every option counts as none), and the sheet's `Reset all` unsets them. Inside a
 * `ControlHome` the home's presentation applies: a `row` home draws the row forms stacked.
 *
 * @useWhen a page has two or more filters for the same data and they must fit a phone without scrolling or wrapping
 * @neverWhen the control is a single field of a form (use `FormField`) or one control that overrides a global in a card (use `filterSlot`)
 *
 * @example
 * <FilterSet
 *   specs={[
 *     spec(overview.field.range, 'Range'),
 *     spec(overview.field.region, 'Region', { options: regions }),
 *   ]}
 * />
 */
export function FilterSet(props: FilterSetProps): ReactElement | ReactNode {
  if (props.specs !== undefined) return <SpecFilterSet specs={props.specs} />
  return <LegacyFilterSet {...props} />
}
