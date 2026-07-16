/**
 * agent-blocks — shared visual renderers for an assistant turn's `AgentPart[]`, used by both chat
 * demos so the block UI (text/reasoning/tool/sources/error + the message-bubble shell) is defined
 * exactly once.
 *
 * `/agent` (AgentDemoPage) is the RECOMMENDED path: it renders parts via basalt-ui/agent's shipped
 * `PartList`, wiring `TextBlock` / `ReasoningBlock` / `ToolBlock` / `ErrorBlock` in as PartList's
 * `components` slot overrides — their prop shape (`{ part, index }`) matches PartList's per-type
 * renderer signature verbatim, so they drop in with zero adapter code. `/agent-ai-sdk`
 * (AgentAiSdkDemoPage) is the explicit "raw parts, build-your-own" example: it composes the same
 * block components by hand over its own coalesced `Block[]` (via `AssistantBlocks`/`coalesce`
 * below) to prove the bespoke path still works — but PartList (see `/agent`) is the default a
 * consumer should reach for.
 */
import {
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
  ThemeIcon,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import type {
  AgentPart,
  ErrorPart,
  ReasoningPart,
  SourcePart,
  TextPart,
  ToolCallPart,
} from 'basalt-ui/agent'
import { Markdown } from 'basalt-ui/content'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { IconSparkle, IconUser } from './icons'

// ── Block renderers (module scope) ────────────────────────────────────────────
// Signatures match basalt-ui/agent's PartList per-type renderer shape (`{ part, index }`), so
// AgentDemoPage can pass these straight through as `PartList`'s `components` overrides.

export function TextBlock({ part }: { part: TextPart; index: number }) {
  // basalt-ui/content's Markdown (density="chat") owns the chat typography via Prose — headings,
  // blockquotes, and code all land at the compact chat body size. We deliberately do NOT wrap in
  // Mantine's <Typography>: it sizes blockquotes and headings far too large inside a chat bubble.
  return (
    <Markdown streaming density="chat">
      {part.text}
    </Markdown>
  )
}

export function ReasoningBlock({ part }: { part: ReasoningPart; index: number }) {
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
          {part.text}
        </Text>
      </Collapse>
    </Box>
  )
}

export function ToolBlock({ part }: { part: ToolCallPart; index: number }) {
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

/** Renders a run of cited sources as one row — takes the array directly (PartList's `source` slot
 * fires once per part, so `/agent` wraps this behind a small closure that groups consecutive
 * `source` parts; `/agent-ai-sdk`'s own coalesce already groups them into one `Block`). */
export function SourcesBlock({ parts }: { parts: SourcePart[] }) {
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

export function ErrorBlock({ part }: { part: ErrorPart; index: number }) {
  return (
    <Paper p="xs" bg="var(--mantine-color-red-light)">
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

// ── Bespoke Block coalescing (the /agent-ai-sdk "build-your-own" path) ────────
// A streamed turn is a flat list of parts where text arrives as many small deltas. This merges
// consecutive text/reasoning runs into one text block, and — since this transport's diffing may
// re-emit a tool call's output against an existing input by `toolCallId` — updates a matching tool
// block in place instead of pushing a near-duplicate.

type Block =
  | { kind: 'text'; key: string; part: TextPart }
  | { kind: 'tool'; key: string; part: ToolCallPart }
  | { kind: 'sources'; key: string; parts: SourcePart[] }
  | { kind: 'error'; key: string; part: ErrorPart }

export function coalesce(parts: AgentPart[]): Block[] {
  const blocks: Block[] = []
  const toolBlockIndexByCallId = new Map<string, number>()

  parts.forEach((part, i) => {
    const last = blocks.at(-1)
    if (part.type === 'text' || part.type === 'reasoning') {
      if (last?.kind === 'text') {
        blocks[blocks.length - 1] = {
          ...last,
          part: { type: 'text', text: last.part.text + part.text },
        }
      } else {
        blocks.push({ kind: 'text', key: `b${i}`, part: { type: 'text', text: part.text } })
      }
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
      if (last?.kind === 'sources') {
        blocks[blocks.length - 1] = { ...last, parts: [...last.parts, part] }
      } else {
        blocks.push({ kind: 'sources', key: `b${i}`, parts: [part] })
      }
      return
    }
    if (part.type === 'start') return // no-op resumption signal, never rendered
    blocks.push({ kind: 'error', key: `b${i}`, part })
  })

  return blocks
}

/** Renders a coalesced assistant turn by hand — the bespoke counterpart to `<PartList />`. Owns
 * the "nothing to show yet" fallback too (a turn with only a no-op `start` part, or no parts at
 * all, coalesces to zero blocks) so call sites don't each repeat the same length-check ternary. */
export function AssistantBlocks({ parts }: { parts: AgentPart[] }) {
  const blocks = useMemo(() => coalesce(parts), [parts])
  if (blocks.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        …
      </Text>
    )
  }
  return (
    <Stack gap="xs">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'text':
            return <TextBlock key={block.key} part={block.part} index={i} />
          case 'tool':
            return <ToolBlock key={block.key} part={block.part} index={i} />
          case 'sources':
            return <SourcesBlock key={block.key} parts={block.parts} />
          case 'error':
            return <ErrorBlock key={block.key} part={block.part} index={i} />
        }
      })}
    </Stack>
  )
}

// ── Message bubble (shared layout shell) ──────────────────────────────────────
// Owns only the avatar + bubble/flow layout; assistant content is a children slot so each page can
// render it its own way (PartList in /agent, AssistantBlocks in /agent-ai-sdk).

export function MessageBubble({
  author,
  parts,
  children,
}: {
  author: 'user' | 'assistant'
  parts: AgentPart[]
  children?: ReactNode
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
        <Paper px="sm" py="xs" bg="var(--mantine-color-default-hover)" style={{ maxWidth: '78%' }}>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {userText}
          </Text>
        </Paper>
      ) : (
        // Assistant: no bubble — reads as flowing text beside the avatar.
        <Box pt={2} style={{ maxWidth: '86%', overflowWrap: 'anywhere' }}>
          {children}
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
