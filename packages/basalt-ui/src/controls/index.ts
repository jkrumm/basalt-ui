/**
 * `basalt-ui/controls` — the Mantine-coupled control tier (`docs/CONTROLS-SPEC.md` §3).
 *
 * Every control here renders at the `ctl` tier from the home that hosts it and owns its own
 * desktop/mobile swap in CSS (law C9). Actions and sync land in wave 3; the filter/tab family
 * follows in wave 4.
 */
export {
  ActionGroup,
  OverflowMenu,
  DESKTOP_SECONDARY_MAX,
  MOBILE_GLOBAL_BAR_MAX,
  barActionMobile,
  globalActionMobile,
  type BarAction,
  type BarActionItem,
  type BarActionMenu,
  type BarActionCustom,
  type ActionGroupProps,
  type GlobalAction,
  type OverflowMenuProps,
} from './actions'
export { SyncButton, formatAge, AGE_REFRESH_MS, type SyncButtonProps } from './sync-button'

// ── Filters + tabs (wave 4) ───────────────────────────────────────────────────────────────────
// `FilterPill`, `FilterSheet` and the `EnumFilter` body are deliberately NOT here: reaching for
// them is hand-rolling a filter (`basalt/hand-rolled-filter`), and `useFilterSurface` is only
// meaningful to a control living inside a `FilterSet` — i.e. to this folder.
export { FilterSet, type FilterSetProps } from './filter-set'
export { RangeFilter, type RangeCustomPickerProps, type RangeFilterProps } from './range-filter'
export {
  CompareFilter,
  COMPARE_VALUES,
  type CompareFilterProps,
  type CompareValue,
} from './compare-filter'
export { SelectFilter, type SelectFilterProps } from './select-filter'
export { MultiSelectFilter, type MultiSelectFilterProps } from './multi-select-filter'
export { SearchFilter, type SearchFilterProps } from './search-filter'
export { ToggleFilter, type ToggleFilterProps } from './toggle-filter'
export { ViewTabs, type ViewTabsOption, type ViewTabsProps } from './view-tabs'
