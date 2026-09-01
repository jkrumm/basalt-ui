import { createFileRoute } from '@tanstack/react-router'
import { ChartsStressPage } from '../demo/ChartsStressPage'

export const Route = createFileRoute('/charts-stress')({
  staticData: { title: 'Charts stress' },
  component: ChartsStressPage,
})
