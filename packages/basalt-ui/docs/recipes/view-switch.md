---
name: view-switch
use-when: one dataset shows as a table or as cards and the visitor can link to either
file: apps/playground/src/recipes/view-switch.tsx
---

A presentation is state, never a second query: `ViewTabs` writes the `as` param and one `useDataTable` serves both.
`DataTable` with `cardsBelow: 'always'` forces the card tier at every width; `'regular'` keeps the table above the phone tier.
The cards are the table's own card plan, so a column that has a slot in one has it in the other and nothing is lost.
Name the field `as`, not `view`: `view` is the saved-view param of the table, and two fields on one param throw.
The tabs go in the `controls` slot of the `Section` that frames the table, never beside it.
Add the option to the enum and read `as` where the page branches; the query key never sees it.

```tsx
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
```
