import { createFileRoute } from '@tanstack/react-router'
import { ConnectivityDemoPage } from '../demo/ConnectivityDemoPage'

export const Route = createFileRoute('/connectivity')({
  staticData: { title: 'Connectivity' },
  component: ConnectivityDemoPage,
})
