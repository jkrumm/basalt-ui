/**
 * AgentStopMidStreamDemoPage — the 1.11.0 playground gate's stop-mid-stream demo: proves `stop()`
 * on `useAgentThreadRuns` now PRESERVES a turn's partial text instead of discarding it.
 * Previously `stop()` aborted, dropped the run entry, and set the thread `'done'` before the
 * aborted consumer ever persisted anything — the text a user watched stream in vanished the
 * instant Stop was clicked. Now: `stop()` reads the accumulated parts, aborts, and — if any parts
 * had arrived — persists them as an assistant `ChatMessage` carrying the new optional
 * `finish: 'stopped'` field, then settles the thread to `'done'` the same way a completed turn
 * does. `ThreadStatus` was deliberately NOT widened with a `'stopped'` member — the distinction
 * lives only on the message-level `finish`, which is what this page reads.
 *
 * FRAMEWORK GAP (read before trusting this page as gospel): `ThreadTranscript`/`MessageBlock`
 * (`agent-chat/thread-message.tsx`) never reads `ChatMessage.finish` at all — there is no built-in
 * visual distinction between a `'complete'` bubble and a `'stopped'` one, and no prop threads it
 * through. Adding that distinction INSIDE the transcript bubble would mean editing basalt-ui's
 * own `packages/basalt-ui/src/agent-chat/thread-message.tsx`, which is out of this file's
 * ownership (another agent owns `packages/basalt-ui/**` this cycle) and — more importantly — isn't
 * something a real consumer of the published package could do either. So this page renders a
 * second, compact "message ledger" strip below the transcript, sourced from the exact same
 * `thread.messages` the transcript reads, that labels each settled message's `finish` state
 * explicitly. A production consumer wanting a status affordance ON the bubble itself hits the same
 * wall today.
 *
 * The single Stop button below drives BOTH cheap checks the gate also wants: clicking it while a
 * turn is streaming exercises the preserve-partial path; clicking it again once the thread is
 * idle exercises `stop()`'s true no-op guard — nothing is written, no phantom message appears. The
 * "Assistant messages" badge stays at exactly 1 through either sequence, proving `finalizeStop`'s
 * double-append guard (the reference-equality check against the message `consumeAndFinalize`
 * itself may have already appended).
 *
 * "Close/Reopen thread view" unmounts and remounts the transcript + ledger from scratch, reading
 * only the PERSISTED `store.threads` (never the transient `runs` map, which is empty once a turn
 * settles either way) — proving the stopped message survived a fresh render, not just a run state
 * a still-mounted component happened to be holding onto. The store itself is
 * `createPersistedState`-backed localStorage, so a real page reload proves the same thing even
 * harder; this button demonstrates it without leaving the page.
 *
 * @example
 * <Route path="/agent-stop-mid-stream" component={AgentStopMidStreamDemoPage} />
 */
import { Badge, Box, Button, Group, List, Paper, Stack, Text, Title } from '@mantine/core'
import { EmptyState } from 'basalt-ui'
import { createThreadsStore, useAgentThreadRuns } from 'basalt-ui/agent'
import type { AgentPart, AgentTransport, ChatMessage, OutcomeResolver } from 'basalt-ui/agent'
import { ThreadTranscript } from 'basalt-ui/agent-chat'
import { alpha, VX } from 'basalt-ui/tokens'
import { useCallback, useState } from 'react'
import { IconReset, IconSparkle, IconStop } from './icons'

// Mirrors every other agent demo's shared micro-label idiom (docs/DESIGN-SPEC.md §3) — duplicated
// locally per the existing precedent of each Mantine-facing renderer file owning its own copy.
const MICRO_LABEL_STYLE = {
  fontFamily: 'var(--basalt-font-mono)',
  fontSize: VX.text.micro,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: VX.faint,
} as const

// ── Scripted, slow, word-by-word stream — long enough to click Stop mid-flight ────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const STOP_STEP_DELAY = 260

const STOP_DEMO_ANSWER =
  'Investigating the Tuesday outage: traffic spiked at 14:02, the database connection pool ' +
  'saturated by 14:05, and the load balancer began shedding requests two minutes later while the ' +
  'on-call engineer was still being paged in.'
const STOP_DEMO_WORDS = STOP_DEMO_ANSWER.split(' ')

