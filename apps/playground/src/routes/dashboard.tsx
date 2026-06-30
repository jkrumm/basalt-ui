import { createFileRoute } from '@tanstack/react-router'
import { DashboardPage } from '../demo/DashboardPage'

export const Route = createFileRoute('/dashboard')({
  staticData: { title: 'Dashboard' },
  component: DashboardPage,
})
