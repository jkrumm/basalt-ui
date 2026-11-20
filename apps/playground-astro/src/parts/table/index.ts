import type { PartEntry } from '../types'

/** The table family: one entry per demo module in this folder. */
export const PARTS: readonly PartEntry[] = [
  {
    id: 'data-table',
    family: 'table',
    module: 'table/data-table',
    covers: ['DataTable'],
    interaction: 'enhance',
    why: 'sorting, paging and selection',
  },
  {
    id: 'static-table',
    family: 'table',
    module: 'table/static-table',
    covers: [
      'Table',
      'TableHeader',
      'TableBody',
      'TableRow',
      'TableHead',
      'TableCell',
      'TableCaption',
    ],
    interaction: 'none',
    why: 'a static table; the picture is the whole part',
  },
  {
    id: 'table-toolbar',
    family: 'table',
    module: 'table/table-toolbar',
    covers: ['TableToolbar', 'BulkBar', 'TablePager'],
    interaction: 'enhance',
    why: 'search, filters, sorting, paging and bulk selection need JS',
  },
  {
    id: 'data-table-body',
    family: 'table',
    module: 'table/data-table-body',
    covers: ['DataTableBody'],
    interaction: 'enhance',
    why: 'sorting, selection and row activation need JS over the body',
  },
]
