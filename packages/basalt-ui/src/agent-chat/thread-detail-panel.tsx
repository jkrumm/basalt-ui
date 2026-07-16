/**
 * ThreadDetailPanel — the right-hand pane rendering one open thread's transcript + composer.
 *
 * A plain pane (Box), NOT a Modal — the feed/detail split reads via the `divider` token rather
 * than a card border (docs/DESIGN-SPEC.md §5); the composite that wires this up owns responsive
 * collapse/layout decisions. The header shares a `layoutId` (thread.id) with `ThreadOutcomeCard`
 * so opening a thread reads as one continuous shared-element FLIP transition rather than a swap.
 * Pure and prop-driven: no store, no fetching — `onSend`/`onStop`/`onClose`/`onRetry` are the
 * only seams.
 *
 * @example
 * import { ThreadDetailPanel } from 'basalt-ui/agent-chat'
 *
 * <ThreadDetailPanel
 *   thread={activeThread}
 *   liveParts={liveParts}
 *   runStatus={runStatus}
 *   onSend={send}
 *   onStop={stop}
 *   onClose={() => select(null)}
 * />
 */
import { ActionIcon, Alert, Box, Button, Divider, Stack, Text } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { motion } from 'motion/react'
import type { JSX } from 'react'
import type { AgentPart, AgentThread, StreamStatus } from '../agent'
import { BasaltStickToBottom } from '../agent'
import { MOTION_SPRING } from '../motion'
import { Composer } from './composer'
import { ThreadTranscript } from './thread-message'
import { VX } from '../tokens'

function CloseGlyph(): JSX.Element {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 6l-12 12M6 6l12 12"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EmptyPanel(): JSX.Element {
  return (
    <Box p="xl" style={{ height: '100%' }}>
      <Stack align="center" justify="center" gap={4} h="100%">
        <Text fw={550} style={{ fontFamily: 'var(--basalt-font-head)', fontStretch: '88%' }}>
          No thread selected
        </Text>
        <Text size="sm" c="dimmed" ta="center">
          Pick a thread from the feed to see its transcript.
        </Text>
      </Stack>
    </Box>
  )
}

/** The header label for an open thread: its resolved outcome title, else its opening prompt. */
function threadLabel(thread: AgentThread): string {
  if (thread.outcome !== null && thread.outcome.title.length > 0) return thread.outcome.title
  const firstUser = thread.messages.find((message) => message.role === 'user')
  if (firstUser === undefined) return 'Untitled'
  const text = firstUser.parts
    .filter((part): part is Extract<AgentPart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('')
    .trim()
  return text.length > 0 ? text : 'Untitled'
}

export type ThreadDetailPanelProps = {
  /** The open thread, or null when nothing is selected (renders an empty-state hint). */
  readonly thread: AgentThread | null
  /** The live (in-flight) assistant turn's parts for this thread, if a run is streaming. */
  readonly liveParts?: AgentPart[]
  /** The live run's status — gates the composer and shows the Stop action while streaming. */
  readonly runStatus?: StreamStatus
  readonly onSend: (text: string) => void
  readonly onStop: () => void
  readonly onClose: () => void
  /**
   * Replay the last user input on this thread. When provided, a "Retry" action appears in the
   * failed-run alert; omit it to render the alert without a retry affordance.
   */
  readonly onRetry?: () => void
}

/**
 * The detail pane for one open thread: header (title + close), transcript body in an
 * auto-scrolling container, and a footer composer (with a Stop action while streaming).
 *
 * @example
 * <ThreadDetailPanel thread={thread} runStatus={runStatus} onSend={send} onStop={stop} onClose={close} />
 */
export function ThreadDetailPanel({
  thread,
  liveParts,
  runStatus,
  onSend,
  onStop,
  onClose,
  onRetry,
}: ThreadDetailPanelProps): JSX.Element {
  const reduceMotion = useReducedMotion()

  if (thread === null) return <EmptyPanel />

  const streaming = runStatus === 'streaming'

  const panel = (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box
        p="sm"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Text
          fw={550}
          lineClamp={1}
          style={{
            fontFamily: 'var(--basalt-font-head)',
            fontSize: VX.text.md,
            fontStretch: '88%',
          }}
        >
          {threadLabel(thread)}
        </Text>
        <ActionIcon variant="subtle" color="gray" onClick={onClose} aria-label="Close thread">
          <CloseGlyph />
        </ActionIcon>
      </Box>
      <Divider color="var(--vx-divider)" />
      <Box style={{ flex: 1, minHeight: 0 }}>
        {/* theme-allow — BasaltStickToBottom owns this scroll node (see stick-to-bottom.tsx). */}
        <BasaltStickToBottom style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
          <ThreadTranscript
            messages={thread.messages}
            {...(liveParts !== undefined ? { liveParts } : {})}
            {...(runStatus !== undefined ? { liveStatus: runStatus } : {})}
          />
          {thread.status === 'error' && (
            <Alert color="red" variant="light" mt="md">
              <Stack gap="xs" align="flex-start">
                <Text size="sm">This run didn’t finish. Try sending the message again.</Text>
                {onRetry !== undefined && (
                  <Button size="compact-sm" variant="light" color="red" onClick={onRetry}>
                    Retry
                  </Button>
                )}
              </Stack>
            </Alert>
          )}
          {thread.status === 'interrupted' && (
            <Alert color="yellow" variant="light" mt="md">
              Interrupted — resend to continue.
            </Alert>
          )}
        </BasaltStickToBottom>
      </Box>
      <Divider color="var(--vx-divider)" />
      <Box p="sm">
        <Stack gap="xs">
          <Composer onSubmit={onSend} disabled={streaming} />
          {streaming && (
            <Button size="compact-sm" variant="subtle" color="red" onClick={onStop}>
              Stop
            </Button>
          )}
        </Stack>
      </Box>
    </Box>
  )

  if (reduceMotion) return panel

  // Keyed by thread.id so opening/switching threads re-mounts and slides the new content in.
  return (
    <motion.div
      key={thread.id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={MOTION_SPRING}
      style={{ height: '100%' }}
    >
      {panel}
    </motion.div>
  )
}
