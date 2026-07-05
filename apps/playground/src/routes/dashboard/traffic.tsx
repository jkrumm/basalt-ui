import { createFileRoute, useSearch } from '@tanstack/react-router'
import { SubPage } from '../../demo/SubPage'

export const Route = createFileRoute('/dashboard/traffic')({
  staticData: { title: 'Traffic' },
  component: TrafficPage,
})

const RANGE_LABEL: Record<string, string> = { '1d': 'Last 24h', '7d': 'Last 7d', '30d': 'Last 30d' }

function TrafficPage() {
  const { range } = useSearch({ from: '/dashboard' })
  return (
    <SubPage
      title="Traffic"
      description="Traffic sources and channel breakdown — direct, organic, referral, social, and paid."
      range={RANGE_LABEL[range]}
    />
  )
}
