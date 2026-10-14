/**
 * AgentStreamDemo — the `/agent` Stream tab: one thread driven by `useAgentThreadRuns` over the
 * deterministic in-memory `richTransport`, rendered with `ThreadFeed` (inline row) and its
 * `Composer`. Also the surface the `chat-profile` evidence lane measures: a fixed ~3 s, ~1500-word
 * reply with no network and no model. Threads live in a throwaway in-memory store.
 */
import { Badge, Box, Group, Stack, Text } from '@mantine/core'
import { ThreadFeed, ThreadFeedRow, useAgentThreadRuns } from 'basalt-ui/agent'
import type { AgentPart, AgentThread, OutcomeResolver, ThreadsStore } from 'basalt-ui/agent'
import { useMemo, useState } from 'react'
import { DELTA_MS, richParts, richTransport } from './agent-scenarios'

const THREAD_ID = 'stream-demo'
const THREAD_TITLE = 'Deep modules and coupling'

const seedThread = (): AgentThread<AgentPart> => {
  const now = Date.now()
  return {
    id: THREAD_ID,
    messages: [],
    outcome: {
      title: THREAD_TITLE,
      summary: 'A replayed demo stream.',
      status: 'done',
    },
    status: 'done',
    read: true,
    createdAt: now,
    updatedAt: now,
  }
}

/** A throwaway, React-reactive `ThreadsStore`: state lives in this hook and dies with the tab. */
function useMemoryThreadsStore(): ThreadsStore<AgentPart> {
  const [threads, setThreads] = useState<AgentThread<AgentPart>[]>(() => [seedThread()])
  const [activeId, setActiveId] = useState<string | null>(THREAD_ID)

  return useMemo(() => {
    const patch = (
      id: string,
      change: (thread: AgentThread<AgentPart>) => AgentThread<AgentPart>,
    ) =>
      setThreads((all) =>
        all.map((thread) =>
          thread.id === id ? { ...change(thread), updatedAt: Date.now() } : thread,
        ),
      )
    return {
      threads,
      activeId,
      select: setActiveId,
      create: () => THREAD_ID,
      appendMessage: (id, message) =>
        patch(id, (thread) => ({ ...thread, messages: [...thread.messages, message] })),
      setOutcome: (id, outcome) => patch(id, (thread) => ({ ...thread, outcome })),
      setStatus: (id, status) => patch(id, (thread) => ({ ...thread, status })),
      setResumeToken: () => {},
      markRead: () => {},
      remove: () => {},
      clear: () => setThreads([seedThread()]),
      hydrated: true,
      error: undefined,
    }
  }, [threads, activeId])
}

/** Parts delivered before the forced failure, so the error entry keeps a partial reply. */
const FAIL_AFTER_PARTS = 3

/** `?fail=1`: streams a few parts, then throws what AI SDK's `APICallError` looks like (a 500). */
const failingTransport = {
  async *stream(): AsyncGenerator<AgentPart> {
    for (const part of richParts().slice(0, FAIL_AFTER_PARTS)) {
      await new Promise((resolve) => setTimeout(resolve, DELTA_MS))
      yield part
    }
    throw Object.assign(new Error('Internal Server Error'), { statusCode: 500 })
  },
}

/** `?throttle=<ms>` — the evidence lane's sweep knob; anything not a non-negative number is 0. */
function readParams(): { throttle: number; fail: boolean } {
  const params = new URLSearchParams(window.location.search)
  const throttle = Number(params.get('throttle'))
  return {
    throttle: Number.isFinite(throttle) && throttle > 0 ? throttle : 0,
    fail: params.get('fail') === '1',
  }
}

const resolveOutcome: OutcomeResolver<AgentPart> = (thread) => ({
  title: THREAD_TITLE,
  summary: `${thread.messages.length} messages`,
  status: 'done',
})

export function AgentStreamDemo() {
  const store = useMemoryThreadsStore()
  const [{ throttle, fail }] = useState(readParams)
  const { runs, start, stop } = useAgentThreadRuns({
    transport: fail ? failingTransport : richTransport,
    throttle,
    store,
    resolveOutcome,
  })
  const run = runs.get(THREAD_ID)

  return (
    <Stack gap="md">
      <Group gap="sm">
        <Text size="sm" c="dimmed">
          A deterministic ~1500-word reply streams over ~3 s: reasoning, markdown, a ts fence, a
          mermaid diagram, an alert and a tool call. No network, no model.
        </Text>
        {run !== undefined && (
          <Box role="status" aria-live="polite">
            <Badge variant="light" aria-label="Assistant is typing">
              Assistant is typing…
            </Badge>
          </Box>
        )}
      </Group>
      <ThreadFeed
        threads={store.threads}
        activeId={store.activeId}
        onSelect={store.select}
        renderRow={(thread) => (
          <ThreadFeedRow
            key={thread.id}
            thread={thread}
            expanded
            // Pinned open: the Stream tab has one thread and nothing to collapse.
            onToggle={() => {}}
            {...(run !== undefined ? { liveParts: run.parts, liveStatus: run.status } : {})}
            onSend={({ text }) => start(thread.id, text)}
            onStop={() => stop(thread.id)}
            composerProps={{ placeholder: 'Send a message…' }}
          />
        )}
      />
    </Stack>
  )
}
