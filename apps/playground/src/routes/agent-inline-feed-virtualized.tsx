import { createFileRoute } from '@tanstack/react-router'
import { AgentInlineFeedVirtualizedRowDemoPage } from '../demo/AgentInlineFeedVirtualizedRowDemoPage'

export const Route = createFileRoute('/agent-inline-feed-virtualized')({
  staticData: { title: 'Agent inline feed (virtualized row)' },
  component: AgentInlineFeedVirtualizedRowDemoPage,
})
