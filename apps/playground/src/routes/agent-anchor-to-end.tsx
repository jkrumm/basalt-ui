import { createFileRoute } from '@tanstack/react-router'
import { AgentAnchorToEndDemoPage } from '../demo/AgentAnchorToEndDemoPage'

export const Route = createFileRoute('/agent-anchor-to-end')({
  staticData: { title: 'Agent anchor to end' },
  component: AgentAnchorToEndDemoPage,
})
