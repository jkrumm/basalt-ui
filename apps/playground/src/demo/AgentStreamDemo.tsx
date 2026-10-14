/**
 * AgentStreamDemo — the `/agent` Stream tab: one thread driven by `useAgentThreadRuns` over the
 * deterministic in-memory `richTransport`, rendered with `ThreadFeed` (inline row) and its
 * `Composer`. Also the surface the `chat-profile` evidence lane measures: a fixed ~3 s, ~1500-word
 * reply with no network and no model. Threads live in a throwaway in-memory store.
 */
import { Badge, Group, Stack, Text } from '@mantine/core'
import { ThreadFeed, ThreadFeedRow, useAgentThreadRuns } from 'basalt-ui/agent'
import type { AgentPart, AgentThread, OutcomeResolver, ThreadsStore } from 'basalt-ui/agent'
import { useMemo, useState } from 'react'
import { richTransport } from './agent-scenarios'

const THREAD_ID = 'stream-demo'

const seedThread = (): AgentThread<AgentPart> => {
  const now = Date.now()
  return {
    id: THREAD_ID,
    messages: [],
    outcome: {
      title: 'Deep modules and coupling',
      summary: 'A replayed demo stream.',
      status: 'done',
    },
    status: 'pending',
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

const resolveOutcome: OutcomeResolver<AgentPart> = (thread) => ({
  title: thread.outcome?.title ?? 'Deep modules and coupling',
  summary: `${thread.messages.length} messages`,
  status: 'done',
})

export function AgentStreamDemo() {
  const store = useMemoryThreadsStore()
  const { runs, start, stop } = useAgentThreadRuns({
    transport: richTransport,
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
          <Badge variant="light" aria-label="Assistant is typing">
            Assistant is typing…
          </Badge>
        )}
      </Group>
      <ThreadFeed
        threads={store.threads}
        activeId={store.activeId}
        onSelect={store.select}
        variant="inline"
        renderRow={(thread) => (
          <ThreadFeedRow
            key={thread.id}
            thread={thread}
            expanded
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
