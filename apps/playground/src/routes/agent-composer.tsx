import { createFileRoute } from '@tanstack/react-router'
import { AgentComposerDemoPage } from '../demo/AgentComposerDemoPage'

export const Route = createFileRoute('/agent-composer')({
  staticData: { title: 'Agent composer' },
  component: AgentComposerDemoPage,
})
