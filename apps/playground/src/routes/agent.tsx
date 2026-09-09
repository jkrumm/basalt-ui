import { Tabs } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { PageBar } from 'basalt-ui'
import { ViewTabs } from 'basalt-ui/controls'
import { createLocalStore, field } from 'basalt-ui/state'
import { AgentAiSdkDemoPage } from '../demo/AgentAiSdkDemoPage'
import { AgentComposerDemoPage } from '../demo/AgentComposerDemoPage'
import { AgentDemoPage } from '../demo/AgentDemoPage'
import { ThreadsPage } from '../demo/threads/ThreadsPage'

// `/agent-ai-sdk` and `/threads` absorbed here as tabs (audit E §7 named them as separate kept
// routes; the file-count math for the ≤15 playground-route budget — `__root` + the dashboard
// layout/index/revenue triple the nested-proof asks for — left no slot for either as its own
// route, so this wave folds them in). None of the three demos carries a `PageBar` of its own, so
// this route's tab set is free to take one (law C6) — which is what puts the tabs in row 2's
// `tabs` slot, the band every other route's tabs live in, instead of a raw `Tabs.List`.
const agentViews = createLocalStore({
  key: 'agent-view',
  fields: { tab: field.enum(['core', 'ai-sdk', 'threads', 'composer'], 'core') },
}).labels({
  tab: { core: 'Core', 'ai-sdk': 'AI SDK transport', threads: 'Threads', composer: 'Composer' },
})

function AgentPage() {
  const [tab] = agentViews.field.tab.use()
  return (
    <>
      <PageBar tabs={<ViewTabs field={agentViews.field.tab} label="Demo" />} />
      {/* Controlled off the store, with NO `Tabs.List`: four labelled tabs in Mantine's
          `flex-wrap: wrap` list break into a two-line strip at 390px with the active underline
          split across rows. `ViewTabs` collapses past three options to a phone `Select` in CSS
          (law C9) and does it once, for every route, instead of per call site. */}
      <Tabs value={tab}>
        <Tabs.Panel value="core">
          <AgentDemoPage />
        </Tabs.Panel>
        <Tabs.Panel value="ai-sdk">
          <AgentAiSdkDemoPage />
        </Tabs.Panel>
        <Tabs.Panel value="threads">
          <ThreadsPage />
        </Tabs.Panel>
        {/* `/agent-composer` absorbed here (audit E §7) — the prop-matrix half now lives in
            `packages/basalt-ui/src/agent-chat/composer.test.tsx` (+ `composer-paste.test.tsx` for
            the one gap, `onPaste`); this tab keeps the interactive insertText/draftKey demo. */}
        <Tabs.Panel value="composer">
          <AgentComposerDemoPage />
        </Tabs.Panel>
      </Tabs>
    </>
  )
}

export const Route = createFileRoute('/agent')({
  staticData: { title: 'Agent' },
  component: AgentPage,
})
