import { createFileRoute } from '@tanstack/react-router'
import { ChartsPrimitivesPage } from '../demo/ChartsPrimitivesPage'

export const Route = createFileRoute('/charts-primitives')({
  staticData: { title: 'Charts primitives' },
  component: ChartsPrimitivesPage,
})
