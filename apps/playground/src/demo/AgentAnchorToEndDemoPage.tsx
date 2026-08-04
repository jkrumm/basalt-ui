/**
 * AgentAnchorToEndDemoPage — basalt-ui 1.13.0 playground gate demo: the ONE combination no other
 * demo in this repo puts together — a virtualized `ThreadTranscript` with a genuinely STREAMING
 * turn appending to its tail, long enough that the tail sits well below the fold.
 *
 * `anchorTo: 'end'` + `followOnAppend` (`thread-message.tsx`'s `VirtualizedRowsInner`) exist
 * precisely to keep a virtualized transcript pinned to the bottom while new content streams in, and
 * until this page nothing exercised both halves at once: `AgentTranscriptVirtualizeDemoPage` is 500
 * STATIC messages (nothing ever streams into it), `AgentInlineFeedVirtualizedRowDemoPage` is a
 * virtualized row that never receives `liveParts`. Neither can show whether the pinned-to-bottom
 * behavior actually holds up against a live append.
 *
 * The scroll threshold that governs this (`scrollEndThreshold`, hardcoded to 64px inside
 * `thread-message.tsx` — NOT a public prop; `VirtualizeOptions` exposes `overscan`/`estimateSize`/
 * `initialScroll`, not the threshold itself) is not asserted here, only made LEGIBLE. This page reads
 * the real DOM the same way a consumer's own instrumentation would have to — there is no exposed
 * ref/prop onto the internal virtualizer's scroll node — via a capture-phase `scroll` listener on a
 * wrapper div whose only child is `ThreadTranscript`'s own root (the virtualized branch renders
 * exactly one scrollable element as its root, both for the real virtualizer and its `Suspense`
 * fallback, so `wrapper.firstElementChild` is unambiguous across that swap). The distance readout
 * below the transcript updates live from whichever scroll actually happened, whether the user drove
 * it or the virtualizer's own auto-follow did.
 *
 * 1.13.0: `VirtualizeOptions.initialScroll` now defaults to `'end'` — this page doesn't override it,
 * so it now opens ALREADY pinned to the seeded tail (badge reads "pinned", distance ~0px) instead of
 * mounting at message #0, 8,913px away. That flips which half of the demo is interesting: scrolling
 * DOWN to the tail is no longer the setup step, scrolling UP away from it is.
 *
 * Drive it: scroll up first (the badge flips to "held", the distance count climbs and stops moving —
 * you're now off the tail). Click "Start streaming turn": the stream writes new content below the
 * fold and your held position does NOT move, proving `followOnAppend` really did stop re-anchoring
 * once you left the threshold, not just once you left the bottom of a static list. Scroll back down
 * past ~64px from the bottom and following resumes on its own — badge flips to "pinned", the distance
 * count tracks each new chunk back down near zero as it streams in.
 *
 * Note (expected, not a bug): the distance readout is driven entirely by real `scroll` events — see
 * the effect below — so while you're held away from the bottom it FREEZES rather than climbing as
 * the stream keeps appending content further below the fold; nothing you can see moved, so nothing
 * fires a `scroll` event to react to. It catches up the instant you scroll again. This is the
 * tradeoff of reading the real DOM the way a consumer's own instrumentation would have to, and it is
 * deliberately NOT "fixed" with a timer or a live resize watch — that would defeat the point of
 * observing exactly what a real `scroll` listener sees, no more.
 */
