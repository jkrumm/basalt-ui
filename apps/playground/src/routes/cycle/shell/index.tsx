import { createFileRoute } from '@tanstack/react-router'
import { OverviewPage } from '../../../cycle/shell-1/OverviewPage'
import { overview } from '../../../cycle/shell-1/fleet-store'

// Shell cycle 1 (docs/v3/cycles/shell-1.md), page 1: the fleet overview.
export const Route = createFileRoute('/cycle/shell/')({
  staticData: { title: 'Fleet overview' },
  validateSearch: overview.validateSearch,
  search: { middlewares: overview.middlewares },
  component: OverviewPage,
})
