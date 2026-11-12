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
  | 'table.retry',
  string
>

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
} satisfies Partial<BasaltMessages>
