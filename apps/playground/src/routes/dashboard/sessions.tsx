import { createFileRoute, useSearch } from '@tanstack/react-router'
import { SubPage } from '../../demo/SubPage'

export const Route = createFileRoute('/dashboard/sessions')({
  staticData: { title: 'Sessions' },
  component: SessionsPage,
})

const RANGE_LABEL: Record<string, string> = { '1d': 'Last 24h', '7d': 'Last 7d', '30d': 'Last 30d' }

function SessionsPage() {
  const { range } = useSearch({ from: '/dashboard' })
  return (
    <SubPage
      title="Sessions"
      description="Detailed session analytics — active users, duration, bounce rate, and entry/exit pages."
      range={RANGE_LABEL[range]}
    />
  )
}
