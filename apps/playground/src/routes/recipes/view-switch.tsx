import { createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { TASKS } from '../../demo/plan-chain'
import { Plan, plan } from '../../recipes/view-switch'

const tasks = TASKS.map((t) => ({ ...t, done: t.state === 'done' }))

/** The view-switch recipe as a page: its page bar tabs switch the plan between chain, nested rows and table. */
function ViewSwitchRoute(): ReactElement {
  return <Plan tasks={tasks} />
}

export const Route = createFileRoute('/recipes/view-switch')({
  staticData: { title: 'View switch' },
  validateSearch: plan.validateSearch,
  search: { middlewares: plan.middlewares },
  component: ViewSwitchRoute,
})
