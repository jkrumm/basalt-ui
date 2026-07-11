import { SegmentedControl } from '@mantine/core'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import type { DateRange } from './data'
import { dashboardRange } from './dashboard-range-store'

const RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: '1D', value: '1d' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
]

/** Numeric segment labels read mono per docs/DESIGN-SPEC.md §5 ("Segmented control"). */
const monoLabelStyles = {
  label: { fontFamily: 'var(--basalt-font-mono)', fontSize: 11.5 },
}

/**
 * Persistent header range control (rendered in the shell's `globalActions`, not a per-page
 * `PageActions` slot) — reads/writes the shared `dashboard-range-store`. The store is
 * localStorage-backed (`createPersistedState`), so it renders safely on every route, not just
 * `/dashboard/*`. When the current route IS a dashboard route, a change also updates the `range`
 * URL search param so the visible charts react immediately; on any other route it just persists —
 * `validateSearch`'s localStorage fallback picks it up on the next `/dashboard` visit.
 */
export function DashboardDateFilter() {
  const [range, persist] = dashboardRange.useStore()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const onDashboard = pathname === '/dashboard' || pathname.startsWith('/dashboard/')

  return (
    <SegmentedControl
      size="xs"
      data={RANGE_OPTIONS}
      value={range}
      styles={monoLabelStyles}
      onChange={(v) => {
        const next = v as DateRange
        persist(next)
        if (onDashboard) {
          navigate({ to: pathname, search: (prev) => ({ ...prev, range: next }) })
        }
      }}
    />
  )
}
