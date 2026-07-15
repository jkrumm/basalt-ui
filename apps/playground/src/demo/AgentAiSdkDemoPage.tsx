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
 * The three things this page proves:
 *   (a) a normal turn streams through the real AI-SDK wire shape (SSE UIMessageChunks, diffed into
 *       AgentParts) and renders correctly — intro text, a tool call, a cited source, an answer;
 *   (b) the network-drop simulation visibly stalls the UI (the mock backend abandons the live
 *       connection ~40% through the response, but keeps generating in the background — the debug
 *       panel polls the buffer to prove it);
 *   (c) reloading the actual browser tab resumes the SAME thread via useAgentThreadRuns' mount-time
 *       reconciliation, replays the full turn, and completes — without resending the question.
 */
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Code,
  Collapse,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { EmptyState } from 'basalt-ui'
import {
  aiSdkTransport,
  createThreadsStore,
  heuristicOutcome,
  StreamingMarkdown,
  useAgentThreadRuns,
} from 'basalt-ui/agent'
import type { AgentPart, ErrorPart, SourcePart, ToolCallPart } from 'basalt-ui/agent'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createMockAiSdkFetch, getBufferSnapshot, MOCK_API_PATH } from './mock-ai-sdk-backend'
import { IconReset, IconSend, IconSparkle, IconUser } from './icons'

// ── Persisted single-thread store + transport ─────────────────────────────────
// Both module-scope: createThreadsStore must be called ONCE per key (mirrors every other demo's
// store pattern); the transport is stable for the whole session so the mock backend's per-chat-id
// buffers are addressed consistently across renders and across the reload this page is built to
// survive.
const useAiSdkThreads = createThreadsStore({ key: 'agent-ai-sdk-demo', version: 1 })
const transport = aiSdkTransport<AgentPart>({ api: MOCK_API_PATH, fetch: createMockAiSdkFetch() })

// ── Tool-call-id aware block coalescing ───────────────────────────────────────
// Like /agent's coalesce(), but a 'tool' part with a toolCallId matching an EXISTING tool block
// updates that block in place (e.g. output-available arriving after input-available) instead of
// pushing a second near-duplicate block — this transport's diffing yields exactly that pattern.

type Block =
  | { kind: 'text'; key: string; text: string }
  | { kind: 'tool'; key: string; part: ToolCallPart }
  | { kind: 'sources'; key: string; parts: SourcePart[] }
  | { kind: 'error'; key: string; part: ErrorPart }

function coalesce(parts: AgentPart[]): Block[] {
  const blocks: Block[] = []
  const toolBlockIndexByCallId = new Map<string, number>()

  parts.forEach((part, i) => {
    const last = blocks.at(-1)
    if (part.type === 'text' || part.type === 'reasoning') {
      if (last?.kind === 'text') last.text += part.text
      else blocks.push({ kind: 'text', key: `b${i}`, text: part.text })
      return
    }
    if (part.type === 'tool') {
      const existingIndex =
        part.toolCallId !== undefined ? toolBlockIndexByCallId.get(part.toolCallId) : undefined
      if (existingIndex !== undefined) {
        const existing = blocks[existingIndex]
        if (existing?.kind === 'tool') blocks[existingIndex] = { ...existing, part }
        return
      }
      if (part.toolCallId !== undefined) toolBlockIndexByCallId.set(part.toolCallId, blocks.length)
      blocks.push({ kind: 'tool', key: `b${i}`, part })
      return
    }
    if (part.type === 'source') {
      if (last?.kind === 'sources') last.parts.push(part)
      else blocks.push({ kind: 'sources', key: `b${i}`, parts: [part] })
      return
    }
    if (part.type === 'start') return // no-op resumption signal, never rendered
    blocks.push({ kind: 'error', key: `b${i}`, part })
  })

  return blocks
}

// ── Block renderers ───────────────────────────────────────────────────────────

function TextBlock({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 'var(--mantine-font-size-sm)', lineHeight: 1.6 }}>
      <StreamingMarkdown>{text}</StreamingMarkdown>
    </div>
  )
}