async function* stopMidStreamScript(): AsyncGenerator<AgentPart> {
  const id = crypto.randomUUID()
  for (const [index, word] of STOP_DEMO_WORDS.entries()) {
    await sleep(STOP_STEP_DELAY)
    yield { id, type: 'text', text: index === 0 ? word : ` ${word}` }
  }
}

const stopDemoTransport: AgentTransport<AgentPart, string> = {
  stream: () => stopMidStreamScript(),
}

// ── Store + outcome resolver ────────────────────────────────────────────────────

// One stable store at module scope (createThreadsStore must be called ONCE per key, same rule as
// every other agent demo).
const useStopDemoThreads = createThreadsStore({ key: 'playground-stop-mid-stream', version: 1 })

const resolveStopOutcome: OutcomeResolver = async (thread) => {
  const lastAssistant = thread.messages.toReversed().find((message) => message.role === 'assistant')
  const textPart = lastAssistant?.parts.find(
    (part): part is Extract<AgentPart, { type: 'text' }> => part.type === 'text',
  )
  const label = lastAssistant?.finish === 'stopped' ? 'Stopped' : 'Complete'
  return {
    title: 'Stop mid-stream demo',
    summary: `${label}: ${textPart?.text.slice(0, 78) ?? ''}`,
    status: 'done',
  }
}

// ── Message ledger — the demo's stand-in for the transcript-level `finish` affordance the
// framework doesn't render (see the docblock's FRAMEWORK GAP note) ───────────────────────────────

const ROLE_LABEL: Record<ChatMessage['role'], string> = { user: 'You', assistant: 'Assistant' }

const FINISH_BADGE: Partial<
  Record<
    NonNullable<ChatMessage['finish']>,
    { readonly label: string; readonly statusToken: string }
  >
> = {
  complete: { label: 'complete', statusToken: VX.status.good },
  stopped: { label: 'stopped', statusToken: VX.status.warn },
  error: { label: 'error', statusToken: VX.status.bad },
}

function FinishBadge({ finish }: { finish: ChatMessage['finish'] }) {
  if (finish === undefined) return null
  const badge = FINISH_BADGE[finish]
  if (badge === undefined) return null
  return (
    <Badge
      size="xs"
      styles={{
        root: {
          backgroundColor: alpha(badge.statusToken, 0.13),
          padding: 'var(--vx-space-badge-inset-y) var(--vx-space-badge-inset-x)',
          height: 'auto',
          borderRadius: 'var(--vx-radius-ctrl)',
        },
        label: {
          fontFamily: 'var(--basalt-font-mono)',
          fontSize: VX.text.xs,
          fontWeight: 600,
          textTransform: 'none',
          letterSpacing: 'normal',
          color: badge.statusToken,
        },
      }}
    >
      {badge.label}
    </Badge>
  )
}

