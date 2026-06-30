import { createFileRoute } from '@tanstack/react-router'
import { DataDemoPage } from '../demo/DataDemoPage'

export const Route = createFileRoute('/data')({
  staticData: { title: 'Data' },
  component: DataDemoPage,
})
