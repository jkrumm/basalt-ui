/**
 * AgentDemoPage — exercises useAgentStream, PartList, StreamingMarkdown, BasaltStickToBottom,
 * edenTransport (wire-up reference), createChatHistoryStore (persisted history + clear), and
 * a "fail mid-stream" mock transport proving the error status renders.
 *
 * The mock transport is an async generator that yields a sequence of AgentParts on a timer,
 * demonstrating the full streaming lifecycle: text chunks, a reasoning block, a tool call, a
 * source reference, and (on demand) an error part.
 */
import { Badge, Button, Divider, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
import {
  type AgentPart,
  type AgentTransport,
  BasaltStickToBottom,
  createChatHistoryStore,
  edenTransport,
  PartList,
  StreamingMarkdown,
  useAgentStream,
} from 'basalt-ui/agent'
import { useCallback, useState } from 'react'

// ── edenTransport wire-up (reference) ────────────────────────────────────────
// In a real app: import your Eden treaty client and wire the streaming route.
// The call must forward `signal` so stop() aborts the in-flight request.
//
//   const transport = edenTransport<AgentPart>((input, signal) =>
//     api.chat.post({ body: { message: input }, fetch: { signal } }),
//   )
//
// Satisfies the AgentTransport<AgentPart, string> interface — no extra deps.
void edenTransport // type-exercises the export without instantiating (no live server)

// ── Persisted history store ───────────────────────────────────────────────────
// Call once at module scope with a stable key — survives navigate-away/back.
const useChatHistory = createChatHistoryStore({ key: 'agent-demo-history', version: 1 })

// ── Mock transport ────────────────────────────────────────────────────────────

/** Simulated response parts — exercises all AgentPart variants. */
function mockParts(input: string): AgentPart[] {
  return [
    { type: 'reasoning', text: `Processing: "${input}"` },
    { type: 'text', text: `## Response to: ${input}\n\n` },
    { type: 'text', text: 'This is a **streamed** markdown response.\n\n' },
    { type: 'text', text: '- Item one\n- Item two\n- Item three\n\n' },
    { type: 'text', text: 'Here is some `inline code` and a paragraph.\n\n' },
    {
      type: 'tool',
      toolName: 'search',
      input: { query: input, limit: 5 },
      output: { results: ['Result A', 'Result B'] },
    },
    { type: 'source', url: 'https://example.com/doc', title: 'Example Documentation' },
    { type: 'text', text: '> Streaming complete.\n' },
  ]
}

/**
 * Mock AgentTransport: yields parts on a 120ms timer to simulate streaming.
 * Respects the AbortSignal so stop() cancels mid-stream.
 */
const mockTransport: AgentTransport<AgentPart, string> = {
  async *stream(input: string, signal?: AbortSignal): AsyncGenerator<AgentPart> {
    const parts = mockParts(input)
    for (const part of parts) {
      if (signal?.aborted) return
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 120)
        signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer)
            reject(new DOMException('Aborted', 'AbortError'))
          },
          { once: true },
        )
      })
      if (signal?.aborted) return
      yield part
    }
  },
}

/**
 * Fail mid-stream transport: yields two text parts, then throws after 300ms.
 * Proves the error status renders correctly in the status badge.
 */
const failTransport: AgentTransport<AgentPart, string> = {
  async *stream(): AsyncGenerator<AgentPart> {
    yield { type: 'text', text: 'Starting stream…\n\n' }
    await new Promise<void>((r) => setTimeout(r, 300))
    yield { type: 'text', text: 'About to fail…\n' }
    await new Promise<void>((r) => setTimeout(r, 300))
    throw new Error('Simulated mid-stream failure')
  },
}

// ── Part renderers ────────────────────────────────────────────────────────────

/**
 * Hoisted text renderer — passes text parts through StreamingMarkdown for rich rendering.
 * Defined at module scope (not inside the component) to avoid re-creation on each render.
 */
function MarkdownTextRenderer({ part }: { part: { type: 'text'; text: string }; index: number }) {
  return <StreamingMarkdown>{part.text}</StreamingMarkdown>
}

const AGENT_PART_COMPONENTS = { text: MarkdownTextRenderer } as const

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'idle'
      ? 'gray'
      : status === 'streaming'
        ? 'blue'
        : status === 'done'
          ? 'green'
          : 'red'
  return (
    <Badge size="sm" color={color} variant="light">
      {status}
    </Badge>
  )
}

// ── History panel ─────────────────────────────────────────────────────────────

