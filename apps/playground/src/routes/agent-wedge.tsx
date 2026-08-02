import { createFileRoute } from '@tanstack/react-router'
import { AgentWedgeDemoPage } from '../demo/AgentWedgeDemoPage'

export const Route = createFileRoute('/agent-wedge')({
  staticData: { title: 'Agent wedge recovery' },
  component: AgentWedgeDemoPage,
})
