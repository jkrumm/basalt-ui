import { createFileRoute } from '@tanstack/react-router'
import { FlowOverview } from '../../../cycle/dogfood-3/FlowOverview'
import { cards } from '../../../cycle/dogfood-3/flow-store'

// Dogfood cycle 3: the page itself, under the layout route that mounts the page store.
export const Route = createFileRoute('/cycle/dogfood-3/')({
  staticData: { title: 'Flow (dogfood cycle 3)' },
  validateSearch: cards.validateSearch,
  search: { middlewares: cards.middlewares },
  component: FlowOverview,
})
