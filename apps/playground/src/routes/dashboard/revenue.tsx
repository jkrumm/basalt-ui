import { createFileRoute } from '@tanstack/react-router'
import { SubPage } from '../../demo/SubPage'

export const Route = createFileRoute('/dashboard/revenue')({
  staticData: { title: 'Revenue' },
  component: RevenuePage,
})

function RevenuePage() {
  return (
    <SubPage
      title="Revenue"
      description="Revenue metrics — MRR, ARPU, LTV, transactions, and subscription growth over time."
    />
  )
}
