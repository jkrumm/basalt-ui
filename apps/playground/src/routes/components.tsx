import { createFileRoute } from '@tanstack/react-router'
import { ComponentsPage } from '../demo/ComponentsPage'

export const Route = createFileRoute('/components')({
  staticData: { title: 'Components' },
  component: ComponentsPage,
})
