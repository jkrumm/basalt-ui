import { createFileRoute } from '@tanstack/react-router'
import { OverviewPage } from '../../../cycle/shell-5/OverviewPage'
import { overview } from '../../../cycle/shell-5/fleet-store'

// Shell cycle 5 (docs/v3/cycles/shell-5.md), page 1: the fleet overview.
export const Route = createFileRoute('/cycle/shell-5/')({
  staticData: { title: 'Fleet overview' },
  validateSearch: overview.validateSearch,
  search: { middlewares: overview.middlewares },
  component: OverviewPage,
})