import { Badge, Box, Button, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { EmptyState } from 'basalt-ui'
import { createThreadsStore, heuristicOutcome, useAgentThreadRuns } from 'basalt-ui/agent'
import type { AgentPart, AgentThread, AgentTransport } from 'basalt-ui/agent'
import { ThreadTranscript } from 'basalt-ui/agent-chat'
import { useCallback, useEffect, useRef, useState } from 'react'
import { buildLongThread } from './agent-long-thread'
import { IconReset, IconSparkle } from './icons'

// ── Scripted, slow, word-by-word stream — long enough to scroll around mid-flight ──────────────
// Same "no signal handling" idiom as AgentStopMidStreamDemoPage's script: this demo never stops the
// turn early, so there is nothing for an abort to interrupt.

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const ANCHOR_STEP_DELAY = 220

const ANCHOR_DEMO_ANSWER =
  'Walking through the anchor-to-end mechanics end to end: the virtualizer measures the scroll ' +
  'container on every append, and when the pane was already within scrollEndThreshold of the bottom ' +
  'before that append, it re-anchors to the new bottom on the very same frame. Scroll away from the ' +
  'bottom and that re-anchor stops firing entirely — your position holds even while dozens more rows ' +
  'keep arriving underneath it. Scroll back down past the threshold and following resumes ' +
  'immediately, with no extra click required on your part. This is exactly the rhythm a real chat ' +
  'client needs: stay pinned while someone is reading the latest turn as it writes itself, but never ' +
  'yank the viewport out from under someone who scrolled up to re-read an earlier message while the ' +
  'answer keeps streaming in below.'
const ANCHOR_DEMO_WORDS = ANCHOR_DEMO_ANSWER.split(' ')

async function* anchorDemoScript(): AsyncGenerator<AgentPart> {
  const id = crypto.randomUUID()
  for (const [index, word] of ANCHOR_DEMO_WORDS.entries()) {
    await sleep(ANCHOR_STEP_DELAY)
    yield { id, type: 'text', text: index === 0 ? word : ` ${word}` }
  }
}

const anchorDemoTransport: AgentTransport<AgentPart, string> = {
  stream: () => anchorDemoScript(),
}

// ── Store + seed ─────────────────────────────────────────────────────────────────

const useAnchorThreads = createThreadsStore({ key: 'playground-agent-anchor-to-end', version: 1 })

const SEED_MESSAGE_COUNT = 60
const TRANSCRIPT_HEIGHT = 420
// Mirrors thread-message.tsx's internal DEFAULT_VIRTUALIZE_SCROLL_END_THRESHOLD — not importable
// (not part of VirtualizeOptions, so not part of the public surface at all); reproduced here purely
// as a legend for this page's own readout, not asserted against anything.
const SCROLL_END_THRESHOLD = 64

// ── Page ──────────────────────────────────────────────────────────────────────

export function AgentAnchorToEndDemoPage() {
  const store = useAnchorThreads()
  const { runs, start } = useAgentThreadRuns({
    transport: anchorDemoTransport,
    store,
    resolveOutcome: heuristicOutcome,
  })

  // Seeds ONE already-settled, deliberately long thread straight into the store — same
  // no-start()-in-a-mount-effect discipline as AgentThreadFeedInlineDemoPage's fix 2 (see its own
  // doc): buildLongThread's messages are synchronous, so nothing here ever registers a controller
  // for a StrictMode double-invoke to abort.
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current || store.threads.length > 0) return
    seededRef.current = true
    const id = store.create()
    const messages = buildLongThread(SEED_MESSAGE_COUNT)
    for (const message of messages) store.appendMessage(id, message)
    store.setStatus(id, 'done')
    const firstMessage = messages[0]
    const lastMessage = messages[messages.length - 1]
    const snapshot: AgentThread = {
      id,
      messages,
      outcome: null,
      status: 'done',
      read: true,
      createdAt: firstMessage?.createdAt ?? Date.now(),
      updatedAt: lastMessage?.createdAt ?? Date.now(),
    }
    store.setOutcome(id, heuristicOutcome(snapshot))
  }, [store])

  const thread = store.threads[0]
  const run = thread !== undefined ? runs.get(thread.id) : undefined
  const streaming = run !== undefined

  const wrapperRef = useRef<HTMLDivElement>(null)
  const [distanceFromBottom, setDistanceFromBottom] = useState<number | null>(null)

  // Capture-phase, not bubble: `scroll` events don't bubble in most browsers, but capture always
  // sees them regardless of which descendant actually scrolled. Filtering to `wrapper.firstElementChild`
  // (re-read fresh on every event, never cached) is what keeps this from ever matching a nested
  // scroller instead — a fenced code block in one of the seeded messages sets its own overflow, and
  // that element is a grandchild, never the wrapper's direct child.
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (wrapper === null) return
    const measure = (target: HTMLElement) => {
      const distance = target.scrollHeight - target.scrollTop - target.clientHeight
      setDistanceFromBottom(Math.max(0, Math.round(distance)))
    }
    const handleScroll = (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLElement) || target !== wrapper.firstElementChild) return
      measure(target)
    }
    wrapper.addEventListener('scroll', handleScroll, { capture: true, passive: true })

    // The one-shot rAF this replaced measured too early: `ThreadTranscript`'s virtualized branch
    // sits behind a lazy `import('@tanstack/react-virtual')` (thread-message.tsx), so the very first
    // commit is the `Suspense` fallback — an EMPTY scroll node whose scrollHeight equals its own
    // clientHeight. A single rAF after mount still often landed inside that fallback window, reading
    // `scrollHeight - scrollTop - clientHeight` as exactly 0 no matter how far the real seeded
    // content sits below the fold — precisely the false "pinned" reading this page exists to avoid
    // showing a human. Instead of guessing a frame count, a `MutationObserver` on the wrapper catches
    // the EXACT moment the real virtualizer replaces the fallback — its sizer element (the
    // `height: getTotalSize()` box) appearing as the scroll node's one child — and takes ONE read
    // right then, same "one extra initial read" intent as the rAF it replaces, just correctly timed.
    // Deliberately NOT kept alive past that: the readout goes back to being purely `scroll`-event-
    // driven afterward (see the module doc's "Note" on this) — a stream that grows the pane's total
    // height while the user is scrolled away from the bottom does NOT move this number until the next
    // real scroll. That is a real, expected limitation of reading the DOM the way a consumer's own
    // instrumentation would have to, not something to paper over with a live ResizeObserver here.
    const observer = new MutationObserver(() => {
      const scrollNode = wrapper.firstElementChild
      const sizer = scrollNode?.firstElementChild
      if (!(scrollNode instanceof HTMLElement) || !(sizer instanceof HTMLElement)) return
      measure(scrollNode)
      observer.disconnect()
    })
    observer.observe(wrapper, { childList: true, subtree: true })
    // Covers the case where `@tanstack/react-virtual`'s lazy import already resolved during an
    // earlier mount THIS session (`LazyVirtualizedRows` caches its resolution permanently for the
    // module's lifetime) — the sizer can already be present synchronously, with no mutation left to
    // observe.
    const scrollNode = wrapper.firstElementChild
    const sizer = scrollNode?.firstElementChild
    if (scrollNode instanceof HTMLElement && sizer instanceof HTMLElement) {
      measure(scrollNode)
      observer.disconnect()
    }

    return () => {
      wrapper.removeEventListener('scroll', handleScroll, { capture: true })
      observer.disconnect()
    }
  }, [thread])

  const handleStart = useCallback(() => {
    if (thread === undefined) return
    start(thread.id, 'Give me a long, detailed answer so I can scroll around while it streams in.')
  }, [thread, start])

  const handleReset = useCallback(() => {
    store.clear()
    seededRef.current = false
    setDistanceFromBottom(null)
  }, [store])

  const pinned = distanceFromBottom !== null && distanceFromBottom <= SCROLL_END_THRESHOLD

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>Agent chat — anchor to end while streaming (virtualized)</Title>
        <Text size="sm" c="dimmed" mt={4}>
          {SEED_MESSAGE_COUNT} settled messages, virtualized at {TRANSCRIPT_HEIGHT}px — opens
          already pinned to the seeded tail (that&apos;s the new default: a virtualized transcript
          mounts scrolled to the newest message). Scroll up first to hold your position, then click
          "Start streaming turn" and watch the badge stay flipped to held while new content lands
          below the fold. Scroll back down past the threshold and following resumes on its own.
        </Text>
      </div>

      <Group gap="xs" align="center">
        <Button
          radius="md"
          leftSection={<IconSparkle />}
          onClick={handleStart}
          disabled={thread === undefined || streaming}
        >
          Start streaming turn
        </Button>
        <Button radius="md" variant="default" leftSection={<IconReset />} onClick={handleReset}>
          Reset demo
        </Button>
        <Badge color={pinned ? 'teal' : 'gray'} variant="light" ff="monospace">
          {pinned ? 'pinned — following new content' : 'not pinned — position held'}
        </Badge>
        <Badge color="gray" variant="outline" ff="monospace">
          {distanceFromBottom === null ? 'not yet measured' : `${distanceFromBottom}px from bottom`}
        </Badge>
      </Group>

      <Paper p="sm">
        <Box ref={wrapperRef}>
          {thread === undefined ? (
            <Stack align="center" justify="center" mih={TRANSCRIPT_HEIGHT}>
              <EmptyState
                icon={<IconSparkle />}
                title="Seeding…"
                description="Building the seeded transcript."
                variant="section"
              />
            </Stack>
          ) : (
            <ThreadTranscript
              messages={thread.messages}
              {...(run !== undefined
                ? { liveParts: run.parts, liveStatus: 'streaming' as const }
                : {})}
              virtualize
              height={TRANSCRIPT_HEIGHT}
            />
          )}
        </Box>
      </Paper>
    </Stack>
  )
}
