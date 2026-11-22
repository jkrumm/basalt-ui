import { couldNotLoad } from '../could-not-load'
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
  | 'table.noMatchesFilters'
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
  | 'table.filterNoOptions'
  | 'table.display'
  | 'table.chips'
  | 'table.opContains'
  | 'table.opAnyOf'
  | 'table.headerFilter'
  | 'table.rangeMin'
  | 'table.rangeMax'
  | 'table.filterClear'
  | 'table.boolAny'
  | 'table.optionSearch'
  | 'table.presets'
  | 'table.presetToday'
  | 'table.presetWeek'
  | 'table.presetMonth30'
  | 'table.presetThisMonth'
  | 'table.presetThisYear'
  | 'table.orderCategories'
  | 'table.orderReset'
  | 'table.orderHint'
  | 'table.bulk'
  | 'table.bulkClear'
  | 'table.sortAsc'
  | 'table.sortDesc'
  | 'table.sortClear'
  | 'table.hideColumn'
  | 'table.resetColumn'
  | 'table.moveLeft'
  | 'table.moveRight'
  | 'table.moveStart'
  | 'table.moveEnd'
  | 'table.sortedAsc'
  | 'table.sortedDesc'
  | 'table.pinColumn'
  | 'table.unpinColumn'
  | 'table.columns'
  | 'table.views'
  | 'table.viewSave'
  | 'table.viewName'
  | 'table.viewReset'
  | 'table.viewEmpty'
  | 'table.viewFailed'
  | 'table.viewNone'
  | 'table.viewUnsaved'
  | 'table.details'
  | 'table.rowsBelow'
  | 'table.footer'
  | 'table.aggSum'
  | 'table.aggMean'
  | 'table.aggMin'
  | 'table.aggMax'
  | 'table.aggCount'
  | 'table.aggNone'
  | 'table.summaryMenu'
  | 'table.rowNumber'
  | 'table.resetWidth'
  | 'table.groupNone',
  string
> &
  Record<
    'table.groupRows' | 'table.selectedCount' | 'table.allMatching' | 'table.selectAllMatching',
    (f: Format, count: number) => string
  > &
  Record<'table.rowRange', (f: Format, from: number, to: number, total: number) => string> &
  Record<'table.filters', (f: Format, count: number) => string> &
  Record<
    | 'table.chipRemove'
    | 'table.columnActions'
    | 'table.viewRemove'
    | 'table.errorNamed'
    | 'table.resizeColumn'
    | 'table.groupBy'
    | 'table.summaryOf',
    (f: Format, name: string) => string
  > &
  Record<'table.cellFilter', (f: Format, header: string, value: string) => string> &
  Record<'table.rangeBetween', (f: Format, a: string, b: string) => string> &
  Record<
    | 'table.rangeFrom'
    | 'table.rangeTo'
    | 'table.dayFrom'
    | 'table.dayTo'
    | 'table.filterOf'
    | 'table.filteredBy'
    | 'table.orderOf'
    | 'table.dateRange'
    | 'table.optionsOf'
    | 'table.searchIn',
    (f: Format, value: string) => string
  > &
  Record<'table.countdownToday', string> &
  Record<'table.countdownLate' | 'table.countdownIn', (f: Format, days: number) => string> &
  Record<'table.displayHidden', (f: Format, hidden: number) => string> &
  Record<'table.orderMoved', (f: Format, label: string, at: number, of: number) => string> &
  Record<'table.orderHandle', (f: Format, label: string, at: number, of: number) => string>

