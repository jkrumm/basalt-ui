import { createFileRoute } from '@tanstack/react-router'
import { SubPage } from '../../demo/SubPage'

export const Route = createFileRoute('/dashboard/traffic')({
  staticData: { title: 'Traffic' },
  component: TrafficPage,
})

function TrafficPage() {
  return (
    <SubPage
      title="Traffic"
      description="Traffic sources and channel breakdown — direct, organic, referral, social, and paid."
    />
  )
}
