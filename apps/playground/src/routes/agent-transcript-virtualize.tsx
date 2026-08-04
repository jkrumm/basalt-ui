import { createFileRoute } from '@tanstack/react-router'
import { AgentTranscriptVirtualizeDemoPage } from '../demo/AgentTranscriptVirtualizeDemoPage'

export const Route = createFileRoute('/agent-transcript-virtualize')({
  staticData: { title: 'Agent transcript virtualize' },
  component: AgentTranscriptVirtualizeDemoPage,
})
