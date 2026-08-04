/**
 * AgentInlineFeedVirtualizedRowDemoPage — the case convergence flagged and no unit test can reach:
 * a virtualized `ThreadTranscript` nested inside an inline `ThreadFeedRow`.
 *
 * `ThreadFeedRow` hides its body with `display: none` while collapsed but keeps it MOUNTED (see its
 * module doc — that's the whole point of the lazy-mount-then-kept-mounted invariant). A virtualized
 * transcript's scroll element measures 0 height while `display: none`, and whether it recovers on
 * re-expand depends on `ResizeObserver` firing on the display toggle — real in a browser, entirely
 * absent from happy-dom (the unit harness has no layout engine at all). This page is the only place
 * that question can actually be answered: expand the row (first real mount, at full height —
 * confirm it scrolls smoothly), collapse it, then re-expand it, and look at whether the transcript
 * comes back scrollable and correctly measured, or stuck looking collapsed/zero-height until the
 * window resizes.
 */
import { Paper, Stack, Text, Title } from '@mantine/core'
import type { AgentThread } from 'basalt-ui/agent'
import { ThreadFeedRow } from 'basalt-ui/agent-chat'
import type { ComposerSubmit } from 'basalt-ui/agent-chat'
import { useCallback, useMemo, useState } from 'react'
import { buildLongThread } from './agent-long-thread'

const ROW_MESSAGE_COUNT = 200
const TRANSCRIPT_HEIGHT = 420
const SEND_LOG_MAX = 5

export function AgentInlineFeedVirtualizedRowDemoPage() {
  const seedMessages = useMemo(() => buildLongThread(ROW_MESSAGE_COUNT), [])
  const [thread, setThread] = useState<AgentThread>(() => ({
    id: 'virtualized-row-demo',
    messages: seedMessages,
    outcome: {
      title: 'Release retro thread',
      summary: `${ROW_MESSAGE_COUNT} messages, windowed`,
      status: 'done',
    },
    status: 'done',
    read: true,
    createdAt: seedMessages[0]?.createdAt ?? Date.now(),
    updatedAt: seedMessages[seedMessages.length - 1]?.createdAt ?? Date.now(),
  }))
  const [expanded, setExpanded] = useState(false)
  const [sendLog, setSendLog] = useState<string[]>([])

  const handleSend = useCallback((payload: ComposerSubmit) => {
    const message = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      parts: [{ id: crypto.randomUUID(), type: 'text' as const, text: payload.text }],
      createdAt: Date.now(),
    }
    setThread((prev) => ({ ...prev, messages: [...prev.messages, message], updatedAt: Date.now() }))
    setSendLog((prev) => [`sent: "${payload.text}"`, ...prev].slice(0, SEND_LOG_MAX))
  }, [])

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>Virtualized transcript inside a collapsed row</Title>
        <Text size="sm" c="dimmed" mt={4}>
          Expand the row below (first mount — the virtualizer sets up at full height, scrolled to
          the newest message by default; confirm it scrolls smoothly through {ROW_MESSAGE_COUNT}{' '}
          messages). Collapse it, then re-expand it a few times: does the transcript come back
          scrollable and correctly measured at the SAME position you left it, or does it look
          stuck/zero-height until you resize the window, or reset back to the newest message?
          happy-dom has no layout engine, so this has never been observed anywhere but here.
        </Text>
      </div>

      <Paper p="sm">
        <ThreadFeedRow
          thread={thread}
          expanded={expanded}
          onToggle={() => setExpanded((current) => !current)}
          onSend={handleSend}
          virtualize
          height={TRANSCRIPT_HEIGHT}
        />
      </Paper>

      <Paper p="sm">
        <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={4}>
          Sent
        </Text>
        {sendLog.length === 0 ? (
          <Text size="sm" c="dimmed">
            Nothing sent yet.
          </Text>
        ) : (
          <Stack gap={2}>
            {sendLog.map((line, index) => (
              <Text key={`${index}-${line}`} size="xs" ff="monospace">
                {line}
              </Text>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  )
}
