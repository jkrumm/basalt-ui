import { createFileRoute } from '@tanstack/react-router'
import { FormsDemoPage } from '../demo/FormsDemoPage'

export const Route = createFileRoute('/forms')({
  staticData: { title: 'Forms' },
  component: FormsDemoPage,
})
