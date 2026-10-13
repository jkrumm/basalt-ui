import { createFileRoute } from '@tanstack/react-router'
import { ChartsPage } from '../demo/ChartsPage'
import { chartViews } from '../demo/charts-store'

export const Route = createFileRoute('/charts')({
  staticData: { title: 'Charts' },
  validateSearch: chartViews.validateSearch,
  component: ChartsPage,
})
