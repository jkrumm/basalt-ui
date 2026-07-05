/**
 * ThreadDetailPanel — the right-hand pane rendering one open thread's transcript + composer.
 *
 * A plain pane (Paper/Box), NOT a Modal — the composite that wires this up owns responsive
 * collapse/layout decisions. The header shares a `layoutId` (thread.id) with `ThreadOutcomeCard`
 * so opening a thread reads as one continuous shared-element FLIP transition rather than a swap.
 * Pure and prop-driven: no store, no fetching — `onSend`/`onStop`/`onClose` are the only seams.
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
import { ActionIcon, Alert, Box, Button, Divider, Paper, Stack, Text } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { motion } from 'motion/react'
import type { JSX } from 'react'
import type { AgentPart, AgentThread, StreamStatus } from '../agent'
import { BasaltStickToBottom } from '../agent'
import { MOTION_SPRING } from '../motion'
import { Composer } from './composer'
import { ThreadTranscript } from './thread-message'

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
    <Paper radius="md" withBorder p="xl" style={{ height: '100%' }}>
      <Stack align="center" justify="center" gap={4} h="100%">
        <Text fw={600}>No thread selected</Text>
        <Text size="sm" c="dimmed" ta="center">
          Pick a thread from the feed to see its transcript.
        </Text>
      </Stack>
    </Paper>
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
}: ThreadDetailPanelProps): JSX.Element {
  const reduceMotion = useReducedMotion()

  if (thread === null) return <EmptyPanel />

  const streaming = runStatus === 'streaming'

  const panel = (
    <Paper
      radius="md"
      withBorder
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <Box
        p="sm"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Text fw={600} lineClamp={1}>
          {threadLabel(thread)}
        </Text>
        <ActionIcon variant="subtle" color="gray" onClick={onClose} aria-label="Close thread">
          <CloseGlyph />
        </ActionIcon>
      </Box>
      <Divider />
      <Box style={{ flex: 1, minHeight: 0 }}>
        <BasaltStickToBottom style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
          <ThreadTranscript
            messages={thread.messages}
            {...(liveParts !== undefined ? { liveParts } : {})}
            {...(runStatus !== undefined ? { liveStatus: runStatus } : {})}
          />
          {thread.status === 'error' && (
            <Alert color="red" variant="light" mt="md">
              This run didn’t finish. Try sending the message again.
            </Alert>
          )}
        </BasaltStickToBottom>
      </Box>
      <Divider />
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
    </Paper>
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
