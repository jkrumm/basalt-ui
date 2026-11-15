import { createFileRoute } from '@tanstack/react-router'
import { TicketsPage } from '../../cycle/state-2/TicketsPage'
import { tickets } from '../../cycle/state-2/tickets-store'

// State cycle 2 (docs/v3/cycles/state-2.md). A route of its own, not a scenario: the scenario route's
// `validateShotSearch` drops every search key but `shot-state`, and this page's state is all in the URL.
export const Route = createFileRoute('/cycle/state-2')({
  staticData: { title: 'Tickets (state cycle 2)' },
  validateSearch: tickets.validateSearch,
  search: { middlewares: tickets.middlewares },
  component: TicketsPage,
})
