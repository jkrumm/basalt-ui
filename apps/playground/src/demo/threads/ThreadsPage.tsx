/**
 * ThreadsPage — showcases `ThreadWorkspace`, the flagship two-pane thread-chat composite.
 *
 * Unlike `/agent`'s Core tab (one persisted conversation), this view manages many concurrent
 * threads: a scrollable feed with distilled outcomes on the left, a live transcript detail panel
 * on the right. The mock transport/resolver pair lives in `./thread-scenarios` and reuses the Core
 * demo's scenarios, so the same reasoning/tool/source/error variety shows up here per thread.
 *
 * NOT a route of its own — `/threads` was folded into `/agent` as its `threads` tab (audit E §7,
 * the ≤15 route budget). It mounts inside `routes/agent.tsx`'s `<Tabs.Panel value="threads">`,
 * which is why it carries no `PageBar`: that route's one bar (law C6) is the tab set itself.
 */
import { Stack, Text } from '@mantine/core'
import { createThreadsStore, ThreadWorkspace } from 'basalt-ui'
import type { JSX } from 'react'
import { AgentThreadFeedInlineDemoPage } from '../AgentThreadFeedInlineDemoPage'
import { mockOutcomeResolver, mockThreadTransport } from './thread-scenarios'

// One stable store at module scope — createThreadsStore must be called ONCE per key, not inside
// the component (mirrors the `useConversation` pattern in AgentDemoPage).
const useThreads = createThreadsStore({ key: 'playground-threads', version: 1 })

/**
 * Viewport-relative, not a flat 560 — same reason as `AgentDemoPage`'s `CHAT_HEIGHT`: an iPhone
 * SE's scrollport is ≈464px, so a rigid 560 pushed the workspace's composer below the fold. `dvh`
 * resolves against the real scrollport element (`data-basalt-scrollport`); the floor keeps the
 * two-pane split usable rather than letting it collapse with the viewport.
 */
const WORKSPACE_HEIGHT = 'clamp(360px, 60dvh, 560px)'

/** The /threads tab: a bounded-height ThreadWorkspace so feed/panel scroll. No in-body heading and
 * no `p="md"` — the shell's breadcrumb names the page and `AppShell.Main` owns the gutter (see
 * ComponentsPage's module doc for the wave's page-chrome rule). */
export function ThreadsPage(): JSX.Element {
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        A multi-thread inbox on `ThreadWorkspace` — one feed of distilled outcomes, N concurrent
        streams, and a detail panel for whichever thread is open. Each new prompt rotates through
        the answer / tools / reasoning / error scenarios from the agent demo.
      </Text>

      <div style={{ height: WORKSPACE_HEIGHT }}>
        <ThreadWorkspace
          useThreads={useThreads}
          transport={mockThreadTransport}
          resolveOutcome={mockOutcomeResolver}
          newThreadPlaceholder="Ask anything — e.g. create a todo to water the plants tomorrow"
        />
      </div>

      {/* `/agent-thread-feed-inline` absorbed here (audit E §7) — `ThreadFeedRow`'s inline-expand
          mount-once invariant, next to the unchanged inbox row. */}
      <AgentThreadFeedInlineDemoPage />
    </Stack>
  )
}
