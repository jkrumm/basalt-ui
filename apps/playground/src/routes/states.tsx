import { createFileRoute } from '@tanstack/react-router'
import { StatesPage } from '../demo/StatesPage'

export const Route = createFileRoute('/states')({
  staticData: { title: 'States' },
  component: StatesPage,
})
