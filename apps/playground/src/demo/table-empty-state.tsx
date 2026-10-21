/**
 * One empty-state pattern for the playground's tables: a title naming what is absent, a description
 * with the cause and the next step, and the one action only when filters are the cause.
 */
import { Button } from '@mantine/core'
import { EmptyState } from 'basalt-ui'
import type { BasaltDataTable } from 'basalt-ui/table'
import { useState } from 'react'
import type { ComponentProps } from 'react'
import { IconSearch } from './icons'

type ColumnFilters = NonNullable<ComponentProps<typeof BasaltDataTable>['initialColumnFilters']>

/**
 * The table's filters are uncontrolled, so "clear" is a remount with no preset: the hook watches the
 * search and facet reports to know whether an empty table is the filters' doing. `hasData` is false
 * when the table has no rows to filter (an empty log excludes nothing, whatever the preset says).
 */
export function useFilterReset(preset: ColumnFilters = [], hasData = true) {
  const [state, setState] = useState({ resets: 0, search: '', facets: preset.length })
  return {
    tableKey: state.resets,
    initialColumnFilters: state.resets === 0 ? preset : [],
    onGlobalFilterChange: (search: string) => setState((s) => ({ ...s, search })),
    onColumnFiltersChange: (filters: ColumnFilters) =>
      setState((s) => ({ ...s, facets: filters.length })),
    filtered: hasData && (state.search !== '' || state.facets > 0),
    clear: () => setState((s) => ({ resets: s.resets + 1, search: '', facets: 0 })),
  }
}

export function tableEmptyState({
  noun,
  total,
  cause,
  filtered,
  onClear,
}: {
  noun: string
  total: number
  cause: string
  filtered: boolean
  onClear?: () => void
}) {
  if (filtered && onClear !== undefined) {
    return (
      <EmptyState
        icon={<IconSearch />}
        title={`No ${noun} match`}
        description={`The search or filters exclude all ${total}. Clear them to see every one.`}
        action={<Button onClick={onClear}>Clear filters</Button>}
        tier="section"
      />
    )
  }
  return <EmptyState title={`No ${noun} listed`} description={cause} tier="section" />
}
