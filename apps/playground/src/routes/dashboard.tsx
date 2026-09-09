import { Outlet, createFileRoute } from '@tanstack/react-router'
import { dashboardFilters } from '../demo/dashboard-range-store'

// This layout route owns the search VALIDATION for its subtree — so every `/dashboard/*` page and
// every link into one resolve the store's whole field set the same way (docs/CONTROLS-SPEC.md §4),
// the bar's four and the aside's three alike, with no count restated here — and deliberately
// renders no `PageBar` of its own: a page has exactly one (law C6), and the pages below want
// different ones. The index page carries the full bar (actions + sync + four filters); the three
// sub-pages carry just the range filter, through `demo/SubPage.tsx`.
export const Route = createFileRoute('/dashboard')({
  staticData: { title: 'Dashboard' },
  validateSearch: dashboardFilters.validateSearch,
  component: Outlet,
})
