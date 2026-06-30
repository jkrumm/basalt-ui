import { createFileRoute } from '@tanstack/react-router'
import { RouterDemoPage } from '../demo/RouterDemoPage'

export const Route = createFileRoute('/router')({
  staticData: { title: 'Router' },
  component: RouterDemoPage,
})
