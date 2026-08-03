/**
 * AgentRenderBudgetDemoPage — the 1.11.0 playground gate's render-count HUD: a 50-message thread
 * with one live turn streaming on top, watching how many message blocks the DOM actually touches
 * per delta. The asserted budget (`thread-message.test.tsx`) is exactly ONE `MessageBlock`
 * re-render per streamed delta — the live one; every settled block above it must bail out of
 * `memo()` untouched.
 *
 * FRAMEWORK GAP (read before trusting this page as gospel): `thread-message.tsx` exports
 * `messageBlockRenderCounter` — the literal counter basalt's own test suite asserts this exact
 * budget with — but it is deliberately NOT re-exported from `agent-chat/index.ts`, and there is no
 * package.json `exports` subpath that reaches `thread-message.tsx` directly. Confirmed empirically:
 * `import { messageBlockRenderCounter } from 'basalt-ui/agent-chat/thread-message'` fails `tsc`
 * with `TS2307: Cannot find module`. So this HUD does NOT read the framework's own instrumentation
 * — no public surface reaches it, and this file deliberately does not work around that with a
 * relative import into `packages/basalt-ui/src` (that would bypass the same package boundary
 * `messageBlockRenderCounter` not being exported is enforcing, and isn't something a real consumer
 * could do against the published package either).
 *
 * Instead, this page measures the SAME invariant from the outside, using only `ThreadTranscript`'s
 * rendered DOM output: a `MutationObserver` on the transcript container, bucketing every mutation by
 * which top-level message block it falls under (a direct child of `ThreadTranscript`'s own root
 * `Stack`, or the `aria-live` wrapper around the live turn). A block that truly bailed out of
 * `memo()` produces zero DOM mutations, so "distinct blocks touched in one MutationObserver flush"
 * is a valid (if DOM-structure-coupled) proxy for "blocks that actually re-rendered." See the final
 * implementation report for the measured number and the recommendation this gap implies.
 *
 * @example
 * <Route path="/agent-render-budget" component={AgentRenderBudgetDemoPage} />
 */
