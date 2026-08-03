/**
 * ThreadsAdapterDemoPage — basalt-ui 1.12.0 playground gate demo 4: `ThreadsStoreAdapter` +
 * `createAdapterThreadsStore` + `threadsStoreAdapterContract`, against an in-memory "server"
 * (`./in-memory-adapter`) carrying an artificial 400 ms round trip.
 *
 * Two halves:
 *
 *  1. An interactive `ThreadWorkspace` — the SAME composite `/threads` uses, just handed
 *     `createAdapterThreadsStore(...)` instead of `createThreadsStore(...)`, proving the async
 *     store is a drop-in `ThreadsStore`. `hydrated`/`error`/thread-count badges above it surface
 *     what the workspace itself doesn't. "Create thread + send message instantly" fires the exact
 *     `create()` → `markRead()` → `appendMessage()` → `setStatus()` sequence the real send path
 *     issues in one synchronous block — the scenario that used to race the adapter before writes
 *     were serialized per thread id. "Fail the next write" arms a rollback: the next optimistic
 *     patch (create, or a message) rejects after the same 400 ms latency and reverts.
 *  2. The shipped `threadsStoreAdapterContract` suite, run IN THE PAGE against a fresh in-memory
 *     adapter per case, with pass/fail rendered per case — proving the suite is genuinely runnable
 *     by a consumer outside a test framework, which is its whole purpose.
 */
import { Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { createAdapterThreadsStore, threadsStoreAdapterContract } from 'basalt-ui/agent'
import { ThreadWorkspace } from 'basalt-ui/agent-chat'
import { useCallback, useState } from 'react'
import { IconReset, IconSparkle } from '../icons'
import { createControllableInMemoryAdapter, createInMemoryAdapter } from './in-memory-adapter'
import { mockOutcomeResolver, mockThreadTransport } from './thread-scenarios'

// ── Interactive store (module scope — called ONCE, same rule as every other agent demo) ────────

const { adapter: interactiveAdapter, armFailure } = createControllableInMemoryAdapter({
  latencyMs: 400,
})
const useThreads = createAdapterThreadsStore(interactiveAdapter, { revalidateOnFocus: false })

const WORKSPACE_HEIGHT = 520

// ── Contract suite (module scope — the case list itself is static) ──────────────────────────────

// A short latency here, not 0: the contract still exercises real async ordering, just fast enough
// to run ~13 cases back to back without the human waiting on the interactive demo's 400 ms.
const CONTRACT_CASES = threadsStoreAdapterContract(() => createInMemoryAdapter({ latencyMs: 15 }))

type ContractCaseStatus = 'running' | 'pass' | 'fail'
type ContractResults = Record<
  string,
  { readonly status: ContractCaseStatus; readonly error?: string }
>

function badgeColor(status: ContractCaseStatus | undefined): string {
  if (status === 'pass') return 'green'
  if (status === 'fail') return 'red'
  if (status === 'running') return 'blue'
  return 'gray'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ThreadsAdapterDemoPage() {
  const store = useThreads()
  const [contractResults, setContractResults] = useState<ContractResults>({})
  const [runningContract, setRunningContract] = useState(false)

  const handleCreateAndSend = useCallback(() => {
    const id = store.create()
    store.markRead(id)
    store.appendMessage(id, {
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ id: crypto.randomUUID(), type: 'text', text: 'Quick create-then-send probe' }],
      createdAt: Date.now(),
    })
    store.setStatus(id, 'streaming')
    store.select(id)
  }, [store])

  const runContractSuite = useCallback(async () => {
    setRunningContract(true)
    for (const testCase of CONTRACT_CASES) {
      setContractResults((prev) => ({ ...prev, [testCase.name]: { status: 'running' } }))
      try {
        await testCase.run()
        setContractResults((prev) => ({ ...prev, [testCase.name]: { status: 'pass' } }))
      } catch (error) {
        setContractResults((prev) => ({
          ...prev,
          [testCase.name]: {
            status: 'fail',
            error: error instanceof Error ? error.message : String(error),
          },
        }))
      }
    }
    setRunningContract(false)
  }, [])

  const passCount = Object.values(contractResults).filter((r) => r.status === 'pass').length
  const failCount = Object.values(contractResults).filter((r) => r.status === 'fail').length
  const errorMessage =
    store.error instanceof Error
      ? store.error.message
      : store.error === undefined
        ? null
        : String(store.error)

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>Threads adapter</Title>
        <Text size="sm" c="dimmed" mt={4}>
          <code>createAdapterThreadsStore</code> over an in-memory, 400&nbsp;ms-latency "server" —
          the same <code>ThreadWorkspace</code> the <code>/threads</code> demo uses, handed an async
          store instead of the localStorage one. Watch hydration on first load, optimistic append
          the instant you send, and rollback when a write is armed to fail.
        </Text>
      </div>

      <Group gap="sm" align="center">
        <Badge color={store.hydrated ? 'green' : 'gray'} variant="light">
          {store.hydrated ? 'hydrated' : 'hydrating…'}
        </Badge>
        {errorMessage !== null && (
          <Badge color="red" variant="light">
            error: {errorMessage}
          </Badge>
        )}
        <Badge variant="outline" color="gray">
          {store.threads.length} thread{store.threads.length === 1 ? '' : 's'}
        </Badge>
      </Group>

      <Group gap="xs">
        <Button radius="md" leftSection={<IconSparkle />} onClick={handleCreateAndSend}>
          Create thread + send message instantly
        </Button>
        <Button radius="md" variant="light" color="red" onClick={armFailure}>
          Fail the next write (rollback demo)
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        "Create thread + send" fires <code>create()</code> → <code>markRead()</code> →{' '}
        <code>appendMessage()</code> → <code>setStatus()</code> in one synchronous block — the
        adapter serializes these per thread id, so the dependent writes always find the row even
        though each one carries the artificial latency. Arm a failure first, then click it (or type
        a message below) to watch the optimistic thread/message roll back instead of landing.
      </Text>

      <div style={{ height: WORKSPACE_HEIGHT }}>
        <ThreadWorkspace
          useThreads={useThreads}
          transport={mockThreadTransport}
          resolveOutcome={mockOutcomeResolver}
          newThreadPlaceholder="Type a message to create a thread — exercises create()-then-append()"
        />
      </div>

      <Paper p="sm">
        <Group justify="space-between" align="center" mb="xs">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">
            threadsStoreAdapterContract — run against a fresh in-memory adapter per case
          </Text>
          <Group gap="xs">
            {Object.keys(contractResults).length > 0 && (
              <Text size="xs" c="dimmed">
                {passCount} passed · {failCount} failed
              </Text>
            )}
            <Button
              size="compact-xs"
              variant="default"
              leftSection={<IconReset />}
              onClick={() => void runContractSuite()}
              disabled={runningContract}
            >
              Run contract suite
            </Button>
          </Group>
        </Group>
        <Stack gap={4}>
          {CONTRACT_CASES.map((testCase) => {
            const result = contractResults[testCase.name]
            return (
              <Group key={testCase.name} gap={6} wrap="nowrap">
                <Badge size="xs" w={64} color={badgeColor(result?.status)} variant="light">
                  {result?.status ?? 'idle'}
                </Badge>
                <Text size="xs" ff="monospace">
                  {testCase.name}
                </Text>
                {result?.error !== undefined && (
                  <Text size="xs" c="red">
                    {result.error}
                  </Text>
                )}
              </Group>
            )
          })}
        </Stack>
      </Paper>
    </Stack>
  )
}
