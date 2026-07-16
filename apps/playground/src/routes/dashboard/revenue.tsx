import { createFileRoute, useSearch } from '@tanstack/react-router'
import { generateDashboardData } from '../../demo/data'
import { SubPage } from '../../demo/SubPage'

export const Route = createFileRoute('/dashboard/revenue')({
  staticData: { title: 'Revenue' },
  component: RevenuePage,
})

const RANGE_LABEL: Record<string, string> = { '1d': 'Last 24h', '7d': 'Last 7d', '30d': 'Last 30d' }

const fmtMoney = (v: number) => `$${v.toFixed(1)}k`

function RevenuePage() {
  const { range } = useSearch({ from: '/dashboard' })
  const { series } = generateDashboardData(range)
  const totalRevenue = series.reduce((s, d) => s + d.revenue, 0)
  const dailyAverage = totalRevenue / series.length

  return (
    <SubPage
      title="Revenue"
      description="Revenue metrics — MRR, ARPU, LTV, transactions, and subscription growth over time."
      range={RANGE_LABEL[range]}
      stats={[
        { key: 'total', label: 'Total revenue', value: fmtMoney(totalRevenue) },
        { key: 'avg', label: 'Daily average', value: fmtMoney(dailyAverage) },
      ]}
    />
  )
}
