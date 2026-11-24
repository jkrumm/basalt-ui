import { useState } from 'react'
import type { ReactElement } from 'react'
import { col, DataTable, useDataTable } from '../../table'
import type { SiteColumn, SiteRow } from '../../static/data-table'
import { IntlScope } from '../../core/provider-props'
import type { IslandMessages } from './messages'

export type TableIslandProps = {
  /** The table's name: its accessible name and caption. */
  label: string
  columns: readonly SiteColumn[]
  rows: readonly SiteRow[]
  /** The locale numbers and dates read in. Default `en`. */
  locale?: string
  /** Overrides of the table's English words, by key: `{ 'table.pager': 'Seiten' }`. */
  messages?: IslandMessages
}

type Row = SiteRow & { readonly id: string }

const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/**
 * A sortable, pageable `DataTable` over plain rows, for an Astro island. The first text column is
 * the row's name. It needs no provider; render it with `client:visible`, below the fold. `locale` and
 * `messages` set the formats and words of a page that is not English.
 *
 * @useWhen a reader sorts or pages a table of plain data inside an article
 * @neverWhen the rows are few or need no sorting (use the static table)
 *
 * @example
 * <TableIsland label="Releases" columns={[{ key: 'v', label: 'Version' }]} rows={[{ v: '3.0' }]} />
 */
export function TableIsland({ label, columns, rows, ...intl }: TableIslandProps): ReactElement {
  return (
    <IntlScope {...intl}>
      <Grid label={label} columns={columns} rows={rows} />
    </IntlScope>
  )
}

function Grid({
  label,
  columns,
  rows,
}: Pick<TableIslandProps, 'label' | 'columns' | 'rows'>): ReactElement {
  const [data] = useState<readonly Row[]>(() =>
    rows.map((row, index) => ({ ...row, id: String(index) })),
  )
  const [specs] = useState(() => {
    const c = col<Row>()
    let named = false
    return columns.map((column) => {
      // The key is the author's column key, typed only as a string: the table is built from data, not from a row type.
      const key = column.key as never
      const header = { header: column.label }
      if (column.kind === 'number') return c.number(key, header)
      if (column.kind === 'date') return c.date(key, header)
      if (named) return c.text(key, header)
      named = true
      return c.entity(key, header)
    })
  })
  const table = useDataTable({
    id: slug(label),
    label,
    columns: specs,
    data,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={table} />
}
