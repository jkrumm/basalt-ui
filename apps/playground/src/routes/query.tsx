import { createFileRoute } from '@tanstack/react-router'
import { QueryDemoPage } from '../demo/QueryDemoPage'

export const Route = createFileRoute('/query')({
  staticData: { title: 'Query' },
  component: QueryDemoPage,
})
