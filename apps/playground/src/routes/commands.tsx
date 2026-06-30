import { createFileRoute } from '@tanstack/react-router'
import { CommandsDemoPage } from '../demo/CommandsDemoPage'

export const Route = createFileRoute('/commands')({
  staticData: { title: 'Commands' },
  component: CommandsDemoPage,
})
