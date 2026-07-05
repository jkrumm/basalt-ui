import { Outlet, createFileRoute } from '@tanstack/react-router'
import { DashboardDateFilter } from '../demo/DashboardDateFilter'
import { dashboardRange } from '../demo/dashboard-range-store'

function DashboardLayout() {
  return (
    <>
      <DashboardDateFilter />
      <Outlet />
    </>
  )
}

export const Route = createFileRoute('/dashboard')({
  staticData: { title: 'Dashboard' },
  validateSearch: dashboardRange.validateSearch,
  component: DashboardLayout,
})
