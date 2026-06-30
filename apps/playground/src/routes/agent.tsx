import { createFileRoute } from '@tanstack/react-router'
import { AgentDemoPage } from '../demo/AgentDemoPage'

export const Route = createFileRoute('/agent')({
  staticData: { title: 'Agent' },
  component: AgentDemoPage,
})
