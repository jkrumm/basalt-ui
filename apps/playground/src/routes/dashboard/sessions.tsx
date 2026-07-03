import { createFileRoute } from '@tanstack/react-router'
import { SubPage } from '../../demo/SubPage'

export const Route = createFileRoute('/dashboard/sessions')({
  staticData: { title: 'Sessions' },
  component: SessionsPage,
})

function SessionsPage() {
  return (
    <SubPage
      title="Sessions"
      description="Detailed session analytics — active users, duration, bounce rate, and entry/exit pages."
    />
  )
}