export const table = {
  'table.selectRow': 'Select row',
  'table.selectAll': 'Select all rows on this page',
  'table.actions': 'Row actions',
  'table.empty': 'No rows to show',
  'table.noMatches': 'No rows match the current search and filters',
  'table.noMatchesFilters': 'No rows match the current filters',
  'table.clearFilters': 'Clear filters',
  'table.error': 'Could not load this.',
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
  'table.filterNoOptions': 'No matching value',
  'table.display': 'Display',
  'table.chips': 'Active filters',
  'table.opContains': 'contains',
  'table.opAnyOf': 'is',
  'table.headerFilter': 'Filter column...',
  'table.rangeMin': 'Min',
  'table.rangeMax': 'Max',
  'table.filterClear': 'Clear',
  'table.boolAny': 'Any',
  'table.optionSearch': 'Search values',
  'table.presets': 'Quick ranges',
  'table.presetToday': 'Today',
  'table.presetWeek': 'Last 7 days',
  'table.presetMonth30': 'Last 30 days',
  'table.presetThisMonth': 'This month',
  'table.presetThisYear': 'This year',
  'table.orderCategories': 'Order categories...',
  'table.orderReset': 'Reset to default',
  'table.orderHint': 'Drag a row, or press Alt with an arrow key',
  'table.bulk': 'Bulk actions',
  'table.bulkClear': 'Clear selection',
  'table.sortAsc': 'Sort ascending',
  'table.sortDesc': 'Sort descending',
  'table.sortClear': 'No sorting',
  'table.hideColumn': 'Hide column',
  'table.resetColumn': 'Reset column',
  'table.moveLeft': 'Move left',
  'table.moveRight': 'Move right',
  'table.moveStart': 'Move to left end',
  'table.moveEnd': 'Move to right end',
  'table.sortedAsc': 'sorted ascending',
  'table.sortedDesc': 'sorted descending',
  'table.pinColumn': 'Pin column',
  'table.unpinColumn': 'Unpin column',
  'table.columns': 'Columns',
  'table.views': 'Views',
  'table.viewSave': 'Save view',
  'table.viewName': 'View name',
  'table.viewReset': 'Reset',
  'table.viewEmpty': 'No saved views',
  'table.viewFailed': 'The views could not be updated',
  'table.viewNone': 'All rows',
  'table.viewUnsaved': 'Unsaved view',
  'table.details': 'Details',
  'table.rowsBelow': 'Rows below',
  'table.footer': 'Summary',
  'table.aggSum': 'Sum',
  'table.aggMean': 'Average',
  'table.aggMin': 'Min',
  'table.aggMax': 'Max',
  'table.aggCount': 'Count',
  'table.aggNone': 'None',
  'table.summaryMenu': 'Summary',
  'table.rowNumber': 'Row',
  'table.resetWidth': 'Reset width',
  'table.groupNone': 'Remove grouping',
  'table.countdownToday': 'Today',
  'table.countdownLate': (f, days) =>
    `${f.number(days)} ${f.plural(days) === 'one' ? 'day' : 'days'} late`,
  'table.countdownIn': (f, days) =>
    `in ${f.number(days)} ${f.plural(days) === 'one' ? 'day' : 'days'}`,
  'table.groupRows': (f, count) => (count === 1 ? '1 row' : `${f.number(count)} rows`),
  'table.selectedCount': (f, count) => `${f.number(count)} selected`,
  'table.allMatching': (f, count) => `All ${f.number(count)} rows selected`,
  'table.selectAllMatching': (f, count) => `Select all ${f.number(count)} rows`,
  'table.filters': (f, count) => (count > 0 ? `Filters (${f.number(count)})` : 'Filters'),
  'table.chipRemove': (_f, subject) => `Remove filter ${subject}`,
  'table.columnActions': (_f, header) => `${header} column actions`,
  'table.resizeColumn': (_f, header) => `Resize ${header}`,
  'table.groupBy': (_f, header) => `Group by ${header}`,
  'table.summaryOf': (_f, header) => `Summary of ${header}`,
  'table.viewRemove': (_f, name) => `Delete view ${name}`,
  'table.errorNamed': (_f, name) => `${couldNotLoad(String(name))}.`,
  'table.cellFilter': (_f, header, value) => `Filter ${header} by ${value}`,
  'table.rangeBetween': (_f, from, to) => `${from} – ${to}`,
  'table.rangeFrom': (_f, value) => `≥ ${value}`,
  'table.rangeTo': (_f, value) => `≤ ${value}`,
  'table.dayFrom': (_f, value) => `from ${value}`,
  'table.dayTo': (_f, value) => `until ${value}`,
  'table.filterOf': (_f, header) => `Filter ${header}`,
  'table.filteredBy': (_f, value) => `filtered: ${value}`,
  'table.orderOf': (_f, header) => `Order of ${header}`,
  'table.dateRange': (_f, header) => `${header} range`,
  'table.optionsOf': (_f, header) => `${header} values`,
  'table.searchIn': (_f, label) => `Search ${label}`,
  'table.displayHidden': (f, hidden) => `Display, ${f.number(hidden)} hidden`,
  'table.orderMoved': (f, label, at, of) =>
    `${label} moved to position ${f.number(at)} of ${f.number(of)}`,
  'table.orderHandle': (f, label, at, of) =>
    `Move ${label}, position ${f.number(at)} of ${f.number(of)}`,
} satisfies Partial<BasaltMessages>
