import { createSearchParamStore } from 'basalt-ui/router-tanstack'
import type { DateRange } from './data'

/**
 * Shared store for the dashboard date-range filter. `validateSearch` goes on
 * `routes/dashboard.tsx`; `useStore()` is called in `DashboardDateFilter`.
 *
 * When `?range=` is absent from the URL, `validateSearch` falls back to
 * localStorage (`basalt:dashboard-range`), then to the factory default `30d`.
 * Changing the range persists to localStorage so the selection survives
 * navigation away from and back to any `/dashboard/*` page.
 */
export const dashboardRange = createSearchParamStore({
  key: 'dashboard-range',
  param: 'range',
  values: ['1d', '7d', '30d'] as const,
  fallback: '30d' as DateRange,
})
