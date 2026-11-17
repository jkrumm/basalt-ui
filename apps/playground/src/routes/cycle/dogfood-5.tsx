import { createFileRoute } from '@tanstack/react-router'
import { Overview } from '../../cycle/dogfood-5/Overview'
import { overview } from '../../cycle/dogfood-5/overview-store'

// Dogfood cycle 5 (docs/v3/cycles/dogfood-5.md): the factory console's Overview slice, rebuilt on
// cycle 4's fixes. One route, one store: the chart card's widget owns its choice on it.
export const Route = createFileRoute('/cycle/dogfood-5')({
  staticData: { title: 'Overview (dogfood cycle 5)' },
  validateSearch: overview.validateSearch,
  search: { middlewares: overview.middlewares },
  component: Overview,
})