function ToolBlock({ part }: { part: ToolCallPart }) {
  const [open, { toggle }] = useDisclosure(false)
  return (
    <Paper p="xs" bg="var(--mantine-color-default-hover)">
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <Group gap={6} wrap="nowrap">
          <Badge size="xs" variant="light" color="grape">
            tool
          </Badge>
          <Text size="xs" ff="monospace" fw={600}>
            {part.toolName}
          </Text>
          <Badge size="xs" variant="outline" color={part.output !== undefined ? 'teal' : 'gray'}>
            {part.output !== undefined ? 'done' : 'running'}
          </Badge>
        </Group>
        <Button size="compact-xs" variant="subtle" color="gray" onClick={toggle}>
          {open ? 'Hide' : 'Details'}
        </Button>
      </Group>
      <Collapse expanded={open}>
        <Stack gap={4} mt={6}>
          <Text size="10px" tt="uppercase" fw={700} c="dimmed">
            Input
          </Text>
          <Code block fz="11px">
            {JSON.stringify(part.input, null, 2)}
          </Code>
          {part.output !== undefined && (
            <>
              <Text size="10px" tt="uppercase" fw={700} c="dimmed">
                Output
              </Text>
              <Code block fz="11px">
                {JSON.stringify(part.output, null, 2)}
              </Code>
            </>
          )}
        </Stack>
      </Collapse>
    </Paper>
  )
}

function SourcesBlock({ parts }: { parts: SourcePart[] }) {
  return (
    <Group gap={6} wrap="wrap">
      <Text size="10px" tt="uppercase" fw={700} c="dimmed">
        Sources
      </Text>
      {parts.map((source, i) => (
        <Anchor
          key={i}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          underline="never"
        >
          <Badge size="sm" variant="outline" color="gray" style={{ cursor: 'pointer' }}>
            {source.title ?? source.url}
          </Badge>
        </Anchor>
      ))}
    </Group>
  )
}

function ErrorBlock({ part }: { part: ErrorPart }) {
  return (
    <Paper p="xs" bg="var(--mantine-color-red-light)">
      <Text size="xs" c="red">
        {part.message}
      </Text>
    </Paper>
  )
}

function AssistantBlocks({ parts }: { parts: AgentPart[] }) {
  const blocks = useMemo(() => coalesce(parts), [parts])
  return (
    <Stack gap="xs">
      {blocks.map((block) => {
        switch (block.kind) {
          case 'text':
            return <TextBlock key={block.key} text={block.text} />
          case 'tool':
            return <ToolBlock key={block.key} part={block.part} />
          case 'sources':
            return <SourcesBlock key={block.key} parts={block.parts} />
          case 'error':
            return <ErrorBlock key={block.key} part={block.part} />
        }
      })}
    </Stack>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ author, parts }: { author: 'user' | 'assistant'; parts: AgentPart[] }) {
  const isUser = author === 'user'
  const userText = isUser
    ? parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('')
    : ''
  return (
    <Group align="flex-start" wrap="nowrap" gap="sm" justify={isUser ? 'flex-end' : 'flex-start'}>
      {!isUser && (
        <ThemeIcon radius="xl" size="md" variant="light" color="gray">
          <IconSparkle />
        </ThemeIcon>
      )}
      {isUser ? (
        <Paper px="sm" py="xs" bg="var(--mantine-color-default-hover)" style={{ maxWidth: '78%' }}>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {userText}
          </Text>
        </Paper>
      ) : (
        <Box pt={2} style={{ maxWidth: '86%', overflowWrap: 'anywhere' }}>
          {parts.length > 0 ? (
            <AssistantBlocks parts={parts} />
          ) : (
            <Text size="sm" c="dimmed">
              …
            </Text>
          )}
        </Box>
      )}
      {isUser && (
        <ThemeIcon radius="xl" size="md" variant="default">
          <IconUser />
        </ThemeIcon>
      )}
    </Group>
  )
}

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
              <MessageBubble key={m.id} author={m.role} parts={m.parts} />
            ))}
            {run !== undefined && <MessageBubble author="assistant" parts={run.parts} />}
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
