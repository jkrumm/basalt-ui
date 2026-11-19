import { createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { TASKS } from '../../demo/plan-chain'
import { Plan, plan } from '../../recipes/view-switch'

const tasks = TASKS.map((t) => ({ ...t, done: t.state === 'done' }))

/** One dataset, three views, through the view-switch recipe: the chain, the nested rows and the table. */
function ChainRoute(): ReactElement {
  return <Plan tasks={tasks} />
}

export const Route = createFileRoute('/kit/chain')({
  staticData: { title: 'Dependency chain' },
  validateSearch: plan.validateSearch,
  search: { middlewares: plan.middlewares },
  component: ChainRoute,
})
