import { createFileRoute } from '@tanstack/react-router'
import { ChainView } from 'basalt-ui/cards'
import type { Verdict } from 'basalt-ui/cards'
import { useChartFocus } from 'basalt-ui/charts'
import { ViewTabs } from 'basalt-ui/controls'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import type { ComponentProps, ReactElement } from 'react'
import { TASK_STATE_LABELS, TASK_STATES, TASKS } from '../../demo/plan-chain'
import type { Task, TaskState } from '../../demo/plan-chain'

/** `as` is the presentation of the one dataset: a flat table, the nested table or the chain. */
const store = defineControls({
  id: 'kit-chain',
  scope: 'page',
  fields: {
    as: field
      .enum(['table', 'nested', 'chain'], 'chain')
      .labels({ table: 'Table', nested: 'Nested', chain: 'Chain' }),
  },
})

const tabs: NonNullable<ComponentProps<typeof PageBar>['tabs']> = {
  kind: 'controls-slot',
  count: 1,
  render: () => <ViewTabs state={store.field.as} label="Plan view" />,
}

// Only work under way earns a hue; waiting is the common state and stays neutral.
const TONE: Readonly<Record<TaskState, Verdict['tone']>> = {
  done: 'good',
  running: 'info',
  queued: 'neutral',
  waiting: 'neutral',
}

const c = col<Task>()

const titleOf = new Map(TASKS.map((t) => [t.id, t.title]))

const columns = [
  c.entity('title', { header: 'Task', sub: (t) => t.id, subMono: true }),
  c.status('state', {
    header: 'State',
    options: TASK_STATES,
    labels: TASK_STATE_LABELS,
    tone: (state) => TONE[state],
    filter: 'multi',
  }),
  c.text('team', { header: 'Team', priority: 2 }),
  c.custom('waits', {
    header: 'Waits on',
    priority: 3,
    card: 'meta',
    sortValue: (t) => t.waitsOn.length,
    render: (t) => t.waitsOn.map((id) => titleOf.get(id) ?? id).join(', '),
  }),
  c.number('days', { header: 'Days left', priority: 2 }),
]

/** One dataset, three views: the table, the same table nested under each task's first blocker, and the chain. */
function ChainRoute(): ReactElement {
  const [as] = store.field.as.use()
  const focus = useChartFocus(TASKS, { announce: (t) => `${t.id} ${t.title}` })
  const table = useDataTable({
    id: 'kit-chain-tasks',
    label: 'Tasks',
    columns,
    data: TASKS,
    getRowId: (t) => t.id,
    mode: { kind: 'client' },
    ...(as === 'nested' && { nested: { parentOf: (t: Task) => t.waitsOn[0] } }),
  })
  return (
    <Page area="kit-chain">
      <PageBar title="Migration plan" tabs={tabs} />
      {as === 'chain' && (
        <Section title="What blocks what">
          <ChainView
            label="Migration plan"
            nodes={TASKS}
            getId={(t) => t.id}
            waitsOn={(t) => t.waitsOn}
            face={(t) => ({
              title: t.title,
              sub: `${t.id} · ${t.team}`,
              status: { tone: TONE[t.state], label: TASK_STATE_LABELS[t.state] },
              done: t.state === 'done',
            })}
            focus={focus}
          />
        </Section>
      )}
      <Section title="Tasks">
        <DataTable table={table} focus={focus} />
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/kit/chain')({
  staticData: { title: 'Dependency chain' },
  validateSearch: store.validateSearch,
  search: { middlewares: store.middlewares },
  component: ChainRoute,
})
