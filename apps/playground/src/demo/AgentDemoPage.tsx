/**
 * AgentDemoPage — exercises useAgentStream, PartList, StreamingMarkdown, and BasaltStickToBottom
 * from basalt-ui/agent with a MOCK transport (no real backend required).
 *
 * The mock transport is an async generator that yields a sequence of AgentParts on a timer,
 * demonstrating the full streaming lifecycle: text chunks, a reasoning block, a tool call, a
 * source reference, and (on demand) an error part.
 */
import { Badge, Button, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
import {
  type AgentPart,
  type AgentTransport,
  BasaltStickToBottom,
  PartList,
  StreamingMarkdown,
  useAgentStream,
} from 'basalt-ui/agent'
import { useState } from 'react'

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

// ── Page ──────────────────────────────────────────────────────────────────────

export function AgentDemoPage() {
  const [input, setInput] = useState('Hello, agent!')
  const { parts, status, send, stop, regenerate } = useAgentStream({ transport: mockTransport })

  const handleSend = () => {
    if (input.trim()) void send(input.trim())
  }

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
          BasaltStickToBottom (lazy). Mock transport — no backend required.
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
          <Group gap="xs">
            <Text size="xs" c="dimmed">
              Status:
            </Text>
            <StatusBadge status={status} />
            <Text size="xs" c="dimmed">
              Parts: {parts.length}
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
    </Stack>
  )
}
