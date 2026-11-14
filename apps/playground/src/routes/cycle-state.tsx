import { createFileRoute } from '@tanstack/react-router'
import { OrdersPage } from '../cycle/state-1/OrdersPage'
import { orders } from '../cycle/state-1/orders-store'

// State cycle 1 (docs/v3/cycles/state-1.md). A route of its own, not a scenario: the scenario
// route's `validateShotSearch` drops every search key but `shot-state`, and this page's state is
// all in the URL.
export const Route = createFileRoute('/cycle-state')({
  staticData: { title: 'Orders (state cycle)' },
  validateSearch: orders.validateSearch,
  search: { middlewares: orders.middlewares },
  component: OrdersPage,
})
