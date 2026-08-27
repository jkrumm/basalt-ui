import { createFileRoute } from '@tanstack/react-router'
import { DashboardPage } from '../../demo/DashboardPage'

// No search plumbing: the page reads its filter state through the store's own hooks, which read
// the merged search of every matched route — so it needs no `from` and takes no search props.
export const Route = createFileRoute('/dashboard/')({
  staticData: { title: 'Analytics' },
  component: DashboardPage,
})
