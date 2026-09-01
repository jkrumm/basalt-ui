import { createFileRoute } from '@tanstack/react-router'
import { PrimitivesPage } from '../demo/PrimitivesPage'

export const Route = createFileRoute('/primitives')({
  staticData: { title: 'Primitives' },
  component: PrimitivesPage,
})
