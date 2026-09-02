import { Tabs } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { AgentAiSdkDemoPage } from '../demo/AgentAiSdkDemoPage'
import { AgentComposerDemoPage } from '../demo/AgentComposerDemoPage'
import { AgentDemoPage } from '../demo/AgentDemoPage'
import { ThreadsPage } from '../demo/threads/ThreadsPage'

// `/agent-ai-sdk` and `/threads` absorbed here as tabs (audit E §7 named them as separate kept
// routes; the file-count math for the ≤15 playground-route budget — `__root` + the dashboard
// layout/index/revenue triple the nested-proof asks for — left no slot for either as its own
// route, so this wave folds them in). None of the three demos carries a `PageBar` of its own, so
// nesting them under one tab set adds none (law C6).
function AgentPage() {
  return (
    <Tabs defaultValue="core">
      <Tabs.List>
        <Tabs.Tab value="core">Core</Tabs.Tab>
        <Tabs.Tab value="ai-sdk">AI SDK transport</Tabs.Tab>
        <Tabs.Tab value="threads">Threads</Tabs.Tab>
        <Tabs.Tab value="composer">Composer</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="core" pt="md">
        <AgentDemoPage />
      </Tabs.Panel>
      <Tabs.Panel value="ai-sdk" pt="md">
        <AgentAiSdkDemoPage />
      </Tabs.Panel>
      <Tabs.Panel value="threads" pt="md">
        <ThreadsPage />
      </Tabs.Panel>
      {/* `/agent-composer` absorbed here (audit E §7) — the prop-matrix half now lives in
          `packages/basalt-ui/src/agent-chat/composer.test.tsx` (+ `composer-paste.test.tsx` for
          the one gap, `onPaste`); this tab keeps the interactive insertText/draftKey demo. */}
      <Tabs.Panel value="composer" pt="md">
        <AgentComposerDemoPage />
      </Tabs.Panel>
    </Tabs>
  )
}

export const Route = createFileRoute('/agent')({
  staticData: { title: 'Agent' },
  component: AgentPage,
})
