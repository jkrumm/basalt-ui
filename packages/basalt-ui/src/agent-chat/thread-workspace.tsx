/**
 * ThreadWorkspace — the flagship, ready-to-use two-pane thread-chat composite.
 *
 * Composes `ThreadFeed` + a new-thread `Composer` (left/main pane) with `ThreadDetailPanel`
 * (right pane) over `useAgentThreadRuns`, so a consumer wires one component instead of hand-
 * assembling the pieces. Responsive: wide viewports show both panes side by side; narrow
 * viewports (`<= 768px`) show exactly one — the feed when no thread is open, a full-screen
 * detail panel once one is.
 *
 * `useThreads` is a prop, not called internally, because `createThreadsStore` must be invoked
 * ONCE at module scope (see the doctrine on `createThreadsStore` in `../agent`) — the consumer
 * owns that module-scope call and passes the resulting hook in here.
 *
 * @example
 * import { ThreadWorkspace } from 'basalt-ui'
 * import { createThreadsStore, edenTransport, heuristicOutcome } from 'basalt-ui/agent'
 *
 * // Module scope — called ONCE:
 * const useThreads = createThreadsStore({ key: 'main-threads', version: 1 })
 * const transport = edenTransport((input, signal) =>
 *   api.chat.post({ body: { message: input }, fetch: { signal } }),
 * )
 *
 * function Inbox() {
 *   return (
 *     <ThreadWorkspace
 *       useThreads={useThreads}
 *       transport={transport}
 *       resolveOutcome={heuristicOutcome}
 *       newThreadPlaceholder="Start a new conversation…"
 *     />
 *   )
 * }
 */
import { Box, Divider, Flex, Stack, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { JSX, ReactNode } from 'react'
import type { AgentPart, AgentTransport, OutcomeResolver, ThreadsStore } from '../agent'
import { useAgentThreadRuns } from '../agent'
import { Composer } from './composer'
import { ThreadDetailPanel } from './thread-detail-panel'
import { ThreadFeed } from './thread-feed'

const NARROW_BREAKPOINT = '(max-width: 768px)'
const DETAIL_PANEL_WIDTH = 'clamp(440px, 40%, 520px)'

export type ThreadWorkspaceProps = {
  /**
   * The thread-store hook, created ONCE at module scope via `createThreadsStore` and passed in —
   * ThreadWorkspace must not call `createThreadsStore` itself.
   */
  readonly useThreads: () => ThreadsStore
  /** The injected transport seam — one stream per `start()` call. */
  readonly transport: AgentTransport<AgentPart, string>
  /** Distills a finished thread into a feed-ready `AgentOutcome`. */
  readonly resolveOutcome: OutcomeResolver<AgentPart>
  /** Placeholder for the new-thread composer pinned under the feed. */
  readonly newThreadPlaceholder?: string
  /** Rendered in place of the feed while there are no threads yet. */
  readonly emptyState?: ReactNode
}

/** Default hint shown in the feed pane before any thread exists (overridable via `emptyState`). */
function FeedEmptyState(): JSX.Element {
  return (
    <Stack align="center" justify="center" gap={4} h="100%" p="xl">
      <Text fw={600} size="sm">
        No threads yet
      </Text>
      <Text size="xs" c="dimmed" ta="center">
        Send a message below to start your first thread.
      </Text>
    </Stack>
  )
}

/**
 * A two-pane master-detail thread workspace: a scrollable feed of threads with an anchored
 * new-thread composer, and a detail panel for the open thread's live transcript. Collapses to a
 * single pane below 768px.
 *
 * @example
 * <ThreadWorkspace useThreads={useThreads} transport={transport} resolveOutcome={heuristicOutcome} />
 */
export function ThreadWorkspace({
  useThreads,
  transport,
  resolveOutcome,
  newThreadPlaceholder,
  emptyState,
}: ThreadWorkspaceProps): JSX.Element {
  const store = useThreads()
  const runs = useAgentThreadRuns({ transport, store, resolveOutcome })
  const narrow = useMediaQuery(NARROW_BREAKPOINT)

  const threads = store.threads
  const activeThread = threads.find((thread) => thread.id === store.activeId) ?? null
  const activeRun = store.activeId !== null ? runs.runs.get(store.activeId) : undefined
  const liveParts = activeRun?.parts

  const handleSelect = (id: string): void => {
    store.select(id)
    store.markRead(id)
  }

  const handleNewThread = (text: string): void => {
    const id = store.create()
    store.select(id)
    store.markRead(id)
    runs.start(id, text)
  }

  const handleSend = (text: string): void => {
    if (store.activeId === null) return
    runs.start(store.activeId, text)
  }

  const handleStop = (): void => {
    if (store.activeId === null) return
    runs.stop(store.activeId)
  }

  const handleRetry = (): void => {
    if (store.activeId === null) return
    runs.retry(store.activeId)
  }

  // A plain pane, NOT a card — the feed's own rows carry the card idiom (docs/DESIGN-SPEC.md §5),
  // so this pane stays flush with the page and the feed/detail split reads via the divider token.
  const feed = (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box style={{ flex: 1, minHeight: 0 }}>
        {store.threads.length === 0 ? (
          (emptyState ?? <FeedEmptyState />)
        ) : (
          <ThreadFeed threads={threads} activeId={store.activeId} onSelect={handleSelect} />
        )}
      </Box>
      <Divider color="var(--vx-divider)" />
      <Box p="sm">
        <Composer
          onSubmit={handleNewThread}
          {...(newThreadPlaceholder !== undefined ? { placeholder: newThreadPlaceholder } : {})}
        />
      </Box>
    </Box>
  )

  const detail = (
    <ThreadDetailPanel
      thread={activeThread}
      {...(liveParts !== undefined ? { liveParts } : {})}
      {...(activeRun !== undefined ? { runStatus: activeRun.status } : {})}
      onSend={handleSend}
      onStop={handleStop}
      onRetry={handleRetry}
      onClose={() => store.select(null)}
    />
  )

  if (narrow) {
    return <Box style={{ height: '100%' }}>{store.activeId !== null ? detail : feed}</Box>
  }

  return (
    <Flex style={{ height: '100%' }} gap="md">
      <Box
        style={{
          flex: 1,
          minWidth: 0,
          borderRight: '1px solid var(--vx-divider)',
        }}
      >
        {feed}
      </Box>
      <Box style={{ width: DETAIL_PANEL_WIDTH, flexShrink: 0 }}>{detail}</Box>
    </Flex>
  )
}
