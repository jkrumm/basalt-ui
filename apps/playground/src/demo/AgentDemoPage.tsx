/**
 * AgentDemoPage — a real, multi-turn chat built on basalt-ui/agent.
 *
 * This is the mature counterpart to the old "battery": a usable conversation, not a primitive
 * exerciser. The persisted thread (createChatHistoryStore) is the source of truth for settled
 * turns; the live streaming turn (useAgentStream) renders at the tail and is committed to the
 * thread when it resolves (done OR error). Consecutive `text` deltas are coalesced into a single
 * markdown block before rendering, so token-by-token streams render as one document — the way a
 * real agent UI must.
 *
 * The simulation/dev affordances are preserved (the user wants to keep testing the package): a
 * scenario picker, a stream-speed toggle, a raw-parts inspector, regenerate, and clear all live in
 * a secondary "Simulation & dev" panel below the chat. Swap `scenarioTransport(...)` for
 * `edenTransport(...)` and this page is a production chat.
 */
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Code,
  Collapse,
  Divider,
  Group,
  Paper,
  Select,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  BasaltStickToBottom,
  createChatHistoryStore,
  StreamingMarkdown,
  useAgentStream,
} from 'basalt-ui/agent'
import type { AgentPart, ErrorPart, SourcePart, ToolCallPart } from 'basalt-ui/agent'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AGENT_SCENARIOS, scenarioTransport } from './agent-scenarios'
import type { StreamSpeed } from './agent-scenarios'
import { IconSend, IconSparkle, IconStop, IconTrash, IconUser } from './icons'

// ── Persisted conversation thread ─────────────────────────────────────────────
// One stable store at module scope. Survives navigate-away/back and reloads (cross-tab too).
const useConversation = createChatHistoryStore({ key: 'agent-demo-chat', version: 1 })

// ── Part coalescing ────────────────────────────────────────────────────────────
// A streamed turn is a flat list of parts where text arrives as many small deltas. For rendering
// we merge consecutive text (and consecutive reasoning / source) runs into single blocks, so the
// markdown renders as one document and sources group into one row.

type Block =
  | { kind: 'text'; key: string; text: string }
  | { kind: 'reasoning'; key: string; text: string }
  | { kind: 'tool'; key: string; part: ToolCallPart }
  | { kind: 'sources'; key: string; parts: SourcePart[] }
  | { kind: 'error'; key: string; part: ErrorPart }

function coalesce(parts: AgentPart[]): Block[] {
  const blocks: Block[] = []
  parts.forEach((part, i) => {
    const last = blocks.at(-1)
    if (part.type === 'text') {
      if (last?.kind === 'text') last.text += part.text
      else blocks.push({ kind: 'text', key: `b${i}`, text: part.text })
    } else if (part.type === 'reasoning') {
      if (last?.kind === 'reasoning') last.text += part.text
      else blocks.push({ kind: 'reasoning', key: `b${i}`, text: part.text })
    } else if (part.type === 'tool') {
      blocks.push({ kind: 'tool', key: `b${i}`, part })
    } else if (part.type === 'source') {
      if (last?.kind === 'sources') last.parts.push(part)
      else blocks.push({ kind: 'sources', key: `b${i}`, parts: [part] })
    } else {
      blocks.push({ kind: 'error', key: `b${i}`, part })
    }
  })
  return blocks
}

// ── Block renderers (module scope — no inline components) ──────────────────────

function TextBlock({ text }: { text: string }) {
  // Own the markdown styling via the package's `basalt-agent-md-*` class hooks (styled in the
  // page-level <style> below). We deliberately do NOT wrap in Mantine's <Typography>: it sizes
  // blockquotes at --mantine-font-size-lg and headings at full h1/h2/h3 sizes, which reads far too
  // large inside a chat bubble. This keeps every element at the compact chat body size.
  return (
    <div className="basalt-chat-md">
      <StreamingMarkdown>{text}</StreamingMarkdown>
    </div>
  )
}

function ReasoningBlock({ text }: { text: string }) {
  const [open, { toggle }] = useDisclosure(false)
  return (
    <Box>
      <Button
        size="compact-xs"
        variant="subtle"
        color="gray"
        onClick={toggle}
        leftSection={<IconSparkle />}
      >
        {open ? 'Hide reasoning' : 'Show reasoning'}
      </Button>
      <Collapse expanded={open}>
        <Text
          size="xs"
          c="dimmed"
          mt={6}
          pl="sm"
          style={{
            whiteSpace: 'pre-wrap',
            borderLeft: '2px solid var(--mantine-color-default-border)',
          }}
        >
          {text}
        </Text>
      </Collapse>
    </Box>
  )
}

