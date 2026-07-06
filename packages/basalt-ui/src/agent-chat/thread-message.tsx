/**
 * thread-message — Mantine-styled AgentPart renderers plus a role-labelled transcript renderer.
 *
 * `threadPartRenderers` overrides the headless `PartList` defaults from `../agent` with Mantine
 * chrome: markdown text, a dimmed collapsible for reasoning ("Thinking"), a compact tool-call
 * Card, a source Anchor, and a red error Alert. `ThreadTranscript` composes those renderers over
 * a thread's settled messages plus an optional live (in-flight) assistant turn.
 *
 * This module is Mantine-coupled by design — it lives in `agent-chat/`, the root surface where
 * Mantine is allowed (unlike the Mantine-free `agent/` headless layer it renders on top of).
 *
 * @example
 * import { ThreadTranscript } from 'basalt-ui/agent-chat'
 *
 * <ThreadTranscript
 *   messages={thread.messages}
 *   liveParts={liveParts}
 *   liveStatus={runStatus}
 * />
 */
import {
  Alert,
  Anchor,
  Card,
  Collapse,
  Group,
  Loader,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import type { JSX } from 'react'
import type {
  AgentPart,
  AgentPartRenderers,
  ChatMessage,
  ErrorPart,
  ReasoningPart,
  SourcePart,
  StreamStatus,
  TextPart,
  ToolCallPart,
} from '../agent'
import { PartList, StreamingMarkdown } from '../agent'

// ── Per-type Mantine renderers ────────────────────────────────────────────────

function TextRenderer({ part }: { part: TextPart; index: number }): JSX.Element {
  return (
    <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      <StreamingMarkdown>{part.text}</StreamingMarkdown>
    </Text>
  )
}

/** A dimmed, collapsed-by-default disclosure for reasoning/thinking fragments. */
function ReasoningRenderer({ part }: { part: ReasoningPart; index: number }): JSX.Element {
  const [open, { toggle }] = useDisclosure(false)
  return (
    <Stack gap={4}>
      <UnstyledButton onClick={toggle}>
        <Text size="xs" c="dimmed" fw={500}>
          {open ? 'Hide thinking' : 'Thinking'}
        </Text>
      </UnstyledButton>
      <Collapse expanded={open}>
        <Text size="xs" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
          {part.text}
        </Text>
      </Collapse>
    </Stack>
  )
}

function ToolRenderer({ part }: { part: ToolCallPart; index: number }): JSX.Element {
  return (
    <Card withBorder radius="sm" padding="xs">
      <Stack gap={4}>
        <Text size="xs" ff="monospace" fw={600}>
          {part.toolName}
        </Text>
        <Text
          component="pre"
          size="10px"
          c="dimmed"
          style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
        >
          {JSON.stringify(part.input, null, 2)}
        </Text>
        {part.output !== undefined && (
          <Text
            component="pre"
            size="10px"
            style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
          >
            {JSON.stringify(part.output, null, 2)}
          </Text>
        )}
      </Stack>
    </Card>
  )
}

function SourceRenderer({ part }: { part: SourcePart; index: number }): JSX.Element {
  return (
    <Anchor href={part.url} target="_blank" rel="noopener noreferrer" size="sm">
      {part.title ?? part.url}
    </Anchor>
  )
}

function ErrorRenderer({ part }: { part: ErrorPart; index: number }): JSX.Element {
  return (
    <Alert color="red" variant="light" radius="sm" p="xs">
      {part.message}
    </Alert>
  )
}

/**
 * Mantine overrides for `PartList`'s default headless renderers — the house style for rendering
 * an `AgentPart` inside a chat surface.
 *
 * @example
 * import { PartList } from 'basalt-ui/agent'
 * import { threadPartRenderers } from 'basalt-ui/agent-chat'
 * <PartList parts={parts} components={threadPartRenderers} />
 */
export const threadPartRenderers: Partial<AgentPartRenderers> = {
  text: TextRenderer,
  reasoning: ReasoningRenderer,
  tool: ToolRenderer,
  source: SourceRenderer,
  error: ErrorRenderer,
}

// ── ThreadTranscript ──────────────────────────────────────────────────────────

// Streamed answers arrive as many small text parts; merge consecutive same-type text/reasoning
// parts so a streaming reply renders as one flowing block instead of a stack of fragments.
function coalesceParts(parts: AgentPart[]): AgentPart[] {
  const out: AgentPart[] = []
  for (const part of parts) {
    const last = out[out.length - 1]
    if (part.type === 'text' && last?.type === 'text') {
      out[out.length - 1] = { type: 'text', text: last.text + part.text }
    } else if (part.type === 'reasoning' && last?.type === 'reasoning') {
      out[out.length - 1] = { type: 'reasoning', text: last.text + part.text }
    } else {
      out.push(part)
    }
  }
  return out
}

const ROLE_LABEL: Record<ChatMessage['role'], string> = {
  user: 'You',
  assistant: 'Assistant',
}

function MessageBlock({
  author,
  parts,
  streaming = false,
}: {
  author: ChatMessage['role']
  parts: AgentPart[]
  streaming?: boolean
}): JSX.Element {
  return (
    <Stack gap={6}>
      <Group gap={6} align="center">
        <Text size="10px" tt="uppercase" fw={700} c="dimmed">
          {ROLE_LABEL[author]}
        </Text>
        {streaming && <Loader size="xs" />}
      </Group>
      <PartList parts={coalesceParts(parts)} components={threadPartRenderers} />
    </Stack>
  )
}

export type ThreadTranscriptProps = {
  /** Settled messages for the thread, oldest first. */
  readonly messages: ChatMessage[]
  /** The live (in-flight) assistant turn's parts, when a run is streaming for this thread. */
  readonly liveParts?: AgentPart[]
  /** The live run's status — drives the in-progress indicator on the live block. */
  readonly liveStatus?: StreamStatus
}

/**
 * Renders a thread's settled messages, each role-labelled ("You" / "Assistant") and rendered via
 * `PartList` + `threadPartRenderers`. When `liveParts` is non-empty, an extra in-progress
 * assistant block is appended at the tail.
 *
 * @example
 * import { ThreadTranscript } from 'basalt-ui/agent-chat'
 * <ThreadTranscript messages={thread.messages} liveParts={liveParts} liveStatus={runStatus} />
 */
export function ThreadTranscript({
  messages,
  liveParts,
  liveStatus,
}: ThreadTranscriptProps): JSX.Element {
  return (
    <Stack gap="lg">
      {messages.map((message) => (
        <MessageBlock key={message.id} author={message.role} parts={message.parts} />
      ))}
      {liveParts !== undefined && liveParts.length > 0 && (
        <div aria-live="polite" aria-atomic="false" aria-relevant="additions">
          <MessageBlock
            author="assistant"
            parts={liveParts}
            streaming={liveStatus === 'streaming'}
          />
        </div>
      )}
    </Stack>
  )
}
