// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:view-switch
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
// #endregion

/** The recipe's store, for the routes that render it (`/kit/chain`, `/recipes/view-switch`) to mount. */
export { plan }