function ToolBlock({ part }: { part: ToolCallPart }) {
  const [open, { toggle }] = useDisclosure(false)
  return (
    <Paper withBorder radius="sm" p="xs" bg="var(--mantine-color-default-hover)">
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <Group gap={6} wrap="nowrap">
          <Badge size="xs" variant="light" color="grape">
            tool
          </Badge>
          <Text size="xs" ff="monospace" fw={600}>
            {part.toolName}
          </Text>
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
    <Paper withBorder radius="sm" p="xs" bg="var(--mantine-color-red-light)">
      <Group gap={6} wrap="nowrap" align="flex-start">
        <Badge size="xs" color="red" variant="light">
          error
        </Badge>
        <Text size="xs" c="red" style={{ flex: 1 }}>
          {part.message}
        </Text>
      </Group>
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
          case 'reasoning':
            return <ReasoningBlock key={block.key} text={block.text} />
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

// ── Message bubble ──────────────────────────────────────────────────────────────

/** A single turn. `streaming` adds a typing indicator and is only set on the live assistant turn. */
function MessageBubble({
  author,
  parts,
  streaming = false,
}: {
  author: 'user' | 'assistant'
  parts: AgentPart[]
  streaming?: boolean
}) {
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
        // User: a subtle neutral bubble (no blue), right-aligned.
        <Paper
          radius="md"
          px="sm"
          py={8}
          bg="var(--mantine-color-default-hover)"
          style={{ maxWidth: '78%' }}
        >
          <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {userText}
          </Text>
        </Paper>
      ) : (
        // Assistant: no bubble — reads as flowing text beside the avatar.
        <Box pt={2} style={{ maxWidth: '86%', overflowWrap: 'anywhere' }}>
          <Stack gap="xs">
            {parts.length > 0 && <AssistantBlocks parts={parts} />}
            {streaming && (
              <Group gap={5} align="center" aria-label="Assistant is typing">
                <TypingDot delay={0} />
                <TypingDot delay={160} />
                <TypingDot delay={320} />
              </Group>
            )}
          </Stack>
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

function TypingDot({ delay }: { delay: number }) {
  return (
    <Box
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'var(--mantine-color-dimmed)',
        animation: `basalt-typing 1s ${delay}ms ease-in-out infinite`,
      }}
    />
  )
}

// ── Empty state ─────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'How do I keep the shell router-agnostic?',
  'Explain the --vx-* token system',
  'When should I extract a chart kind?',
]

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <Stack align="center" justify="center" gap="md" h="100%" py="xl">
      <ThemeIcon radius="xl" size={52} variant="light" color="gray">
        <IconSparkle />
      </ThemeIcon>
      <Stack gap={2} align="center">
        <Text fw={600}>Start a conversation</Text>
        <Text size="sm" c="dimmed" ta="center" maw={340}>
          A streaming chat over basalt-ui/agent. Pick a simulation below, or try a prompt:
        </Text>
      </Stack>
      <Group gap="xs" justify="center" maw={460}>
        {SUGGESTIONS.map((s) => (
          <Button key={s} size="compact-sm" variant="default" radius="xl" onClick={() => onPick(s)}>
            {s}
          </Button>
        ))}
      </Group>
    </Stack>
  )
}

