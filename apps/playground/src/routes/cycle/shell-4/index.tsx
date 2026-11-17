import { createFileRoute } from '@tanstack/react-router'
import { OverviewPage } from '../../../cycle/shell-4/OverviewPage'
import { overview } from '../../../cycle/shell-4/fleet-store'

// Shell cycle 4 (docs/v3/cycles/shell-4.md), page 1: the fleet overview.
export const Route = createFileRoute('/cycle/shell-4/')({
  staticData: { title: 'Fleet overview' },
  validateSearch: overview.validateSearch,
  search: { middlewares: overview.middlewares },
  component: OverviewPage,
})
