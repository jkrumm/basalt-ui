import { createFileRoute } from '@tanstack/react-router'
import { FlowOverview } from '../../cycle/dogfood-1/FlowOverview'
import { flow } from '../../cycle/dogfood-1/flow-store'

// Dogfood cycle 1 (docs/v3/cycles/dogfood-1.md): the factory console's overview slice. A route of
// its own, under routes/cycle/, because its filters, open Issue and screen live in the URL.
export const Route = createFileRoute('/cycle/dogfood')({
  staticData: { title: 'Flow (dogfood cycle)' },
  validateSearch: flow.validateSearch,
  search: { middlewares: flow.middlewares },
  component: FlowOverview,
})
