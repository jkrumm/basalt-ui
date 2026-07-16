/**
 * AgentAiSdkDemoPage — proves stream resumption end-to-end over `aiSdkTransport`, against a mock
 * AI-SDK-shaped backend (`./mock-ai-sdk-backend`). Separate from `/agent` (the Eden-flavored demo):
 * this page's transport, wiring, and single-thread scope differ enough that merging the two would
 * be more confusing than two clear pages.
 *
 * Unlike `/agent` (built on useAgentStream), this page is built on `useAgentThreadRuns` +
 * `createThreadsStore` specifically so the MOUNT-TIME resume path is exercised for real — a
 * genuine architectural difference from a single-turn hook, not an arbitrary choice.
 *
 * This is a deliberately single-thread, single-turn demo (one question, one answer) — the mock
 * backend's chunk buffer is scoped per chat id for one turn's generation, not a full multi-turn
 * chat. That keeps the resumption mechanics legible; a real app would extend the mock/backend
 * design to key buffers per turn too.
 *
 * This is the "raw parts, build-your-own" path: it composes `AssistantBlocks`/`MessageBubble` from
 * `./agent-blocks` by hand over the raw `AgentPart[]`, instead of the shipped `PartList` (see
 * `/agent`, the recommended default — this page exists to prove the bespoke path still works).
 *
 * The three things this page proves:
 *   (a) a normal turn streams through the real AI-SDK wire shape (SSE UIMessageChunks, diffed into
 *       AgentParts) and renders correctly — intro text, a tool call, a cited source, an answer;
 *   (b) the network-drop simulation visibly stalls the UI (the mock backend abandons the live
 *       connection ~40% through the response, but keeps generating in the background — the debug
 *       panel polls the buffer to prove it);
 *   (c) reloading the actual browser tab resumes the SAME thread via useAgentThreadRuns' mount-time
 *       reconciliation, replays the full turn, and completes — without resending the question.
 */
import { Alert, Button, Code, Group, Paper, Stack, Text, Textarea, Title } from '@mantine/core'
import { EmptyState } from 'basalt-ui'
import {
  aiSdkTransport,
  createThreadsStore,
  heuristicOutcome,
  useAgentThreadRuns,
} from 'basalt-ui/agent'
import type { AgentPart } from 'basalt-ui/agent'
import { useCallback, useEffect, useState } from 'react'
import { createMockAiSdkFetch, getBufferSnapshot, MOCK_API_PATH } from './mock-ai-sdk-backend'
import { AssistantBlocks, MessageBubble } from './agent-blocks'
import { IconReset, IconSend, IconSparkle } from './icons'

// ── Persisted single-thread store + transport ─────────────────────────────────
// Both module-scope: createThreadsStore must be called ONCE per key (mirrors every other demo's
// store pattern); the transport is stable for the whole session so the mock backend's per-chat-id
// buffers are addressed consistently across renders and across the reload this page is built to
// survive.
const useAiSdkThreads = createThreadsStore({ key: 'agent-ai-sdk-demo', version: 1 })
const transport = aiSdkTransport<AgentPart>({ api: MOCK_API_PATH, fetch: createMockAiSdkFetch() })

// ── Live buffer poll (debug panel) ────────────────────────────────────────────

