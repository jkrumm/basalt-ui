import { createFileRoute } from '@tanstack/react-router'
import { AgentStopMidStreamDemoPage } from '../demo/AgentStopMidStreamDemoPage'

export const Route = createFileRoute('/agent-stop-mid-stream')({
  staticData: { title: 'Agent stop mid-stream' },
  component: AgentStopMidStreamDemoPage,
})
