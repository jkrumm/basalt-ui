import { createFileRoute } from '@tanstack/react-router'
import { MirroredBarsDemoPage } from '../demo/MirroredBarsDemoPage'

export const Route = createFileRoute('/mirrored-bars')({
  staticData: { title: 'Mirrored bars' },
  component: MirroredBarsDemoPage,
})
