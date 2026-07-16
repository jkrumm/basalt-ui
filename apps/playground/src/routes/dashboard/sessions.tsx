import { createFileRoute, useSearch } from '@tanstack/react-router'
import { generateDashboardData } from '../../demo/data'
import { SubPage } from '../../demo/SubPage'

export const Route = createFileRoute('/dashboard/sessions')({
  staticData: { title: 'Sessions' },
  component: SessionsPage,
})

const RANGE_LABEL: Record<string, string> = { '1d': 'Last 24h', '7d': 'Last 7d', '30d': 'Last 30d' }

const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US')

function SessionsPage() {
  const { range } = useSearch({ from: '/dashboard' })
  const { series } = generateDashboardData(range)
  const totalSessions = series.reduce((s, d) => s + d.sessions, 0)
  const dailyAverage = totalSessions / series.length

  return (
    <SubPage
      title="Sessions"
      description="Detailed session analytics — active users, duration, bounce rate, and entry/exit pages."
      range={RANGE_LABEL[range]}
      stats={[
        { key: 'total', label: 'Total sessions', value: fmtInt(totalSessions) },
        { key: 'avg', label: 'Daily average', value: fmtInt(dailyAverage) },
      ]}
    />
  )
}
