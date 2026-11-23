---
name: saved-views
use-when: a table's search, filters, sort, columns, widths, row height and grouping are worth naming and coming back to
---

On a list page, `useTableViews(t)` puts the views, the table's search and its filter in the `PageBar` view row: `tabs={views.tabs}`, `search={views.search}`, `controls={views.controls}`, `layout={views.layout}`, `settings={views.settings}`, `{views.chips}` under the bar and `{views.panel}` once on the page; the page draws no `TableToolbar`. In a card, `TableToolbar` draws the same tabs and panel; pass `views={false}` where the page bar holds them, or the panel opens twice.
`?view=<id>` names the applied view. An edit keeps it and the tab reads modified until Save or Discard. A named view applies on load only over a request with no search or filter, so a link with its own slices keeps them.
A default view opens a bare address; the declared table is then `?view=all`, an id no saved view gets.
Views live on the device under `basalt:table-views:<table id>` (envelope 2; a version 1 list migrates as it is). `views: { store }` on `useDataTable` keeps them in a `ViewStore`; `reorder`, `share` and `count` are capabilities, and each one missing removes its control. A refused write leaves the list as it was and the strip says so.
`onExport` adds Export to the tab menu and the panel; the file itself is `export.md`.

```tsx
import { Page, PageBar } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, tableCodec, useDataTable, useTableViews } from 'basalt-ui/table'

type Run = { id: string; name: string; km: number }
const c = col<Run>()

const runs = defineControls({
  id: 'runs-views',
  scope: 'page',
  fields: {
    table: field.composite(tableCodec(c.codec({ name: 'entity', km: 'number' }))),
    view: field.string(''),
  },
})

export function Runs({ data }: { data: readonly Run[] }) {
  const [applied, setApplied] = runs.field.view.use()
  const t = useDataTable({
    id: 'runs',
    label: 'Runs',
    columns: [c.entity('name', { filter: 'text' }), c.number('km', { unit: 'km' })],
    data,
    getRowId: (run) => run.id,
    mode: { kind: 'client' },
    state: runs.field.table,
  })
  const views = useTableViews(t, {
    view: {
      id: applied === '' ? undefined : applied,
      set: (id) => (id === undefined ? runs.field.view.clear() : setApplied(id)),
    },
  })
  return (
    <Page area="runs" fill>
      <PageBar
        tabs={views.tabs}
        search={views.search}
        controls={views.controls}
        settings={views.settings}
      />
      {views.chips}
      <DataTable table={t} />
      {views.panel}
    </Page>
  )
}
```
