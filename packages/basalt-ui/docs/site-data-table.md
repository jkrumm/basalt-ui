---
name: SiteDataTable
use when: 'an article shows a table of data a reader scans and needs no sorting or paging'
never when: 'the reader sorts, filters or pages the rows (render the island of the same rows)'
subpath: basalt-ui/static
peers: [react]
slots: [data-table]
---

# SiteDataTable

A table of plain data as static HTML: the markup of `Table`, numbers and dates through the shared
format, rows in the order given. The picture of the `DataTable` MDX tag before (or instead of) its
island.

## Signature

```ts
SiteDataTable({ label, columns, rows, locale, className, }: SiteDataTableProps): ReactElement
  label: string  // The table's name; drawn as its caption
  columns: readonly SiteColumn[]
  rows: readonly Readonly<Record<string, string | number>>[]
  locale?: string  // The locale numbers and dates read in
  className?: string
```

`SiteDataTableProps` import from `basalt-ui/static`: `import type { SiteDataTableProps } from 'basalt-ui/static'`.

## Example

```tsx
<SiteDataTable label="Releases" columns={[{ key: 'v', label: 'Version' }, { key: 'kb', label: 'Size', kind: 'number' }]} rows={[{ v: '3.0', kb: 71 }]} />
```
