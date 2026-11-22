---
name: view-switch
use-when: one dataset shows as a dependency chain, nested rows or a table and the visitor can link to each
---

A presentation is state, never a second query: `ViewTabs` writes the `as` param, one `useDataTable` serves the table and the nested rows, and one `useChartFocus` makes a chain node and its row one item.
It is a recipe, not a `ChainView` prop: the tabs live in the page bar's `tabs` slot, the store is the page's, and only the app writes the columns. Name the field `as`, not `view`: `view` is the saved-view param of the table, and two fields on one param throw. A table, a list, a board or a gallery of one record set is no recipe: pass `useDataTable({ layouts: ['table', 'list', 'board', 'gallery'] })` and `PageBar layout={useTableViews(t).layout}`; the view saves its layout, and `DataTable` draws it from the columns' card slots. A board stands on a `c.select` column (a drop calls its `commit`, rolled back on a rejection) and moves by drag given `DataTable drag` (`drag` from `basalt-ui/ui/sortable-list`); a server table offers no board, and a server gallery pages.

```tsx
import { ChainView } from 'basalt-ui/cards'
import { useChartFocus } from 'basalt-ui/charts'
import { ViewTabs } from 'basalt-ui/controls'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
type Task = { id: string; title: string; done: boolean; waitsOn: readonly string[] }
const as = field.enum(['chain', 'nested', 'table'], 'chain')
const plan = defineControls({
  id: 'plan',
  scope: 'page',
  fields: { as: as.labels({ chain: 'Chain', nested: 'Nested', table: 'Table' }) },
})
const tabs = {
  kind: 'controls-slot',
  count: 1,
  render: () => <ViewTabs state={plan.field.as} label="Plan view" />,
} as const
export function Plan({ tasks }: { tasks: readonly Task[] }) {
  const [view] = plan.field.as.use()
  const focus = useChartFocus(tasks, { announce: (t) => t.title })
  const table = useDataTable({
    id: 'plan-tasks',
    label: 'Tasks',
    columns: [col<Task>().entity('title', { header: 'Task', sub: (t) => t.id, subMono: true })],
    data: tasks,
    getRowId: (t) => t.id,
    mode: { kind: 'client' },
    ...(view === 'nested' && { nested: { parentOf: (t: Task) => t.waitsOn[0] } }),
  })
  return (
    <Page area="plan">
      <PageBar title="Plan" tabs={tabs} />
      <Section title={view === 'chain' ? 'What blocks what' : 'Tasks'}>
        {view === 'chain' ? (
          <ChainView
            label="Plan"
            nodes={tasks}
            getId={(t) => t.id}
            waitsOn={(t) => t.waitsOn}
            face={(t) => ({ title: t.title, sub: t.id, done: t.done })}
            focus={focus}
          />
        ) : (
          <DataTable table={table} focus={focus} />
        )}
      </Section>
    </Page>
  )
}
```
