/**
 * ThreadsPage — showcases `ThreadWorkspace`, the flagship two-pane thread-chat composite.
 *
 * Unlike `/agent` (one persisted conversation), this page manages many concurrent threads: a
 * scrollable feed with distilled outcomes on the left, a live transcript detail panel on the
 * right. The mock transport/resolver pair lives in `./thread-scenarios` and reuses the `/agent`
 * demo's scenarios, so the same reasoning/tool/source/error variety shows up here per thread.
 *
 * @example
 * import { ThreadsPage } from './demo/threads/ThreadsPage'
 *
 * <Route path="/threads" component={ThreadsPage} />
 */
import { Stack, Text, Title } from '@mantine/core'
import { createThreadsStore, ThreadWorkspace } from 'basalt-ui'
import type { JSX } from 'react'
import { mockOutcomeResolver, mockThreadTransport } from './thread-scenarios'

// One stable store at module scope — createThreadsStore must be called ONCE per key, not inside
// the component (mirrors the `useConversation` pattern in AgentDemoPage).
const useThreads = createThreadsStore({ key: 'playground-threads', version: 1 })

const WORKSPACE_HEIGHT = 560

/** The /threads route page: heading + a bounded-height ThreadWorkspace so feed/panel scroll. */
export function ThreadsPage(): JSX.Element {
  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>Threads</Title>
        <Text size="sm" c="dimmed" mt={4}>
          A multi-thread inbox on `ThreadWorkspace` — one feed of distilled outcomes, N concurrent
          streams, and a detail panel for whichever thread is open. Each new prompt rotates through
          the answer / tools / reasoning / error scenarios from the agent demo.
        </Text>
      </div>

      <div style={{ height: WORKSPACE_HEIGHT }}>
        <ThreadWorkspace
          useThreads={useThreads}
          transport={mockThreadTransport}
          resolveOutcome={mockOutcomeResolver}
          newThreadPlaceholder="Ask anything — e.g. create a todo to water the plants tomorrow"
        />
      </div>
    </Stack>
  )
}
