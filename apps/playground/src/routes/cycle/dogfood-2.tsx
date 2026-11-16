import { createFileRoute } from '@tanstack/react-router'
import { FlowOverview } from '../../cycle/dogfood-2/FlowOverview'
import { flow } from '../../cycle/dogfood-2/flow-store'

// Dogfood cycle 2 (docs/v3/cycles/dogfood-2.md): the factory console's overview slice, rebuilt on
// cycle 1's fixes. A route of its own because its filters, open Issue and screen live in the URL.
export const Route = createFileRoute('/cycle/dogfood-2')({
  staticData: { title: 'Flow (dogfood cycle 2)' },
  validateSearch: flow.validateSearch,
  search: { middlewares: flow.middlewares },
  component: FlowOverview,
})
