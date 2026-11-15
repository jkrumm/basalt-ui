/**
 * The filter values of a table request, as the toolbar, the chips, the header menu and the cell
 * filter all read and write them (docs/v3/concepts/data-table.md section 3): one `FilterModel` per
 * filterable column, the operator the kind decides, an empty value list meaning "no filter".
 * Pure; the parts hold no filter state of their own.
 */
import type { FilterModel } from '../contract'
import type { KindSpec } from '../core/kinds-spec'

/** The part of a kind spec the filter surface reads. */
export type FilterableSpec = Pick<KindSpec<never>, 'id' | 'filter'> & {
  filter: NonNullable<KindSpec<never>['filter']>
}

/** The columns that have an `f.<col>` field: `text`, `entity` (contains) and `status` (anyOf). */
export function filterableSpecs<S extends Pick<KindSpec<never>, 'filter'>>(
  specs: readonly S[],
): (S & { filter: NonNullable<S['filter']> })[] {
  return specs.filter(
    (spec): spec is S & { filter: NonNullable<S['filter']> } => spec.filter !== null,
  )
}

/** The values a column is filtered by, `[]` when it is not. */
export function filterValues(filters: readonly FilterModel[], id: string): readonly string[] {
  return filters.find((f) => f.id === id)?.values ?? []
}

/**
 * `filters` with one column's values replaced, keeping the order of the others. An empty list
 * removes the column's filter; a new one is appended.
 */
export function withFilter(
  filters: readonly FilterModel[],
  spec: Pick<FilterableSpec, 'id' | 'filter'>,
  values: readonly string[],
): FilterModel[] {
  const kept = filters.filter((f) => f.id !== spec.id)
  if (values.length === 0) return kept
  const next: FilterModel = { id: spec.id, op: spec.filter, values: [...values] }
  const index = filters.findIndex((f) => f.id === spec.id)
  return index === -1 ? [...kept, next] : kept.toSpliced(index, 0, next)
}

/** The filters a request carries on columns the table has, in request order. */
export function activeFilters(
  filters: readonly FilterModel[],
  known: ReadonlySet<string>,
): FilterModel[] {
  return filters.filter((f) => known.has(f.id) && f.values.length > 0)
}