/** Polls the mock backend's server-side buffer for `chatId` every 600ms while `active`. */
function useBufferSnapshot(chatId: string | undefined, active: boolean) {
  const [snapshot, setSnapshot] = useState<{ chunkCount: number; done: boolean } | undefined>(
    undefined,
  )

  useEffect(() => {
    if (chatId === undefined || !active) return
    const id = setInterval(() => setSnapshot(getBufferSnapshot(chatId)), 600)
    return () => clearInterval(id)
  }, [chatId, active])

  return snapshot
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AgentAiSdkDemoPage() {
  const store = useAiSdkThreads()
  const { runs, start } = useAgentThreadRuns({
    transport: (threadId) => transport.forThread(threadId),
    store,
    resolveOutcome: heuristicOutcome,
  })
  const [input, setInput] = useState('')

  // Single-thread demo: the first (and only) persisted thread, if one has been created yet.
  const thread = store.threads[0]
  const run = thread !== undefined ? runs.get(thread.id) : undefined
  const streaming = run?.status === 'streaming'
  const chatId = thread?.resumeToken ?? thread?.id
  const bufferSnapshot = useBufferSnapshot(chatId, streaming)

  const handleAsk = useCallback(() => {
    const text = input.trim()
    if (!text || thread !== undefined) return
    const id = store.create()
    start(id, text)
    setInput('')
  }, [input, thread, store, start])

  const handleReset = useCallback(() => {
    store.clear()
    setInput('')
  }, [store])

  const stalled = streaming && bufferSnapshot !== undefined && bufferSnapshot.chunkCount > 0

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>Agent chat — AI SDK resumption</Title>
        <Text size="sm" c="dimmed" mt={4}>
          A single-turn demo over <code>aiSdkTransport</code> against a mock, resumable backend —
          built to prove that reloading the tab mid-stream recovers the answer, without resending
          the question.
        </Text>
      </div>

      <Paper py="xs" px="sm" style={{ minHeight: 220 }}>
        {thread === undefined ? (
          <Stack align="center" justify="center" mih={200}>
            <EmptyState
              icon={<IconSparkle />}
              title="Ask one question to start"
              description="The reply streams for a few seconds, then the demo backend deliberately abandons the connection partway through — watch the panel below, then reload this tab."
              variant="section"
            />
          </Stack>
        ) : (
          <Stack gap="lg">
            {thread.messages.map((m) => (
              <MessageBubble key={m.id} author={m.role} parts={m.parts}>
                <AssistantBlocks parts={m.parts} />
              </MessageBubble>
            ))}
            {run !== undefined && (
              <MessageBubble author="assistant" parts={run.parts}>
                <AssistantBlocks parts={run.parts} />
              </MessageBubble>
            )}
          </Stack>
        )}
      </Paper>

      <Group gap="xs" align="flex-end" wrap="nowrap">
        <Textarea
          flex={1}
          autosize
          minRows={1}
          maxRows={4}
          radius="md"
          placeholder="Ask a question to start the demo…"
          value={input}
          disabled={thread !== undefined}
          onChange={(e) => setInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleAsk()
            }
          }}
        />
        <Button
          radius="md"
          leftSection={<IconSend />}
          onClick={handleAsk}
          disabled={!input.trim() || thread !== undefined}
        >
          Ask
        </Button>
        <Button radius="md" variant="default" leftSection={<IconReset />} onClick={handleReset}>
          Reset demo
        </Button>
      </Group>

      {/* ── Explanation panel ──────────────────────────────────────────────── */}
      <Paper p="sm">
        <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
          What's happening
        </Text>
        <Stack gap="xs">
          <Text size="sm">
            1. <strong>Ask</strong> POSTs to the mock backend, which starts a DETACHED generation
            loop — it appends chunks to a per-chat buffer on its own timeline, independent of any
            open connection.
          </Text>
          <Text size="sm">
            2. <strong>aiSdkTransport</strong> reads that response through AI SDK's{' '}
            <code>readUIMessageStream</code>, diffs each snapshot against the last, and yields only
            the new deltas — the same delta model every basalt-ui consumer already expects.
          </Text>
          <Text size="sm">
            3. Around 40% through the answer, the mock backend silently abandons the live connection
            (no error, no close — a real dropped connection rarely announces itself). The UI below
            will visibly stall.
          </Text>
          {stalled && (
            <Alert color="orange" variant="light" title="Stalled — reload this tab now">
              The chat above has stopped updating, but the server buffer keeps growing:
              <Code ml={6}>
                {bufferSnapshot?.chunkCount ?? 0} chunks buffered
                {bufferSnapshot?.done ? ' (finished)' : ' (still growing)'}
              </Code>
              . Reload the page — <code>useAgentThreadRuns</code>' mount-time reconciliation will
              detect the orphaned thread and call <code>aiSdkTransport</code>'s{' '}
              <code>resume()</code>, which replays the full buffered history and continues to
              completion.
            </Alert>
          )}
          <Text size="sm">
            4. On reload, the persisted thread is found still <code>'streaming'</code> with a resume
            token — <code>useAgentThreadRuns</code> calls <code>resume()</code> instead of giving
            up, and the SAME answer completes without the question being resent.
          </Text>
        </Stack>
      </Paper>
    </Stack>
  )
}
