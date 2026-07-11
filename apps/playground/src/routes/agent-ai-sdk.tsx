import { createFileRoute } from '@tanstack/react-router'
import { AgentAiSdkDemoPage } from '../demo/AgentAiSdkDemoPage'

export const Route = createFileRoute('/agent-ai-sdk')({
  staticData: { title: 'Agent (AI SDK)' },
  component: AgentAiSdkDemoPage,
})
