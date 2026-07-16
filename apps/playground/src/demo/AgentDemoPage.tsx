/**
 * AgentDemoPage — a real, multi-turn chat built on basalt-ui/agent.
 *
 * This is the mature counterpart to the old "battery": a usable conversation, not a primitive
 * exerciser. The persisted thread (createChatHistoryStore) is the source of truth for settled
 * turns; the live streaming turn (useAgentStream) renders at the tail and is committed to the
 * thread when it resolves (done OR error).
 *
 * Doctrine: `PartList` (basalt-ui/agent) is the RECOMMENDED renderer for an assistant turn's
 * `AgentPart[]` — see `/agent-ai-sdk` for the fully bespoke, hand-rolled composition. `AssistantParts`
 * below coalesces consecutive text/reasoning deltas into single parts first (so token-by-token
 * streams still render as one markdown document), then hands the result to `PartList` with
 * `basalt-ui/content`'s `Markdown` wired in as the text slot — the JSDoc'd recommended usage.
 *
 * The simulation/dev affordances are preserved (the user wants to keep testing the package): a
 * scenario picker, a stream-speed toggle, a raw-parts inspector, regenerate, and clear all live in
 * a secondary "Simulation & dev" panel below the chat. Swap `scenarioTransport(...)` for
 * `edenTransport(...)` and this page is a production chat.
 */
import {
  ActionIcon,
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
  Title,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { EmptyState } from 'basalt-ui'
import {
  BasaltStickToBottom,
  createChatHistoryStore,
  PartList,
  useAgentStream,
} from 'basalt-ui/agent'
import type { AgentPart, AgentPartRenderers, SourcePart, SourcePartRenderer } from 'basalt-ui/agent'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AGENT_SCENARIOS, scenarioTransport } from './agent-scenarios'
import type { StreamSpeed } from './agent-scenarios'
import {
  ErrorBlock,
  MessageBubble,
  ReasoningBlock,
  SourcesBlock,
  TextBlock,
  ToolBlock,
} from './agent-blocks'
import { IconSend, IconSparkle, IconStop, IconTrash } from './icons'

// ── Persisted conversation thread ─────────────────────────────────────────────
// One stable store at module scope. Survives navigate-away/back and reloads (cross-tab too).
const useConversation = createChatHistoryStore({ key: 'agent-demo-chat', version: 1 })

// ── PartList feed: coalesce consecutive text/reasoning runs ────────────────────
// `useAgentStream` accumulates one AgentPart per delta — PartList renders each part it's given, so
// without this merge a token-by-token stream would render as many tiny Markdown blocks instead of
// one document. Tool/source/error parts pass through unchanged.
function coalesceRuns(parts: AgentPart[]): AgentPart[] {
  const merged: AgentPart[] = []
  for (const part of parts) {
    const last = merged.at(-1)
    if (part.type === 'text' && last?.type === 'text') {
      merged[merged.length - 1] = { type: 'text', text: last.text + part.text }
      continue
    }
    if (part.type === 'reasoning' && last?.type === 'reasoning') {
      merged[merged.length - 1] = { type: 'reasoning', text: last.text + part.text }
      continue
    }
    merged.push(part)
  }
  return merged
}

/** PartList's `source` slot fires once per part — groups consecutive `source` parts into one
 * `SourcesBlock` row, matching `/agent-ai-sdk`'s hand-coalesced grouping. Only the first source
 * in a run renders; the rest no-op (already rendered as part of that row).
 *
 * PartList uses `components.source` as a JSX element TYPE (`<Render part={..} index={..} />`).
 * A fresh function value on every render — as the previous `makeSourceRenderer(coalesced)` inside
 * a `useMemo` keyed on `coalesced` produced — is a NEW component type to React on essentially
 * every streamed delta (coalesced changes on nearly every token), so PartList's rendered source
 * blocks would unmount/remount every stream tick. The fix: build the renderer function ONCE per
 * `AssistantParts` instance (via `useRef`, so its identity never changes across re-renders) and
 * let it read the live parts through a ref that's kept current on every render, instead of
 * closing over `parts` directly. */
