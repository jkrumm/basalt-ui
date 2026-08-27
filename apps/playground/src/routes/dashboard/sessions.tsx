import { createFileRoute } from '@tanstack/react-router'
import { dashboardFilters } from '../../demo/dashboard-range-store'
import { generateDashboardData, resolveDateRange } from '../../demo/data'
import { SubPage } from '../../demo/SubPage'

export const Route = createFileRoute('/dashboard/sessions')({
  staticData: { title: 'Sessions' },
  component: SessionsPage,
})

const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US')

function SessionsPage() {
  const [range] = dashboardFilters.field.range.use()
  const { series } = generateDashboardData(resolveDateRange(range.preset))
  const totalSessions = series.reduce((s, d) => s + d.sessions, 0)
  const dailyAverage = totalSessions / series.length

  return (
    <SubPage
      title="Sessions"
      description="Detailed session analytics — active users, duration, bounce rate, and entry/exit pages."
      range={dashboardFilters.field.range.options.find((o) => o.value === range.preset)?.label}
      stats={[
        { key: 'total', title: 'Total sessions', value: fmtInt(totalSessions) },
        { key: 'avg', title: 'Daily average', value: fmtInt(dailyAverage) },
      ]}
    />
  )
}
