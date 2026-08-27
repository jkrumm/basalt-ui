import { createFileRoute, redirect } from '@tanstack/react-router'
import { dashboardFilters } from '../demo/dashboard-range-store'

// The shell's first destination is the dashboard; `/` has no content of its own.
//
// `linkSearch()` is the store's own click-time reader — the complete stored ⊳ fallback object — so
// this redirect restates NO defaults. Writing `range: stored.range ?? '30d'` here would pin '30d'
// forever the day the store's fallback moves, which is exactly the drift law C10 and the
// `warnLinkPinsFallback` dev warning exist to catch.
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard', search: dashboardFilters.linkSearch() })
  },
})