function MessageLedgerRow({ message, index }: { message: ChatMessage; index: number }) {
  return (
    <Group gap={8} align="center">
      <Text style={{ ...MICRO_LABEL_STYLE, letterSpacing: 'normal' }}>{`#${index + 1}`}</Text>
      <Text style={MICRO_LABEL_STYLE}>{ROLE_LABEL[message.role]}</Text>
      <FinishBadge finish={message.finish} />
    </Group>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AgentStopMidStreamDemoPage() {
  const store = useStopDemoThreads()
  const { runs, start, stop } = useAgentThreadRuns({
    transport: stopDemoTransport,
    store,
    resolveOutcome: resolveStopOutcome,
  })
  const [history, setHistory] = useState<string[]>([])
  const [mounted, setMounted] = useState(true)
  const [mountKey, setMountKey] = useState(0)

  const thread = store.threads[0]
  const run = thread !== undefined ? runs.get(thread.id) : undefined
  const assistantCount =
    thread?.messages.filter((message) => message.role === 'assistant').length ?? 0

  const handleRun = useCallback(() => {
    setHistory(['Streaming started — watch the text arrive, then click Stop partway through.'])
    const id = store.create()
    start(id, 'Walk me through the Tuesday outage timeline.')
  }, [store, start])

  const handleStop = useCallback(() => {
    if (thread === undefined) return
    const wasStreaming = run !== undefined
    const textPart = run?.parts.find(
      (part): part is Extract<AgentPart, { type: 'text' }> => part.type === 'text',
    )
    const preview = textPart?.text.trim() ?? ''
    const wordCount = preview.length > 0 ? preview.split(/\s+/).length : 0
    stop(thread.id)
    setHistory((prev) => [
      ...prev,
      wasStreaming
        ? `Stopped mid-stream — ${wordCount} word(s) had arrived ("${preview.slice(0, 60)}${preview.length > 60 ? '…' : ''}"); persisted with finish: 'stopped'.`
        : 'Stop clicked on an idle thread — true no-op, nothing written (no status change, no phantom message).',
    ])
  }, [thread, run, stop])

  const handleReset = useCallback(() => {
    store.clear()
    setHistory([])
    setMounted(true)
    setMountKey((count) => count + 1)
  }, [store])

  const handleToggleMount = useCallback(() => {
    if (mounted) {
      setMounted(false)
      return
    }
    setMountKey((count) => count + 1)
    setMounted(true)
  }, [mounted])

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>Agent chat — stop mid-stream</Title>
        <Text size="sm" c="dimmed" mt={4}>
          Streams a scripted answer word by word through the real <code>useAgentThreadRuns</code> →
          store path. Click Stop partway through: the partial text stays in the transcript, labelled{' '}
          <code>finish: 'stopped'</code> below it — not discarded, not silently completed.
        </Text>
      </div>

      <Group gap="xs">
        <Button
          radius="md"
          leftSection={<IconSparkle />}
          onClick={handleRun}
          disabled={thread !== undefined}
        >
          Run a streaming turn
        </Button>
        <Button
          radius="md"
          variant="light"
          color="red"
          leftSection={<IconStop />}
          onClick={handleStop}
          disabled={thread === undefined}
        >
          Stop
        </Button>
        <Button
          radius="md"
          variant="default"
          onClick={handleToggleMount}
          disabled={thread === undefined}
        >
          {mounted ? 'Close thread view' : 'Reopen thread view'}
        </Button>
        <Button radius="md" variant="default" leftSection={<IconReset />} onClick={handleReset}>
          Reset demo
        </Button>
      </Group>

      <Paper py="xs" px="sm" style={{ minHeight: 160 }}>
        {!mounted ? (
          <Stack align="center" justify="center" mih={140}>
            <EmptyState
              icon={<IconSparkle />}
              title="Thread view closed"
              description="Click “Reopen thread view” to remount the transcript from the persisted store — proving the stopped message survived, not just lingering component state."
              variant="section"
            />
          </Stack>
        ) : thread === undefined ? (
          <Stack align="center" justify="center" mih={140}>
            <EmptyState
              icon={<IconSparkle />}
              title="Run the demo to start"
              description="Streams a scripted answer word by word — click Stop partway through to see the partial text survive, labelled stopped."
              variant="section"
            />
          </Stack>
        ) : (
          <Box key={mountKey}>
            <ThreadTranscript
              messages={thread.messages}
              {...(run !== undefined
                ? { liveParts: run.parts, liveStatus: 'streaming' as const }
                : {})}
            />
          </Box>
        )}
      </Paper>

      {mounted && thread !== undefined && (
        <>
          <Group gap="xs" align="center">
            <Text size="sm">Assistant messages in this thread:</Text>
            <Badge color={assistantCount <= 1 ? 'teal' : 'red'} variant="light">
              {assistantCount}
            </Badge>
            <Text size="xs" c="dimmed">
              (stop()'s double-append guard keeps this at exactly 1 no matter how many times Stop is
              clicked.)
            </Text>
          </Group>

          <Paper p="sm">
            <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
              Message ledger — finish state per settled message
            </Text>
            <Stack gap={6}>
              {thread.messages.map((message, index) => (
                <MessageLedgerRow key={message.id} message={message} index={index} />
              ))}
            </Stack>
          </Paper>
        </>
      )}

      <Paper p="sm">
        <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
          Event log
        </Text>
        {history.length === 0 ? (
          <Text size="sm" c="dimmed">
            Nothing yet — run the demo above.
          </Text>
        ) : (
          <List size="sm" spacing={4}>
            {history.map((line, index) => (
              <List.Item key={`${index}-${line}`}>
                <code>{line}</code>
              </List.Item>
            ))}
          </List>
        )}
      </Paper>
    </Stack>
  )
}
