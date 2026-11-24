---
name: SiteComparison
use when: 'a page weighs a product against its alternatives, trait by trait, with sources'
never when: 'the rows are records a reader sorts or filters (use `DataTable`)'
subpath: basalt-ui/static
peers: [react]
slots: [site-comparison]
---

# SiteComparison

A comparison table for a versus page: compared options as columns, traits as rows, a mark or a
short text per cell, and a footnote slot for the dated sources. The row labels are row headers and
stay pinned at the start edge while a narrow screen scrolls the columns.

## Signature

```ts
SiteComparison({ title, description, caption, rowHeader, columns, rows, yesLabel, noLabel, footnote, className, }: SiteComparisonProps): ReactElement
  title?: ReactNode  // The section's `h2`
  description?: ReactNode
  caption: string  // The table's accessible name ("basalt-ui compared with …"); read by a screen reader, not shown
  rowHeader: string  // The header of the row-label column ("Feature")
  columns: readonly SiteComparisonColumn[]
  rows: readonly SiteComparisonRow[]
  yesLabel: string  // What a `true` cell announces ("Yes")
  noLabel: string  // What a `false` cell announces ("No")
  footnote?: ReactNode  // Under the table: the sources and the date they were checked, as your own markup (a `<time>` in it)
  className?: string
```

`SiteComparisonColumn`, `SiteComparisonRow` import from `basalt-ui/static`: `import type { SiteComparisonColumn, SiteComparisonRow } from 'basalt-ui/static'`.

## Example

```tsx
<SiteComparison
  caption="Planning poker tools compared"
  rowHeader="Feature"
  yesLabel="Yes"
  noLabel="No"
  columns={[{ key: 'fpp', label: 'FPP', ours: true }, { key: 'other', label: 'Other' }]}
  rows={[{ label: 'Free', values: { fpp: true, other: false } }]}
  footnote={<>Checked <time datetime="2026-11-20">20 Nov 2026</time> on each vendor's pricing page.</>}
/>
```
