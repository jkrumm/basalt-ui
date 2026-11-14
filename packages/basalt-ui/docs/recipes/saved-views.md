---
name: saved-views
use-when: a table's search, filters, sort and visible columns are worth naming and coming back to
file: apps/playground/src/recipes/saved-views.tsx
---

Views are the toolbar's: `Views` lists them, saves the current state under a name (the same name overwrites) and resets.
A view stores explicit values, never the page, and lives on the device under `basalt:table-views:<table id>`.
Applying a view writes `?view=<id>`; the id stays only while the table state equals the view, so any edit drops it and leaves the explicit slices.
A view that names a column the table lost is pruned on apply, with a development warning, never rejected.
`field.composite(tableCodec(...))` carries the table in the URL; `view` binds the applied id to the route's own search instead of the address bar.
The saved-view param is `view`; a presentation switch uses another name.
`TableToolbar` and `tableCodec` are imported from `basalt-ui/table` once the table barrel exports them (filed as a signal); until then they come from the built package by path.
A server `ViewStore` (list, save, remove per table) is the typed path to views that follow the person.

```tsx
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, TableToolbar, tableCodec, useDataTable } from 'basalt-ui/table'

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
  const view = {
    id: applied === '' ? undefined : applied,
    set: (id: string | undefined) => (id === undefined ? runs.field.view.clear() : setApplied(id)),
  }
  return (
    <>
      <TableToolbar table={t} view={view} />
      <DataTable table={t} />
    </>
  )
}
```
