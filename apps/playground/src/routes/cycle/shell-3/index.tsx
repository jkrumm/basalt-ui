import { createFileRoute } from '@tanstack/react-router'
import { OverviewPage } from '../../../cycle/shell-3/OverviewPage'
import { overview } from '../../../cycle/shell-3/fleet-store'

// Shell cycle 3 (docs/v3/cycles/shell-3.md), page 1: the fleet overview.
export const Route = createFileRoute('/cycle/shell-3/')({
  staticData: { title: 'Fleet overview' },
  validateSearch: overview.validateSearch,
  search: { middlewares: overview.middlewares },
  component: OverviewPage,
})
