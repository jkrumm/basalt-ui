// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:saved-views
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
// #endregion

/** The recipe's store, for the route that renders it (`routes/recipes/saved-views.tsx`) to mount. */
export { runs }
