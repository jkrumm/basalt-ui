import { createFileRoute } from '@tanstack/react-router'
import { AgentToolLifecycleDemoPage } from '../demo/AgentToolLifecycleDemoPage'

export const Route = createFileRoute('/agent-tool-lifecycle')({
  staticData: { title: 'Agent tool lifecycle' },
  component: AgentToolLifecycleDemoPage,
})
