import { createFileRoute } from '@tanstack/react-router'
import { AgentRenderBudgetDemoPage } from '../demo/AgentRenderBudgetDemoPage'

export const Route = createFileRoute('/agent-render-budget')({
  staticData: { title: 'Agent render budget' },
  component: AgentRenderBudgetDemoPage,
})
