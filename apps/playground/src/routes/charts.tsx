import { createFileRoute } from '@tanstack/react-router'
import { ChartsPage } from '../demo/ChartsPage'

export const Route = createFileRoute('/charts')({
  staticData: { title: 'Charts' },
  component: ChartsPage,
})
