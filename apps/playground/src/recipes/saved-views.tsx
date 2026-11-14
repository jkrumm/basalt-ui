// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// `TableToolbar` and `tableCodec` are typed from the built package by `saved-views-shim.d.ts`.
// #region recipe:saved-views
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
// #endregion
