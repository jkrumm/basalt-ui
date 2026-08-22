import { createFileRoute } from '@tanstack/react-router'
import { QueryStateDemoPage } from '../demo/QueryStateDemoPage'

export const Route = createFileRoute('/query-state')({
  staticData: { title: 'Query state' },
  component: QueryStateDemoPage,
})
