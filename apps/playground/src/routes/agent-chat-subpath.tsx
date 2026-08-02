import { createFileRoute } from '@tanstack/react-router'
import { AgentChatSubpathDemoPage } from '../demo/AgentChatSubpathDemoPage'

export const Route = createFileRoute('/agent-chat-subpath')({
  staticData: { title: 'Agent chat (subpath)' },
  component: AgentChatSubpathDemoPage,
})
