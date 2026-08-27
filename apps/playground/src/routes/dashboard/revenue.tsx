import { createFileRoute } from '@tanstack/react-router'
import { dashboardFilters } from '../../demo/dashboard-range-store'
import { generateDashboardData, resolveDateRange } from '../../demo/data'
import { SubPage } from '../../demo/SubPage'

export const Route = createFileRoute('/dashboard/revenue')({
  staticData: { title: 'Revenue' },
  component: RevenuePage,
})

const fmtMoney = (v: number) => `$${v.toFixed(1)}k`

function RevenuePage() {
  // The store field, never `useSearch({ from: '/dashboard' })` — that literal breaks the moment
  // the same component renders under a sibling route (law C10).
  const [range] = dashboardFilters.field.range.use()
  const { series } = generateDashboardData(resolveDateRange(range.preset))
  const totalRevenue = series.reduce((s, d) => s + d.revenue, 0)
  const dailyAverage = totalRevenue / series.length

  return (
    <SubPage
      title="Revenue"
      description="Revenue metrics — MRR, ARPU, LTV, transactions, and subscription growth over time."
      range={dashboardFilters.field.range.options.find((o) => o.value === range.preset)?.label}
      stats={[
        { key: 'total', title: 'Total revenue', value: fmtMoney(totalRevenue) },
        { key: 'avg', title: 'Daily average', value: fmtMoney(dailyAverage) },
      ]}
    />
  )
}
