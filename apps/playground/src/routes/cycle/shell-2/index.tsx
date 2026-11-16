import { createFileRoute } from '@tanstack/react-router'
import { OverviewPage } from '../../../cycle/shell-2/OverviewPage'
import { overview } from '../../../cycle/shell-2/fleet-store'
import { SCREENS } from '../../../cycle/shell-2/route-screens'

// Shell cycle 2 (docs/v3/cycles/shell-2.md), page 1: the fleet overview.
export const Route = createFileRoute('/cycle/shell-2/')({
  ...SCREENS,
  staticData: { title: 'Fleet overview' },
  validateSearch: overview.validateSearch,
  search: { middlewares: overview.middlewares },
  component: OverviewPage,
})
