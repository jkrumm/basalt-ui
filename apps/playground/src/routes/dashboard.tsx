import { Outlet, createFileRoute } from '@tanstack/react-router'
import { dashboardRange } from '../demo/dashboard-range-store'

// The date-range control itself now lives in the shell's persistent `globalActions`
// (see routes/__root.tsx) instead of a per-page `PageActions` slot — this layout only
// needs to own the `range` search-param validation for its subtree.
export const Route = createFileRoute('/dashboard')({
  staticData: { title: 'Dashboard' },
  validateSearch: dashboardRange.validateSearch,
  component: Outlet,
})