// ── Page-scoped styles ──────────────────────────────────────────────────────────
// Typing-indicator keyframes + compact chat prose for the `basalt-agent-md-*` hooks. Scoped under
// `.basalt-chat-md` so it only touches the streamed assistant markdown. Everything resolves to the
// chat body size (sm) — headings stay slightly emphasized, blockquote becomes a quiet rule, code
// gets a subtle surface — instead of Mantine Typography's article scaling.
const CHAT_STYLES = `
@keyframes basalt-typing{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-2px)}}
.basalt-chat-md{font-size:var(--mantine-font-size-sm);line-height:1.6;overflow-wrap:anywhere}
.basalt-chat-md>:first-child{margin-top:0}
.basalt-chat-md>:last-child{margin-bottom:0}
.basalt-agent-md-p{margin:0 0 .6em}
.basalt-agent-md-h1,.basalt-agent-md-h2,.basalt-agent-md-h3{font-size:var(--mantine-font-size-md);font-weight:700;line-height:1.35;margin:1em 0 .4em}
.basalt-agent-md-ul,.basalt-agent-md-ol{margin:0 0 .6em;padding-left:1.4em}
.basalt-agent-md-li{margin:.15em 0}
.basalt-agent-md-li::marker{color:var(--mantine-color-dimmed)}
.basalt-agent-md-a{color:var(--mantine-color-anchor);text-decoration:underline;text-underline-offset:2px}
.basalt-agent-md-code{font-family:var(--mantine-font-family-monospace);font-size:.85em;padding:.1em .35em;border-radius:var(--mantine-radius-sm);background:var(--mantine-color-default-hover);border:1px solid var(--mantine-color-default-border)}
.basalt-agent-md-pre{margin:0 0 .6em;padding:.7em .85em;border-radius:var(--mantine-radius-sm);background:var(--mantine-color-default-hover);border:1px solid var(--mantine-color-default-border);overflow-x:auto}
.basalt-agent-md-pre .basalt-agent-md-code{padding:0;background:none;border:0;font-size:.8rem}
.basalt-agent-md-blockquote{margin:.6em 0;padding:.15em 0 .15em .8em;border-left:2px solid var(--mantine-color-default-border);color:var(--mantine-color-dimmed);font-style:normal;font-size:inherit}
`

// ── Page ──────────────────────────────────────────────────────────────────────

