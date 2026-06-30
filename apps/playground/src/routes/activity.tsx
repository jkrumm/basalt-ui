import { createFileRoute } from '@tanstack/react-router'
import { DashboardPage } from '../demo/DashboardPage'

// Activity reuses the dashboard surface (as the pre-router playground did) — it exists to exercise
// a second Overview destination and the mobile bottom-nav.
export const Route = createFileRoute('/activity')({
  staticData: { title: 'Activity' },
  component: DashboardPage,
})
