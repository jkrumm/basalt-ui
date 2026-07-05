import { SegmentedControl } from '@mantine/core'
import { PageActions } from 'basalt-ui'
import { useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import type { DateRange } from './data'
import { dashboardRange } from './dashboard-range-store'

const RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: '1D', value: '1d' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
]

/** Renders in the shell header via `PageActions` — reads and writes the `range`
 *  search param (default from persisted store) on the parent `/dashboard` route.
 *  Changes are persisted to localStorage via `createPersistedState` so the
 *  selection survives navigation away from and back to `/dashboard/*`. */
export function DashboardDateFilter() {
  const { range } = useSearch({ from: '/dashboard' })
  const [, persist] = dashboardRange.useStore()
  const navigate = useNavigate()
  const router = useRouter()

  return (
    <PageActions>
      <SegmentedControl
        size="xs"
        data={RANGE_OPTIONS}
        value={range}
        onChange={(v) => {
          const next = v as DateRange
          persist(next)
          navigate({
            to: router.state.location.pathname,
            search: (prev) => ({ ...prev, range: next }),
          })
        }}
      />
    </PageActions>
  )
}
