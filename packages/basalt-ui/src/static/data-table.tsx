import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { createFormat } from '../core/format'
import type { CalendarDate } from '../core/format'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'

/** One column of a content-site table: plain data, so it can cross an island boundary. */
export type SiteColumn = {
  /** The key in each row. */
  key: string
  /** The header text. */
  label: string
  /** How a value reads: `text` (default), `number` (grouped, right-aligned) or `date` (an ISO date or time). */
  kind?: 'text' | 'number' | 'date'
}

/** A row: a record of strings and numbers, so Astro can serialise it into an island. */
export type SiteRow = Readonly<Record<string, string | number>>

export type SiteDataTableProps = {
  /** The table's name; drawn as its caption. */
  label: string
  columns: readonly SiteColumn[]
  rows: readonly SiteRow[]
  /** The locale numbers and dates read in. Default `en`. */
  locale?: string
  className?: string
}

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * A table of plain data as static HTML: the markup of `Table`, numbers and dates through the shared
 * format, rows in the order given. The picture of the `DataTable` MDX tag before (or instead of) its
 * island.
 *
 * @useWhen an article shows a table of data a reader scans and needs no sorting or paging
 * @neverWhen the reader sorts, filters or pages the rows (render the island of the same rows)
 *
 * @example
 * <SiteDataTable label="Releases" columns={[{ key: 'v', label: 'Version' }, { key: 'kb', label: 'Size', kind: 'number' }]} rows={[{ v: '3.0', kb: 71 }]} />
 */
export function SiteDataTable({
  label,
  columns,
  rows,
  locale = 'en',
  className,
}: SiteDataTableProps): ReactElement {
  const format = createFormat({ locale })
  const cell = (column: SiteColumn, value: string | number | undefined): string => {
    if (value === undefined) return '—'
    if (column.kind === 'number' && typeof value === 'number') return format.number(value)
    if (column.kind === 'date') {
      return typeof value === 'string' && CALENDAR_DATE.test(value)
        ? format.date(value as CalendarDate, 'short')
        : format.date(new Date(value), 'short')
    }
    return String(value)
  }
  return (
    <div
      data-slot="data-table"
      className={cn('overflow-x-auto in-[.basalt-prose]:mt-(--basalt-rhythm-2)', className)}
    >
      <Table>
        <TableCaption>{label}</TableCaption>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} numeric={column.kind === 'number'}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell key={column.key} numeric={column.kind === 'number'}>
                  {cell(column, row[column.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
