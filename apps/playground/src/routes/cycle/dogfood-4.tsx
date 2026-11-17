import { createFileRoute } from '@tanstack/react-router'
import { Overview } from '../../cycle/dogfood-4/Overview'
import { overview } from '../../cycle/dogfood-4/overview-store'

// Dogfood cycle 4 (docs/v3/cycles/dogfood-4.md): the factory console's Overview slice, rebuilt on
// cycle 3's fixes. One route, one store: the chart card's widget owns its choice on it.
export const Route = createFileRoute('/cycle/dogfood-4')({
  staticData: { title: 'Overview (dogfood cycle 4)' },
  validateSearch: overview.validateSearch,
  search: { middlewares: overview.middlewares },
  component: Overview,
})
