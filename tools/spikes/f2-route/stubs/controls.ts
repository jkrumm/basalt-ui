/**
 * Stub of `basalt-ui/controls`: the v3 symbols of ARCHITECTURE section 3 that exist (`FilterSet`,
 * `filterSlot`, `spec`, `ControlHome`), from their own files. `src/controls/index.ts` is still
 * the 2.x barrel (Mantine `RangeFilter`, `ViewTabs`, ...) and its `FilterSet` carries a legacy
 * `children` form that imports `@mantine/core`; the stub binds the contract's `{ specs }` form.
 */
export { SpecFilterSet as FilterSet } from '../../../../packages/basalt-ui/src/controls/filter-set-spec'
export { filterSlot } from '../../../../packages/basalt-ui/src/controls/filter-slot'
export { spec } from '../../../../packages/basalt-ui/src/controls/spec'
export { ControlHome } from '../../../../packages/basalt-ui/src/controls/control-home'
export type { FilterSetProps } from '../../../../packages/basalt-ui/src/controls/contract'
