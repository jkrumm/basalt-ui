import { createFileRoute } from '@tanstack/react-router'
import { Route as ParentRoute } from '../dashboard'
import { DashboardPage } from '../../demo/DashboardPage'

function DashboardIndex() {
  const { range } = ParentRoute.useSearch()
  return <DashboardPage range={range} />
}

export const Route = createFileRoute('/dashboard/')({
  staticData: { title: 'Dashboard' },
  component: DashboardIndex,
})
