import { createFileRoute } from '@tanstack/react-router'
import { ActivityPage } from '../demo/ActivityPage'

// A small activity-feed recipe exercising Mantine's centrally-themed Timeline (see
// ActivityPage's own JSDoc) — previously this route just reused DashboardPage as a stub.
export const Route = createFileRoute('/activity')({
  staticData: { title: 'Activity' },
  component: ActivityPage,
})
