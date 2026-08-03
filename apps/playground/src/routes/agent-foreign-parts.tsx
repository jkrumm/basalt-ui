import { createFileRoute } from '@tanstack/react-router'
import { AgentForeignPartsDemoPage } from '../demo/AgentForeignPartsDemoPage'

export const Route = createFileRoute('/agent-foreign-parts')({
  staticData: { title: 'Agent foreign parts' },
  component: AgentForeignPartsDemoPage,
})