import { Box, Button, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { useAgentStream } from 'basalt-ui/agent'
import type { AgentPart, AgentTransport, ChatMessage } from 'basalt-ui/agent'
import { ThreadTranscript } from 'basalt-ui/agent-chat'
import { VX } from 'basalt-ui/tokens'
import type { RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { IconSparkle } from './icons'

const MICRO_LABEL_STYLE = {
  fontFamily: 'var(--basalt-font-mono)',
  fontSize: VX.text.micro,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: VX.faint,
} as const

const MESSAGE_COUNT = 50

// ── 50 canned, settled messages (module-scope constant — STABLE references across renders, which
// is what makes MessageBlock's `message === next.message` memo comparison meaningful at all) ─────

const CANNED_LINES = [
  'Checked the deploy queue — nothing pending.',
  'The nightly job finished in 4m12s, no retries.',
  "Here's the summary you asked for.",
  'Flagged two dependencies for the next upgrade pass.',
  'No open alerts on the dashboard right now.',
  'Logged that decision to the runbook.',
]

function buildCannedMessages(count: number): ChatMessage[] {
  const messages: ChatMessage[] = []
  for (let index = 0; index < count; index += 1) {
    const role: ChatMessage['role'] = index % 2 === 0 ? 'user' : 'assistant'
    const line = CANNED_LINES[index % CANNED_LINES.length] ?? CANNED_LINES[0] ?? ''
    messages.push({
      id: `render-budget-msg-${index}`,
      role,
      parts: [{ id: `render-budget-part-${index}`, type: 'text', text: `#${index + 1} — ${line}` }],
      createdAt: Date.now() - (count - index) * 60_000,
    })
  }
  return messages
}

const CANNED_MESSAGES: ChatMessage[] = buildCannedMessages(MESSAGE_COUNT)

// ── Live 51st turn: a scripted, word-by-word text stream ─────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const LIVE_ANSWER =
  'Streaming this reply one word at a time — every delta below should touch exactly one message ' +
  'block, this one, while the forty-nine settled messages above stay untouched.'
const LIVE_WORDS = LIVE_ANSWER.split(' ')

async function* renderBudgetStream(): AsyncGenerator<AgentPart> {
  const id = crypto.randomUUID()
  for (const [index, word] of LIVE_WORDS.entries()) {
    await sleep(80)
    yield { id, type: 'text', text: index === 0 ? word : ` ${word}` }
  }
}

const renderBudgetTransport: AgentTransport<AgentPart, string> = {
  stream: () => renderBudgetStream(),
}

// ── Block-touch tracker (the external, DOM-based proxy — see the docblock's framework-gap note) ──

function isLiveWrapper(el: Element): boolean {
  return el.getAttribute('aria-live') === 'polite'
}

/** Walks up from a mutation's node to the nearest block boundary: a direct child of `stackEl`
 * (a settled message), or the `aria-live` wrapper `ThreadTranscript` renders around the live turn. */
function findBlockBoundary(stackEl: Element, node: Node): Element | null {
  let el: Element | null =
    node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  while (el !== null && el.parentElement !== stackEl && !isLiveWrapper(el)) {
    el = el.parentElement
  }
  return el !== stackEl ? el : null
}

type BlockTouchStats = {
  readonly lastDelta: number
  readonly maxDelta: number
  readonly deltaCount: number
}

function useBlockTouchTracker(containerRef: RefObject<HTMLDivElement | null>): BlockTouchStats & {
  reset: () => void
} {
  const [stats, setStats] = useState<BlockTouchStats>({ lastDelta: 0, maxDelta: 0, deltaCount: 0 })

  useEffect(() => {
    const container = containerRef.current
    const stackEl = container?.firstElementChild ?? null
    if (container === null || stackEl === null) return

    const observer = new MutationObserver((mutations) => {
      const touched = new Set<Element>()
      for (const mutation of mutations) {
        const block = findBlockBoundary(stackEl, mutation.target)
        if (block !== null) touched.add(block)
      }
      if (touched.size === 0) return
      setStats((prev) => ({
        lastDelta: touched.size,
        maxDelta: Math.max(prev.maxDelta, touched.size),
        deltaCount: prev.deltaCount + 1,
      }))
    })
    observer.observe(container, { childList: true, characterData: true, subtree: true })
    return () => observer.disconnect()
  }, [containerRef])

  const reset = useCallback(() => setStats({ lastDelta: 0, maxDelta: 0, deltaCount: 0 }), [])
  return { ...stats, reset }
}

// ── HUD ────────────────────────────────────────────────────────────────────────

function HudStat({ label, value, good }: { label: string; value: number; good: boolean }) {
  return (
    <Stack gap={2}>
      <Text style={MICRO_LABEL_STYLE}>{label}</Text>
      <Text
        style={{
          fontFamily: 'var(--basalt-font-mono)',
          fontSize: VX.text.kpi,
          fontWeight: 600,
          color: good ? VX.status.good : VX.status.bad,
        }}
      >
        {value}
      </Text>
    </Stack>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AgentRenderBudgetDemoPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { parts, status, send } = useAgentStream<AgentPart>({ transport: renderBudgetTransport })
  const { lastDelta, maxDelta, deltaCount, reset } = useBlockTouchTracker(containerRef)

  const handleRun = useCallback(() => {
    reset()
    void send('start')
  }, [reset, send])

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>Agent chat — render budget</Title>
        <Text size="sm" c="dimmed" mt={4}>
          {MESSAGE_COUNT} settled messages plus one live streaming turn. The HUD counts, per
          streamed delta, how many distinct message blocks receive a DOM mutation — the budget is
          exactly 1 (the live block) throughout the run.
        </Text>
      </div>

      <Group gap="xs">
        <Button
          radius="md"
          leftSection={<IconSparkle />}
          onClick={handleRun}
          disabled={status === 'streaming'}
        >
          Stream the {MESSAGE_COUNT + 1}th message
        </Button>
      </Group>

      <Paper p="sm">
        <Group gap="xl">
          <HudStat label="Blocks touched — last delta" value={lastDelta} good={lastDelta <= 1} />
          <HudStat label="Blocks touched — max this run" value={maxDelta} good={maxDelta <= 1} />
          <HudStat label="Deltas observed" value={deltaCount} good />
        </Group>
      </Paper>

      <Paper py="xs" px="sm">
        <Box ref={containerRef}>
          <ThreadTranscript messages={CANNED_MESSAGES} liveParts={parts} liveStatus={status} />
        </Box>
      </Paper>
    </Stack>
  )
}
