import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings of the table parts (docs/v3/concepts/data-table.md section 6, i18n). Keys carry the
 * area prefix; each is referenced from exactly one file, which `messages.coverage.test.ts` holds.
 * The footer, filter and view strings join this list with the Issues that render them.
 */
export type TableMessages = Record<
  | 'table.selectRow'
  | 'table.selectAll'
  | 'table.actions'
  | 'table.empty'
  | 'table.noMatches'
  | 'table.clearFilters'
  | 'table.error'
  | 'table.forbidden'
  | 'table.notFound'
  | 'table.retry'
  | 'table.pager'
  | 'table.pagePrev'
  | 'table.pageNext'
  | 'table.pageSize'
  | 'table.loadMore'
  | 'table.rowRangeNone'
  | 'table.rowRangeUnknown'
  | 'table.search'
  | 'table.filterAdd'
  | 'table.filterColumn'
  | 'table.filterBack'
  | 'table.filtersTitle'
  | 'table.filtersClear'
  | 'table.filterValue'
  | 'table.filterOptions'
  | 'table.filterNoOptions'
  | 'table.display'
  | 'table.chips'
  | 'table.opContains'
  | 'table.opAnyOf'
  | 'table.headerFilter'
  | 'table.views'
  | 'table.viewSave'
  | 'table.viewName'
  | 'table.viewReset'
  | 'table.viewEmpty'
  | 'table.footer'
  | 'table.aggSum'
  | 'table.aggMean'
  | 'table.aggMin'
  | 'table.aggMax'
  | 'table.aggCount',
  string
> &
  Record<'table.groupRows', (f: Format, count: number) => string> &
  Record<'table.rowRange', (f: Format, from: number, to: number, total: number) => string> &
  Record<'table.filters', (f: Format, count: number) => string> &
  Record<
    'table.chipRemove' | 'table.headerMenu' | 'table.viewRemove',
    (f: Format, name: string) => string
  > &
  Record<'table.cellFilter', (f: Format, header: string, value: string) => string>

export const table = {
  'table.selectRow': 'Select row',
  'table.selectAll': 'Select all rows on this page',
  'table.actions': 'Row actions',
  'table.empty': 'No rows yet',
  'table.noMatches': 'No rows match the current search and filters',
  'table.clearFilters': 'Clear filters',
  'table.error': 'The rows could not be loaded',
  'table.forbidden': 'You do not have access to these rows',
  'table.notFound': 'These rows no longer exist',
  'table.retry': 'Retry',
  'table.pager': 'Pagination',
  'table.pagePrev': 'Previous page',
  'table.pageNext': 'Next page',
  'table.pageSize': 'Rows per page',
  'table.loadMore': 'Load more',
  'table.rowRangeNone': 'No rows on this page',
  'table.rowRangeUnknown': 'Rows shown',
  'table.rowRange': (f, from, to, total) =>
    `${f.number(from)}–${f.number(to)} of ${f.number(total)}`,
  'table.search': 'Search rows',
  'table.filterAdd': '+ Filter',
  'table.filterColumn': 'Filter by column',
  'table.filterBack': 'Back',
  'table.filtersTitle': 'Filters',
  'table.filtersClear': 'Clear all filters',
  'table.filterValue': 'Contains',
  'table.filterOptions': 'Is any of',
  'table.filterNoOptions': 'No matching value',
  'table.display': 'Display',
  'table.chips': 'Active filters',
  'table.opContains': 'contains',
  'table.opAnyOf': 'is',
  'table.headerFilter': 'Filter...',
  'table.views': 'Views',
  'table.viewSave': 'Save view',
  'table.viewName': 'View name',
  'table.viewReset': 'Reset',
  'table.viewEmpty': 'No saved views',
  'table.footer': 'Summary',
  'table.aggSum': 'Sum',
  'table.aggMean': 'Average',
  'table.aggMin': 'Min',
  'table.aggMax': 'Max',
  'table.aggCount': 'Count',
  'table.groupRows': (f, count) => (count === 1 ? '1 row' : `${f.number(count)} rows`),
  'table.filters': (f, count) => (count > 0 ? `Filters (${f.number(count)})` : 'Filters'),
  'table.chipRemove': (_f, subject) => `Remove filter ${subject}`,
  'table.headerMenu': (_f, header) => `${header} column menu`,
  'table.viewRemove': (_f, name) => `Delete view ${name}`,
  'table.cellFilter': (_f, header, value) => `Filter ${header} by ${value}`,
} satisfies Partial<BasaltMessages>
