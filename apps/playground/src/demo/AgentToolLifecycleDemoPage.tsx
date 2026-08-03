/**
 * AgentToolLifecycleDemoPage — the 1.11.0 playground gate's tool-lifecycle demo: drives ONE tool
 * call through the real seven-state `ToolCallPart` union (`input-streaming`, `input-available`,
 * `approval-requested`, `approval-responded`, then a terminal state) and renders it as exactly ONE
 * `ToolChip` that updates in place — the property `coalesceParts`/`mergePart`'s toolCallId-keyed
 * merge exists for.
 *
 * The approval step is a REAL pause, not a scripted timer: `mock-ai-sdk-backend.ts`'s
 * `runToolLifecycleGeneration` blocks on an actual promise until THIS page's `ToolChip`
 * `onApprove`/`onDeny` handlers call `resolveToolApproval`, so the affordances rendered here are
 * driving the same state machine a real backend would. Choosing "succeeds" vs "fails" beforehand
 * picks which terminal state an approval reaches; Deny always lands on `output-denied` regardless —
 * between the two run buttons and the Deny action, all seven wire states get exercised.
 *
 * A fresh transport (a fresh chat id) is minted on every `send()` so re-running the demo never
 * reuses an already-`done` mock buffer.
 *
 * @example
 * <Route path="/agent-tool-lifecycle" component={AgentToolLifecycleDemoPage} />
 */
import { Badge, Button, Group, List, Paper, Stack, Text, Title } from '@mantine/core'
import { EmptyState } from 'basalt-ui'
import { aiSdkTransport, useAgentStream } from 'basalt-ui/agent'
import type { AgentPart, AgentTransport } from 'basalt-ui/agent'
import { ToolChip } from 'basalt-ui/agent-chat'
import { useCallback, useEffect, useRef, useState } from 'react'
import { IconReset, IconSparkle } from './icons'
import {
  createMockAiSdkFetch,
  resolveToolApproval,
  TOOL_DEMO_API_PATH,
} from './mock-ai-sdk-backend'
import type { ToolDemoOutcome } from './mock-ai-sdk-backend'

type ToolPart = Extract<AgentPart, { type: 'tool' }>

// Module-scope base transport (mirrors every other agent demo's stable-transport rule). Its chat id
// is never used directly — `toolLifecycleTransport.stream` mints a FRESH one via `.forThread()` on
// every call, so re-running the demo never replays an already-`done` mock buffer.
const baseTransport = aiSdkTransport<AgentPart>({
  api: TOOL_DEMO_API_PATH,
  fetch: createMockAiSdkFetch(),
})

const toolLifecycleTransport: AgentTransport<AgentPart, string> = {
  stream: (input, signal) => baseTransport.forThread(crypto.randomUUID()).stream(input, signal),
}

/** One line per distinct state/refinement the tool part has passed through — the demo's visible
 * transition log. */
function describeTransition(part: ToolPart): string {
  switch (part.state) {
    case 'input-streaming':
      return 'input-streaming — provider is still streaming the input JSON'
    case 'input-available':
      return 'input-available — input complete, no output yet ("running")'
    case 'approval-requested':
      return 'approval-requested — waiting on a real Approve/Deny click below'
    case 'approval-responded':
      return `approval-responded — ${part.approval.approved ? 'approved' : 'declined'}`
    case 'output-available':
      return part.preliminary === true
        ? 'output-available (preliminary) — a first, unsettled result'
        : 'output-available (final) — the preliminary result just refined in place'
    case 'output-error':
      return `output-error — ${part.errorText}`
    case 'output-denied':
      return 'output-denied — the approval was declined'
  }
}

/** A stable key per (state, preliminary) pair — used to dedupe consecutive identical log entries
 * without importing `coalesceParts`' own by-id merge logic into the demo. */
function transitionKey(part: ToolPart): string {
  return part.state === 'output-available'
    ? `${part.state}:${String(part.preliminary)}`
    : part.state
}

export function AgentToolLifecycleDemoPage() {
  const { parts, status, send } = useAgentStream<AgentPart>({ transport: toolLifecycleTransport })
  const [history, setHistory] = useState<string[]>([])
  const lastLoggedRef = useRef<string | null>(null)

  const toolParts = parts.filter((part): part is ToolPart => part.type === 'tool')
  const toolPart = toolParts[0]

  useEffect(() => {
    if (toolPart === undefined) return
    const key = transitionKey(toolPart)
    if (lastLoggedRef.current === key) return
    lastLoggedRef.current = key
    setHistory((prev) => [...prev, describeTransition(toolPart)])
  }, [toolPart])

  const handleRun = useCallback(
    (outcome: ToolDemoOutcome) => {
      setHistory([])
      lastLoggedRef.current = null
      void send(outcome)
    },
    [send],
  )

  const handleApprove = useCallback((approvalId: string) => {
    resolveToolApproval(approvalId, true)
  }, [])
  const handleDeny = useCallback((approvalId: string) => {
    resolveToolApproval(approvalId, false, 'Declined in the playground demo')
  }, [])

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>Agent chat — tool lifecycle</Title>
        <Text size="sm" c="dimmed" mt={4}>
          Drives one <code>transfer_funds</code> tool call through all seven{' '}
          <code>ToolCallPart</code> wire states — <code>input-streaming</code>,{' '}
          <code>input-available</code>, <code>approval-requested</code>,{' '}
          <code>approval-responded</code>, then a terminal state — and renders it as exactly ONE{' '}
          <code>ToolChip</code> that updates in place, never stacking a new chip per state.
        </Text>
      </div>

      <Group gap="xs">
        <Button
          radius="md"
          leftSection={<IconSparkle />}
          onClick={() => handleRun('succeed')}
          disabled={status === 'streaming'}
        >
          Run (approve → succeeds)
        </Button>
        <Button
          radius="md"
          variant="light"
          leftSection={<IconSparkle />}
          onClick={() => handleRun('fail')}
          disabled={status === 'streaming'}
        >
          Run (approve → fails)
        </Button>
        <Button
          radius="md"
          variant="default"
          leftSection={<IconReset />}
          onClick={() => handleRun('succeed')}
        >
          Reset
        </Button>
      </Group>

      <Paper py="xs" px="sm" style={{ minHeight: 96 }}>
        {toolPart === undefined ? (
          <Stack align="center" justify="center" mih={90}>
            <EmptyState
              icon={<IconSparkle />}
              title="Run the demo to start a tool call"
              description="Approving pauses for real at approval-requested — the Approve/Deny buttons below drive the same state machine a real backend would."
              variant="section"
            />
          </Stack>
        ) : (
          <ToolChip part={toolPart} defaultExpanded onApprove={handleApprove} onDeny={handleDeny} />
        )}
      </Paper>

      <Group gap="xs" align="center">
        <Text size="sm">
          Tool parts in this turn's <code>parts</code> array:
        </Text>
        <Badge color={toolParts.length <= 1 ? 'teal' : 'red'} variant="light">
          {toolParts.length}
        </Badge>
        <Text size="xs" c="dimmed">
          (mergePart addresses every state update by the same <code>tool#toolCallId</code> — this
          stays 1 across every transition below, proving the chip updates in place.)
        </Text>
      </Group>

      <Paper p="sm">
        <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb="xs">
          Transitions observed this run
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