function useSourceRenderer(parts: AgentPart[]): SourcePartRenderer {
  const partsRef = useRef(parts)
  partsRef.current = parts

  const rendererRef = useRef<SourcePartRenderer | null>(null)
  if (rendererRef.current === null) {
    rendererRef.current = function SourceGroup({ part, index }) {
      const live = partsRef.current
      if (live[index - 1]?.type === 'source') return null
      const group: SourcePart[] = [part]
      for (let i = index + 1; i < live.length && live[i]?.type === 'source'; i++) {
        group.push(live[i] as SourcePart)
      }
      return <SourcesBlock parts={group} />
    }
  }
  return rendererRef.current
}

/** Renders an assistant turn via the shipped `PartList` — the recommended path (see module doc). */
function AssistantParts({ parts }: { parts: AgentPart[] }) {
  const coalesced = useMemo(() => coalesceRuns(parts), [parts])
  const sourceRenderer = useSourceRenderer(coalesced)
  const components = useMemo<Partial<AgentPartRenderers>>(
    () => ({
      text: TextBlock,
      reasoning: ReasoningBlock,
      tool: ToolBlock,
      source: sourceRenderer,
      error: ErrorBlock,
    }),
    [sourceRenderer],
  )
  return (
    <Stack gap="xs">
      <PartList parts={coalesced} components={components} />
    </Stack>
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

function ChatEmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <Stack align="center" justify="center" h="100%">
      <EmptyState
        icon={<IconSparkle />}
        title="Start a conversation"
        description="A streaming chat over basalt-ui/agent. Pick a simulation below, or try a prompt:"
        variant="section"
        action={
          <Group gap="xs" justify="center" maw={460}>
            {SUGGESTIONS.map((s) => (
              <Button
                key={s}
                size="compact-sm"
                variant="default"
                radius="xl"
                onClick={() => onPick(s)}
              >
                {s}
              </Button>
            ))}
          </Group>
        }
      />
    </Stack>
  )
}

// ── Page-scoped styles ──────────────────────────────────────────────────────────
// Typing-indicator keyframes only. The streamed assistant markdown is styled by basalt-ui/content's
// Prose (density="chat"), so this page owns no markdown CSS.
const TYPING_STYLES = `
@keyframes basalt-typing{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-2px)}}
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
      {/* Typing-indicator keyframes. Markdown typography comes from content's Prose, not from here. */}
      <style>{TYPING_STYLES}</style>

      <div>
        <Title order={3}>Agent chat</Title>
        <Text size="sm" c="dimmed" mt={4}>
          A streaming chat on basalt-ui/agent — persisted multi-turn thread, coalesced markdown,
          inline reasoning / tool calls / sources, and a mid-stream error path. The thread survives
          navigate-away and reload.
        </Text>
      </div>

      {/* ── Chat surface ──────────────────────────────────────────────────────── */}
      <Paper style={{ display: 'flex', flexDirection: 'column', height: 560 }}>
        <Box style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {isEmpty ? (
            <ChatEmptyState onPick={sendText} />
          ) : (
            // theme-allow — BasaltStickToBottom owns this scroll node for scroll anchoring.
            <BasaltStickToBottom style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
              <Stack gap="lg">
                {messages.map((m) => (
                  <MessageBubble key={m.id} author={m.role} parts={m.parts}>
                    {m.parts.length > 0 && <AssistantParts parts={m.parts} />}
                  </MessageBubble>
                ))}
                {showLive && (
                  <MessageBubble author="assistant" parts={parts}>
                    {parts.length > 0 && <AssistantParts parts={parts} />}
                    {streaming && (
                      <Group gap={5} align="center" mt="xs" aria-label="Assistant is typing">
                        <TypingDot delay={0} />
                        <TypingDot delay={160} />
                        <TypingDot delay={320} />
                      </Group>
                    )}
                  </MessageBubble>
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
      <Paper p="sm">
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
              {/* theme-allow — a raw debug Code block, not app chrome. */}
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