export function AgentDemoPage() {
  const { messages, append, clear } = useConversation()

  const [scenarioValue, setScenarioValue] = useState<string>(AGENT_SCENARIOS[0].value)
  const [speed, setSpeed] = useState<StreamSpeed>('normal')
  const [input, setInput] = useState('')
  const [devOpen, { toggle: toggleDev }] = useDisclosure(true)

  const scenario = AGENT_SCENARIOS.find((s) => s.value === scenarioValue) ?? AGENT_SCENARIOS[0]
  const transport = useMemo(() => scenarioTransport(scenario, speed), [scenario, speed])

  const { parts, status, error, send, stop, regenerate } = useAgentStream({ transport })

  // Whether the current live turn has already been committed to the persisted thread. A ref (not
  // state): flipping it must not itself re-render — the commit's append() drives the re-render, and
  // both land in one commit so the live tail and the settled turn never double-render or flicker.
  const committedRef = useRef(true)
  const streaming = status === 'streaming'

  // Commit the finished assistant turn to the thread exactly once (on done OR error). For an error,
  // any partial text is kept and an error part is appended so the failure renders inline like a real
  // chat. `showLive` stays true until committedRef flips here, and that flip lands in the same commit
  // that grows the thread — since the live tail and the settled turn render identical content, the
  // handoff is seamless (no empty frame, no flicker). The ref guard makes it idempotent.
  useEffect(() => {
    if (status !== 'done' && status !== 'error') return
    if (committedRef.current) return
    committedRef.current = true
    const finalParts: AgentPart[] =
      status === 'error' ? [...parts, { type: 'error', message: errorMessage(error) }] : parts
    // Don't persist an empty assistant turn (e.g. stop() before any token arrived).
    if (finalParts.length > 0) {
      append({
        id: crypto.randomUUID(),
        role: 'assistant',
        parts: finalParts,
        createdAt: Date.now(),
      })
    }
  }, [status, parts, error, append])

  const showLive = streaming || ((status === 'done' || status === 'error') && !committedRef.current)

  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || streaming) return
      committedRef.current = false
      append({
        id: crypto.randomUUID(),
        role: 'user',
        parts: [{ type: 'text', text: trimmed }],
        createdAt: Date.now(),
      })
      void send(trimmed)
    },
    [streaming, append, send],
  )

  const handleComposerSend = useCallback(() => {
    sendText(input)
    setInput('')
  }, [input, sendText])

  const handleRegenerate = useCallback(() => {
    if (streaming) return
    committedRef.current = false
    void regenerate()
  }, [streaming, regenerate])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleComposerSend()
    }
  }

  const isEmpty = messages.length === 0 && !showLive

  return (
    <Stack gap="md" p="md">
      {/*
        Page-scoped styles: the typing-indicator keyframes, plus compact chat prose for the
        streamed markdown. StreamingMarkdown tags every element with a `basalt-agent-md-*` class
        hook (and ships no default CSS), so styling them here is the intended consumer pattern —
        and it keeps headings/blockquote/code at the chat body size instead of article scale.
      */}
      <style>{CHAT_STYLES}</style>

      <div>
        <Title order={3}>Agent chat</Title>
        <Text size="sm" c="dimmed" mt={4}>
          A streaming chat on basalt-ui/agent — persisted multi-turn thread, coalesced markdown,
          inline reasoning / tool calls / sources, and a mid-stream error path. The thread survives
          navigate-away and reload.
        </Text>
      </div>

      {/* ── Chat surface ──────────────────────────────────────────────────────── */}
      <Paper
        radius="md"
        withBorder
        style={{ display: 'flex', flexDirection: 'column', height: 560 }}
      >
        <Box style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {isEmpty ? (
            <EmptyState onPick={sendText} />
          ) : (
            <BasaltStickToBottom style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
              <Stack gap="lg">
                {messages.map((m) => (
                  <MessageBubble key={m.id} author={m.role} parts={m.parts} />
                ))}
                {showLive && (
                  <MessageBubble author="assistant" parts={parts} streaming={streaming} />
                )}
              </Stack>
            </BasaltStickToBottom>
          )}
        </Box>

        <Divider />

        {/* ── Composer ────────────────────────────────────────────────────────── */}
        <Group gap="xs" p="sm" align="flex-end" wrap="nowrap">
          <Textarea
            flex={1}
            autosize
            minRows={1}
            maxRows={5}
            radius="md"
            placeholder="Send a message…  (Enter to send, Shift+Enter for newline)"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
          />
          {streaming ? (
            <Tooltip label="Stop generating" withArrow>
              <ActionIcon size={42} radius="md" variant="light" color="red" onClick={stop}>
                <IconStop />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip label="Send" withArrow>
              <ActionIcon
                size={42}
                radius="md"
                variant="filled"
                onClick={handleComposerSend}
                disabled={!input.trim()}
                aria-label="Send message"
              >
                <IconSend />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Paper>

      {/* ── Simulation & dev panel ────────────────────────────────────────────── */}
      <Paper p="sm" radius="md" withBorder>
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">
              Simulation &amp; dev
            </Text>
            <StatusBadge status={status} />
            <Text size="xs" c="dimmed">
              {parts.length} live part{parts.length === 1 ? '' : 's'} · {messages.length} turn
              {messages.length === 1 ? '' : 's'}
            </Text>
          </Group>
          <Button size="compact-xs" variant="subtle" color="gray" onClick={toggleDev}>
            {devOpen ? 'Hide' : 'Show'}
          </Button>
        </Group>

        <Collapse expanded={devOpen}>
          <Stack gap="sm" mt="sm">
            <Group gap="md" align="flex-end" wrap="wrap">
              <Select
                label="Scenario"
                size="xs"
                w={220}
                data={AGENT_SCENARIOS.map((s) => ({ value: s.value, label: s.label }))}
                value={scenarioValue}
                onChange={(v) => v && setScenarioValue(v)}
                allowDeselect={false}
                disabled={streaming}
              />
              <Box>
                <Text size="xs" fw={500} mb={4}>
                  Stream speed
                </Text>
                <SegmentedControl
                  size="xs"
                  value={speed}
                  onChange={(v) => setSpeed(v as StreamSpeed)}
                  data={[
                    { value: 'normal', label: 'Normal' },
                    { value: 'instant', label: 'Instant' },
                  ]}
                  disabled={streaming}
                />
              </Box>
              <Group gap="xs">
                <Button
                  size="compact-sm"
                  variant="default"
                  onClick={handleRegenerate}
                  disabled={streaming || messages.length === 0}
                >
                  Regenerate
                </Button>
                <Button
                  size="compact-sm"
                  variant="subtle"
                  color="red"
                  leftSection={<IconTrash />}
                  onClick={clear}
                  disabled={streaming || messages.length === 0}
                >
                  Clear conversation
                </Button>
              </Group>
            </Group>

            <Text size="xs" c="dimmed">
              {scenario.hint} Swap <code>scenarioTransport(...)</code> for{' '}
              <code>edenTransport(...)</code> and this is a production chat — nothing else changes.
            </Text>

            <Box>
              <Text size="10px" tt="uppercase" fw={700} c="dimmed" mb={4}>
                Live parts (raw)
              </Text>
              <Code block fz="11px" mah={160} style={{ overflow: 'auto' }}>
                {parts.length === 0
                  ? '(empty — the last turn settled into the thread above)'
                  : parts
                      .map((p, i) => `[${i}] ${p.type}: ${JSON.stringify(p).slice(0, 88)}`)
                      .join('\n')}
              </Code>
            </Box>
          </Stack>
        </Collapse>
      </Paper>
    </Stack>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'The stream failed unexpectedly.'
}

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
