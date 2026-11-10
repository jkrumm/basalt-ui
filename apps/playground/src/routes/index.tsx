import { createFileRoute } from '@tanstack/react-router'
import { ScenarioIndex } from '../demo/ScenarioIndex'

// The landing page lists the scenarios.
export const Route = createFileRoute('/')({
  staticData: { title: 'Playground' },
  component: ScenarioIndex,
})
