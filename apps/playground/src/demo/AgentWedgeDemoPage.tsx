/**
 * AgentWedgeDemoPage — the visible form of the F3 fix: a thread persisted as `'streaming'` (the
 * shape left behind by a reload/close mid-stream) must RESOLVE when `useAgentThreadRuns` next
 * mounts, not sit there forever with a spinner nothing is driving.
 *
 * "Seed a stuck thread" writes a thread straight into the persisted `ThreadsStore` via its plain
 * setters (`create` / `appendMessage` / `setResumeToken` / `setStatus`) — bypassing
 * `useAgentThreadRuns` entirely, which is exactly how a real orphan is produced: the tab reloaded
 * (or the run's controller was lost some other way) while `localStorage` still says `'streaming'`.
 * "Reconcile now" then remounts the reconciler subtree (via a `key` bump), so its mount-time
 * orphan-sweep effect (`use-agent-thread-runs.ts`'s empty-deps effect) runs fresh against that
 * seeded state — this repo does not touch that file, it only drives it.
 *
 * The status readout below distinguishes the two states a naive reader would conflate:
 * `'streaming'` in the persisted thread's own status vs. an ACTIVE run in `useAgentThreadRuns`'
 * `runs` map. A wedged thread shows the former without the latter — a spinner with nothing behind
 * it. Reconciling should turn that into either a live run (streaming, with growing parts) that
 * settles to `'done'`, never a permanent wedge.
 *
 * @example
 * <Route path="/agent-wedge" component={AgentWedgeDemoPage} />
 */
import { Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core'
import {
  createThreadsStore,
  useAgentThreadRuns,
  type AgentOutcome,
  type AgentPart,
  type AgentThread,
  type AgentTransport,
  type OutcomeResolver,
  type ThreadStatus,
} from 'basalt-ui/agent'
import { ThreadTranscript } from 'basalt-ui/agent-chat'
import { useState } from 'react'

// One stable store at module scope (createThreadsStore must be called ONCE per key, same rule as
// every other demo on this store).
const useWedgeThreads = createThreadsStore({ key: 'playground-agent-wedge', version: 1 })

const RESUME_TOKEN = 'wedge-demo-resume-token'

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Simulates a server replaying the tail of an interrupted run. Never called via `stream()` in
 * this demo — the whole point is the mount-time RESUME path, not a fresh send(). */
async function* wedgeResumeGenerator(signal?: AbortSignal): AsyncGenerator<AgentPart> {
  const chunks = [
    'Reconnected to the interrupted run — ',
    'picking back up right where the stream left off, ',
    'and finishing the answer that was in flight when this thread was persisted as `streaming`.',
  ]
  for (const text of chunks) {
    if (signal?.aborted) return
    await wait(400)
    yield { type: 'text', text }
  }
}

const wedgeTransport: AgentTransport<AgentPart, string> = {
  // Not exercised by this demo (no composer, nothing calls start()) — implemented only to satisfy
  // AgentTransport's required shape.
  async *stream(input: string, signal?: AbortSignal): AsyncGenerator<AgentPart> {
    if (signal?.aborted) return
    yield { type: 'text', text: `Echo: ${input}` }
  },
  resume: (_resumeToken: string, signal?: AbortSignal) => wedgeResumeGenerator(signal),
}

const wedgeOutcomeResolver: OutcomeResolver = (): AgentOutcome => ({
  title: 'Reconnected after reload',
  summary: 'Resumed the interrupted stream and finished the answer.',
  status: 'done',
})

const STATUS_COLOR: Record<ThreadStatus, string> = {
  pending: 'gray',
  streaming: 'blue',
  done: 'teal',
  attention: 'yellow',
  error: 'red',
  interrupted: 'orange',
}

/** Mounted (and remounted, via the parent's `key`) fresh per "Reconcile now" click so its
 * mount-time orphan-sweep effect runs against whatever is currently in the store. */
function WedgeReconciler({ thread }: { thread: AgentThread | undefined }) {
  const store = useWedgeThreads()
  const { runs } = useAgentThreadRuns({
    transport: wedgeTransport,
    store,
    resolveOutcome: wedgeOutcomeResolver,
  })

  const run = thread === undefined ? undefined : runs.get(thread.id)
  const wedged = thread?.status === 'streaming' && run === undefined

  return (
    <Stack gap="xs">
      <Group gap="xs" align="center">
        <Text size="sm" fw={500}>
          Reconciler mounted.
        </Text>
        {wedged && (
          <Badge color="red" variant="light">
            wedged — streaming with no active run
          </Badge>
        )}
        {run !== undefined && (
          <Badge color="blue" variant="light">
            active run — {run.parts.length} part{run.parts.length === 1 ? '' : 's'}
          </Badge>
        )}
      </Group>
    </Stack>
  )
}

export function AgentWedgeDemoPage() {
  const store = useWedgeThreads()
  const [reconcileToken, setReconcileToken] = useState(0)

  const thread = store.threads[0]

  const seedStuckThread = (): void => {
    store.clear()
    const id = store.create()
    store.appendMessage(id, {
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: 'Summarize the last deploy and flag anything risky.' }],
      createdAt: Date.now(),
    })
    store.setResumeToken(id, RESUME_TOKEN)
    store.setStatus(id, 'streaming')
  }

  return (
    <Stack gap="md" p="md">
      <div>
        <Group gap="xs" align="center">
          <Title order={3}>Agent — wedge recovery (F3)</Title>
          <Badge color="grape" variant="light">
            basalt-ui/agent
          </Badge>
        </Group>
        <Text size="sm" c="dimmed" mt={4}>
          A thread persisted as `streaming` (what a mid-stream reload leaves behind) must resolve
          the next time the run manager mounts, not hang forever. Seed one, then reconcile.
        </Text>
      </div>

      <Group gap="xs">
        <Button variant="default" onClick={seedStuckThread}>
          Seed a stuck thread
        </Button>
        <Button onClick={() => setReconcileToken((n) => n + 1)} disabled={thread === undefined}>
          Reconcile now
        </Button>
      </Group>

      <Paper p="sm">
        <Stack gap="sm">
          <Group gap="xs" align="center">
            <Text size="sm" fw={500}>
              Thread status:
            </Text>
            {thread === undefined ? (
              <Text size="sm" c="dimmed">
                none seeded yet
              </Text>
            ) : (
              <Badge color={STATUS_COLOR[thread.status]}>{thread.status}</Badge>
            )}
            {thread?.outcome !== undefined && thread.outcome !== null && (
              <Text size="sm" c="dimmed">
                {thread.outcome.summary}
              </Text>
            )}
          </Group>

          {/* Remounted fresh on every "Reconcile now" click — the point of the `key` bump is to
              trigger the reconciler's mount-time orphan sweep again, on demand. */}
          <WedgeReconciler key={reconcileToken} thread={thread} />
        </Stack>
      </Paper>

      {thread !== undefined && (
        <Paper p="sm">
          <ThreadTranscript messages={thread.messages} />
        </Paper>
      )}
    </Stack>
  )
}