function HistoryPanel() {
  const { messages, clear } = useChatHistory()

  return (
    <Paper p="sm" radius="md" withBorder>
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">
            Persisted history ({messages.length} turns)
          </Text>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            disabled={messages.length === 0}
            onClick={clear}
          >
            Clear history
          </Button>
        </Group>
        <Text size="xs" c="dimmed">
          Accumulated via createChatHistoryStore — survives navigate-away/back.
        </Text>
        {messages.length === 0 ? (
          <Text size="xs" c="dimmed" fs="italic">
            No turns yet.
          </Text>
        ) : (
          <Stack gap={4}>
            {messages.map((m) => {
              const textPart = m.parts.find(
                (p): p is { type: 'text'; text: string } => p.type === 'text',
              )
              return (
                <Group key={m.id} gap="xs" wrap="nowrap" align="flex-start">
                  <Badge size="xs" variant="dot" color={m.role === 'user' ? 'blue' : 'gray'}>
                    {m.role}
                  </Badge>
                  <Text size="xs" c="dimmed" style={{ flex: 1 }} lineClamp={1}>
                    {textPart?.text.slice(0, 80) ?? `(${m.parts.length} parts)`}
                  </Text>
                </Group>
              )
            })}
          </Stack>
        )}
      </Stack>
    </Paper>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AgentDemoPage() {
  const [input, setInput] = useState('Hello, agent!')
  const [useFail, setUseFail] = useState(false)
  const transport = useFail ? failTransport : mockTransport
  const { parts, status, send, stop, regenerate } = useAgentStream({ transport })
  const { append } = useChatHistory()

  const handleSend = useCallback(() => {
    if (!input.trim()) return
    const userInput = input.trim()
    // Append user turn to persisted history
    append({
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: userInput }],
      createdAt: Date.now(),
    })
    // The assistant turn is rendered live from `parts`; a real app would append the settled
    // assistant message to history via a ref after the stream resolves.
    void send(userInput)
  }, [input, append, send])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>./agent battery</Title>
        <Text size="sm" c="dimmed" mt={4}>
          useAgentStream + edenTransport seam + PartList (exhaustive) + StreamingMarkdown (lazy) +
          BasaltStickToBottom (lazy) + createChatHistoryStore (persisted) + fail mid-stream path.
        </Text>
      </div>

      <Paper p="sm" radius="md" withBorder>
        <Stack gap="xs">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">
            Controls
          </Text>
          <Group gap="sm" align="flex-end">
            <TextInput
              flex={1}
              placeholder="Type a message…"
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              disabled={status === 'streaming'}
            />
            <Button onClick={handleSend} disabled={status === 'streaming' || !input.trim()}>
              Send
            </Button>
            {status === 'streaming' && (
              <Button variant="outline" color="red" onClick={stop}>
                Stop
              </Button>
            )}
            {(status === 'done' || status === 'error') && (
              <Button variant="light" onClick={() => void regenerate()}>
                Regenerate
              </Button>
            )}
          </Group>
          <Group gap="xs" wrap="wrap">
            <Text size="xs" c="dimmed">
              Status:
            </Text>
            <StatusBadge status={status} />
            <Text size="xs" c="dimmed">
              Parts: {parts.length}
            </Text>
            <Button
              size="compact-xs"
              variant={useFail ? 'filled' : 'default'}
              color={useFail ? 'red' : 'gray'}
              onClick={() => setUseFail((v) => !v)}
            >
              {useFail ? 'Fail transport ON' : 'Fail transport OFF'}
            </Button>
            <Text size="xs" c="dimmed">
              Toggle to simulate a mid-stream error — send a message to see status → error.
            </Text>
          </Group>
        </Stack>
      </Paper>

      <Paper
        radius="md"
        withBorder
        style={{ height: 400, position: 'relative', overflow: 'hidden' }}
      >
        <BasaltStickToBottom style={{ height: '100%', overflowY: 'auto', padding: '12px' }}>
          {parts.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              No parts yet — press Send to start streaming.
            </Text>
          ) : (
            <PartList
              parts={parts}
              // MarkdownTextRenderer is hoisted to module scope (no inline component).
              components={AGENT_PART_COMPONENTS}
            />
          )}
        </BasaltStickToBottom>
      </Paper>

      <Paper p="sm" radius="md" withBorder>
        <Stack gap="xs">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">
            Accumulated parts (raw)
          </Text>
          <Text size="xs" c="dimmed" ff="monospace" style={{ whiteSpace: 'pre-wrap' }}>
            {parts
              .map((p, i) => `[${i}] ${p.type}: ${JSON.stringify(p).slice(0, 80)}`)
              .join('\n') || '(empty)'}
          </Text>
        </Stack>
      </Paper>

      <Divider />

      <HistoryPanel />
    </Stack>
  )
}
