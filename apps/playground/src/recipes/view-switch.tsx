// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:view-switch
import type { ComponentProps } from 'react'
import { ViewTabs } from 'basalt-ui/controls'
import { PageBar } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, useDataTable } from 'basalt-ui/table'

type Run = { id: string; name: string; km: number }
const c = col<Run>()

// `as` is the presentation; `view` is the table's saved-view param, so it stays free.
const runs = defineControls({
  id: 'runs',
  scope: 'page',
  fields: {
    as: field.enum(['table', 'cards'], 'table').labels({ table: 'Table', cards: 'Cards' }),
  },
})

const tabs: NonNullable<ComponentProps<typeof PageBar>['tabs']> = {
  kind: 'controls-slot',
  count: 1,
  render: () => <ViewTabs handle={runs.field.as} label="Runs view" />,
}

export function Runs({ data }: { data: readonly Run[] }) {
  const [as] = runs.field.as.use()
  const t = useDataTable({
    id: 'runs',
    label: 'Runs',
    columns: [c.entity('name'), c.number('km', { unit: 'km' })],
    data,
    getRowId: (run) => run.id,
    mode: { kind: 'client' },
    cardsBelow: as === 'cards' ? 'always' : 'regular',
  })
  return (
    <>
      <PageBar tabs={tabs} />
      <DataTable table={t} />
    </>
  )
}
// #endregion
