import { createFileRoute } from '@tanstack/react-router'
import { AgentFenceRegistryDemoPage } from '../demo/AgentFenceRegistryDemoPage'

export const Route = createFileRoute('/agent-fence-registry')({
  staticData: { title: 'Agent fence registry' },
  component: AgentFenceRegistryDemoPage,
})
