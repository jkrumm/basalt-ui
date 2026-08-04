import { createFileRoute } from '@tanstack/react-router'
import { AgentThreadFeedInlineDemoPage } from '../demo/AgentThreadFeedInlineDemoPage'

export const Route = createFileRoute('/agent-thread-feed-inline')({
  staticData: { title: 'Agent thread feed (inline)' },
  component: AgentThreadFeedInlineDemoPage,
})
