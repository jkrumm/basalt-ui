import { createFileRoute, useSearch } from '@tanstack/react-router'
import { SubPage } from '../../demo/SubPage'

export const Route = createFileRoute('/dashboard/revenue')({
  staticData: { title: 'Revenue' },
  component: RevenuePage,
})

const RANGE_LABEL: Record<string, string> = { '1d': 'Last 24h', '7d': 'Last 7d', '30d': 'Last 30d' }

function RevenuePage() {
  const { range } = useSearch({ from: '/dashboard' })
  return (
    <SubPage
      title="Revenue"
      description="Revenue metrics — MRR, ARPU, LTV, transactions, and subscription growth over time."
      range={RANGE_LABEL[range]}
    />
  )
}
