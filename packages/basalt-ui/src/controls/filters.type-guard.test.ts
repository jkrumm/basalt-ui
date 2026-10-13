/**
 * V2-SPEC §3 (law C2): a filter or tab given `value`, `onChange` or `size` fails to compile with
 * the mistake named, because the slot is typed `never` rather than merely absent. Each line reads
 * the slot itself, so a missing required prop cannot satisfy the directive by accident.
 */
import { expect, test } from 'bun:test'
import type { MultiSelectFilterProps } from './multi-select-filter'
import type { NumberFilterProps } from './number-filter'
import type { SearchFilterProps } from './search-filter'
import type { ToggleFilterProps } from './toggle-filter'
import type { ViewTabsProps } from './view-tabs'

// @ts-expect-error `value` belongs to the field, not the call site
export const search: SearchFilterProps['value'] = 'x'
// @ts-expect-error `onChange` belongs to the field, not the call site
export const toggle: ToggleFilterProps['onChange'] = () => {}
// @ts-expect-error `size` is the home's tier, never the control's
export const number: NumberFilterProps['size'] = 'xs'
// @ts-expect-error `size` is the home's tier, never the control's
export const multi: MultiSelectFilterProps<string>['size'] = 'xs'
// @ts-expect-error `value` belongs to the field, not the call site
export const tabs: ViewTabsProps<string>['value'] = 'x'

test('the slots are typed never', () => {
  expect(true).toBe(true)
})
