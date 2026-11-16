import { QueryClientProvider } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { BasaltProvider } from 'basalt-ui/router'
import type { ReactElement } from 'react'
import { InvoicesPage } from '../../cycle/state-4/InvoicesPage'
import { live, queryClient } from '../../cycle/state-4/invoices-live'
import { invoices } from '../../cycle/state-4/invoices-store'

/**
 * The stand-in for a v3 entry (`main.tpl`): the playground's root is shared, so the module-level
 * client and `BasaltProvider live` a v3 `main.tsx` holds sit on this route instead. Scaffold, not
 * glue: a v3 app writes these lines once at its entry.
 */
function Entry(): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <BasaltProvider locale="en-GB" live={live}>
        <InvoicesPage />
      </BasaltProvider>
    </QueryClientProvider>
  )
}

// State cycle 4 (docs/v3/cycles/state-4.md). A route of its own, not a scenario: the scenario route's
// `validateShotSearch` drops every search key but `shot-state` and `fixture`, and this page's state is all in the URL.
export const Route = createFileRoute('/cycle/state-4')({
  staticData: { title: 'Invoices (state cycle 4)' },
  validateSearch: invoices.validateSearch,
  search: { middlewares: invoices.middlewares },
  component: Entry,
})
