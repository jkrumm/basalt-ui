import { Outlet, createFileRoute } from '@tanstack/react-router'
import { flow } from '../../cycle/dogfood-3/flow-store'

// Dogfood cycle 3 (docs/v3/cycles/dogfood-3.md): the factory console's overview slice, rebuilt on
// cycle 2's fixes. The page store's filters, open Issue and screen live in the URL; the chart
// card's widget store needs a second route under this one (dogfood-3.1).
export const Route = createFileRoute('/cycle/dogfood-3')({
  validateSearch: flow.validateSearch,
  search: { middlewares: flow.middlewares },
  component: Outlet,
})
