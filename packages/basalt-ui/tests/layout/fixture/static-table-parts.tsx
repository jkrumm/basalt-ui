import type { ReactElement } from 'react'
import { SiteDataTable } from '../../../src/static'

/** A table with a text and a number column, as the `DataTable` MDX tag renders it with no island. */
export function Parts(): ReactElement {
  return (
    <SiteDataTable
      label="Releases"
      columns={[
        { key: 'version', label: 'Version' },
        { key: 'size', label: 'Size', kind: 'number' },
      ]}
      rows={[
        { version: '3.0', size: 71500 },
        { version: '3.1', size: 72900 },
      ]}
    />
  )
}
