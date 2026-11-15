import { QueryClientProvider } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { BasaltProvider } from 'basalt-ui/router'
import type { ReactElement } from 'react'
import { OrdersPage } from '../../cycle/state-3/OrdersPage'
import { live, queryClient } from '../../cycle/state-3/orders-live'
import { orders } from '../../cycle/state-3/orders-store'

/**
 * The stand-in for a v3 entry (`main.tpl`): the playground's root is shared, so the module-level
 * client and `BasaltProvider live` a v3 `main.tsx` holds sit on this route instead. Scaffold, not
 * glue: a v3 app writes these lines once at its entry.
 */
function Entry(): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <BasaltProvider locale="en-GB" live={live}>
        <OrdersPage />
      </BasaltProvider>
    </QueryClientProvider>
  )
}

// State cycle 3 (docs/v3/cycles/state-3.md). A route of its own, not a scenario: the scenario route's
// `validateShotSearch` drops every search key but `shot-state`, and this page's state is all in the URL.
export const Route = createFileRoute('/cycle/state-3')({
  staticData: { title: 'Orders (state cycle 3)' },
  validateSearch: orders.validateSearch,
  search: { middlewares: orders.middlewares },
  component: Entry,
})
