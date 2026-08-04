/**
 * AgentThreadFeedInlineDemoPage — basalt-ui 1.13.0 playground gate demos 1 + 4: the inline-expanding
 * Slack row (`ThreadFeedRow`, driven through `ThreadFeed`'s `renderRow` escape hatch) next to the
 * unchanged inbox row (`ThreadOutcomeCard`, `ThreadFeed`'s default `'outcome'` variant) — same
 * `AgentThread[]`, rendered two ways side by side, so the two shapes are visibly different
 * components, not one component in two skins.
 *
 * DISCOVERED WHILE BUILDING THIS DEMO: `ThreadFeed`'s built-in `variant="inline"` row does NOT wire
 * `liveParts`/`liveStatus`/`onStop` (see `ThreadFeedProps.renderRow`'s own doc — it names this gap
 * explicitly). There is no way to watch a thread stream live through the built-in row alone. This
 * page therefore drives `ThreadFeedRow` directly via `renderRow`, the documented escape hatch for
 * exactly that gap — `variant="inline"` on its own would show only the FINISHED transcript.
 *
 * The left (inline) panel also makes `ThreadFeedRow`'s LOAD-BEARING mount invariant (see its module
 * doc: mount lazily on first expand, then never unmount, hide via `display: none` only) visible
 * rather than trusted. Each row's transcript carries a `reasoning`-renderer hijack — real AgentPart
 * key, not a foreign one — that mounts a `MountProbe` alongside the row's real "Thinking" UI. A
 * SEPARATE counter tracks how many times the per-thread transport's `stream()` was actually invoked.
 * Expand a row, note both counts, collapse it, re-expand it several times: neither counter may move
 * — a genuinely new turn (sending another message) is the only thing allowed to move either one.
 * If a future Mantine bump ever flips `ThreadFeedRow`'s collapse mechanics onto `<Activity>` (see its
 * module doc), this is where that regression shows up first: both counters would climb on every
 * re-expand instead of staying flat.
 *
 * Caveat: in dev (this playground runs `<StrictMode>`), the FIRST expand of a row can read "mounted
 * 2×" instead of "1×" — React's intentional double-invoke of a fresh effect on first mount, not a
 * bug in `ThreadFeedRow`. What matters is that the count stops moving after that first expand.
 *
 * TWO FIXES FROM THE 1.13.0 GATE, both demo-side only (see each site's own comment):
 *
 *  1. `onStop` is now wired to the left panel's `ThreadFeedRow`s. It was never forwarded before —
 *     `ThreadFeedRow` only shows its composer's Stop action when `onStop` is DEFINED (it has no way
 *     to infer "a run exists" from `liveStatus` alone), so a live row's textarea disabled with no
 *     visible way to cancel it.
 *
 *  2. The three seed threads are no longer started via `start()` inside a mount effect. Under
 *     `<StrictMode>`, that effect's cleanup — a SEPARATE effect inside `useAgentThreadRuns` itself,
 *     which aborts every in-flight controller so a fiber whose effects re-run without unmounting
 *     doesn't leak stream subscriptions — fires between this page's two mount passes and aborts all
 *     three freshly-started runs before either the reload-reconciler or the abort path can settle
 *     `runs` back to empty. `stop()` can't help here either: it is gated on `controllersRef` still
 *     holding the thread's controller, and that map was already cleared by the same cleanup. The
 *     result was three threads permanently reading "streaming" with an unremovable phantom entry —
 *     a REAL framework defect, SINCE FIXED IN 1.13.0, but NOT where this note originally pointed:
 *     the fix is in `use-agent-thread-runs.ts`'s unmount-cleanup effect, which now tears down the
 *     `runs` entries for exactly the threadIds it aborts. `consumeAndFinalize`'s
 *     `if (controller.signal.aborted) return` guard was deliberately left alone (it carries a
 *     comment saying so): from inside that loop, a `controllersRef` mismatch cannot be told apart
 *     from "a newer resumed run already owns this key", so a teardown there would clobber a live
 *     successor. Do not "finish the job" at that guard.
 *     This page no longer trips it either way: seeding now writes three ALREADY-SETTLED threads into
 *     the store (`store.appendMessage` + `store.setStatus('done')` + `store.setOutcome`, no
 *     `start()`, no controller, nothing for that cleanup to abort), so a fresh load lands directly on
 *     three expandable, non-streaming threads. `start()` is still exercised for real the first time a
 *     composer sends a message — that call happens from a click, long after both StrictMode mount
 *     passes have settled, so it never meets the race above.
 */
import { Badge, Box, Button, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { createThreadsStore, heuristicOutcome, useAgentThreadRuns } from 'basalt-ui/agent'
import type {
  AgentPart,
  AgentThread,
  AgentTransport,
  ChatMessage,
  ForeignPart,
  PartRenderer,
  PartRenderers,
  ReasoningPart,
} from 'basalt-ui/agent'
import { ThreadFeed, ThreadFeedRow, threadPartRenderers } from 'basalt-ui/agent-chat'
import type { ComposerSubmit } from 'basalt-ui/agent-chat'
import type { JSX } from 'react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { AGENT_SCENARIOS, scenarioTransport } from './agent-scenarios'
import { IconReset } from './icons'

// ── Seed scenarios (skip 'error' — this demo is about mount/stream counting, not failure) ────────

const SEED_SCENARIOS = AGENT_SCENARIOS.filter((scenario) => scenario.value !== 'error')

let scenarioCursor = 0
function nextSeedScenario() {
  const scenario = SEED_SCENARIOS[scenarioCursor % SEED_SCENARIOS.length]
  scenarioCursor += 1
  if (scenario === undefined) throw new Error('SEED_SCENARIOS is empty')
  return scenario
}

const SEED_PROMPTS = [
  'How should I structure the shell/router seam?',
  'Compare the trade-offs of virtualizing this transcript.',
  'What changed in the last release?',
]

// ── Per-thread counting transport — the "stream started" half of the invariant ───────────────────

/** Resolved once per thread id and cached by `useAgentThreadRuns` (see its own doc) — `stream()`
 * itself is called once per turn on that thread, which is exactly what `onStreamStart` counts. */
function makeCountingTransport(
  onStreamStart: (threadId: string) => void,
): (threadId: string) => AgentTransport<AgentPart, string> {
  return (threadId) => ({
    stream(input, signal) {
      onStreamStart(threadId)
      return scenarioTransport(nextSeedScenario(), 'normal').stream(input, signal)
    },
  })
}

// ── Per-thread counters — plain refs + a manual re-render, not React state ────────────────────────
// (state would need a fresh Map identity per bump; a ref + forced re-render is the cheaper, simpler
// escape hatch for a value this page only ever reads back for display, never diffs against.)

function usePerThreadCounter(): readonly [Map<string, number>, (id: string) => void] {
  const counts = useRef<Map<string, number>>(new Map())
  const [, bump] = useReducer((n: number) => n + 1, 0)
  const increment = useCallback((id: string) => {
    counts.current.set(id, (counts.current.get(id) ?? 0) + 1)
    bump()
  }, [])
  return [counts.current, increment] as const
}

// ── The mount probe — proves ThreadFeedRow's lazy-mount-then-kept-mounted guarantee from OUTSIDE
// the package, by riding the SAME `renderers` open-registry seam a consumer would use for a real
// foreign part. ─────────────────────────────────────────────────────────────────────────────────

const ReasoningView = threadPartRenderers.reasoning!

function MountProbe({
  threadId,
  onMount,
}: {
  threadId: string
  onMount: (id: string) => void
}): null {
  // Empty-ish deps (threadId/onMount are both stable for a given row) — fires once per genuine
  // mount of THIS component instance, and never again while it stays mounted, regardless of how
  // many times the row around it re-renders (streaming deltas, collapse/expand toggles, ...).
  useEffect(() => {
    onMount(threadId)
  }, [threadId, onMount])
  return null
}

function ProbedReasoning({
  threadId,
  onMount,
  part,
  settled,
}: {
  threadId: string
  onMount: (id: string) => void
  part: ReasoningPart
  settled: boolean
}): JSX.Element {
  return (
    <>
      <MountProbe threadId={threadId} onMount={onMount} />
      <ReasoningView part={part} index={0} settled={settled} />
    </>
  )
}

/** Hijacks the real `reasoning` AgentPart key via `ThreadFeedRow`'s open `renderers` registry —
 * chosen over registering a genuinely foreign part type because it needs no `BasaltRegister`
 * augmentation and keeps every store/outcome-resolver call in this file on the default `AgentPart`
 * generic. Re-uses the exported `threadPartRenderers.reasoning` so the row's real "Thinking"
 * disclosure still renders unchanged — this is additive instrumentation, not a replacement UI. */
function makeReasoningProbe(
  threadId: string,
  onMount: (id: string) => void,
): PartRenderer<ForeignPart> {
  return (ctx) => (
    <ProbedReasoning
      threadId={threadId}
      onMount={onMount}
      // Safe: registered ONLY under the 'reasoning' key below, so `ctx.part` is always basalt-ui's
      // own ReasoningPart shape at runtime — PartRenderers' un-augmented type has no way to express
      // that per-key narrowing (see foreign.ts's own PartRenderers doc).
      part={ctx.part as unknown as ReasoningPart}
      settled={ctx.settled}
    />
  )
}

// ── Store ──────────────────────────────────────────────────────────────────────────────────────

const useThreads = createThreadsStore({ key: 'playground-thread-feed-inline', version: 2 })

const PANEL_HEIGHT = 520

export function AgentThreadFeedInlineDemoPage() {
  const store = useThreads()
  const [mountCounts, bumpMount] = usePerThreadCounter()
  const [streamCounts, bumpStream] = usePerThreadCounter()
  const transport = useMemo(() => makeCountingTransport(bumpStream), [bumpStream])
  const { runs, start, stop } = useAgentThreadRuns({
    transport,
    store,
    resolveOutcome: heuristicOutcome,
  })

  // `renderRow` bypasses `ThreadFeed`'s own collapsedId tracking entirely (see its doc) — this
  // panel owns expand/collapse itself, one row open at a time, mirroring the outcome panel's
  // single-selection model.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [outcomeSelectedId, setOutcomeSelectedId] = useState<string | null>(null)

  // Seeds three ALREADY-SETTLED threads straight into the store — deliberately NOT via start()
  // (see this module's doc, fix 2, for the StrictMode abort race that produced when it was). Each
  // scenario's `.parts(prompt)` is a synchronous, fully-formed AgentPart[] (no transport, no
  // controller, nothing an unmount-cleanup effect could ever abort), so both StrictMode mount
  // passes see the same three finished threads and neither leaves anything registered to tear down.
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current || store.threads.length > 0) return
    seededRef.current = true
    for (const prompt of SEED_PROMPTS) {
      const scenario = nextSeedScenario()
      const id = store.create()
      const createdAt = Date.now()
      const userMessage: ChatMessage<AgentPart> = {
        id: crypto.randomUUID(),
        role: 'user',
        parts: [{ id: crypto.randomUUID(), type: 'text', text: prompt }],
        createdAt,
      }
      const assistantMessage: ChatMessage<AgentPart> = {
        id: crypto.randomUUID(),
        role: 'assistant',
        parts: scenario.parts(prompt),
        createdAt: createdAt + 1,
        finish: 'complete',
      }
      store.appendMessage(id, userMessage)
      store.appendMessage(id, assistantMessage)
      store.setStatus(id, 'done')
      store.setOutcome(
        id,
        heuristicOutcome({
          id,
          messages: [userMessage, assistantMessage],
          outcome: null,
          status: 'done',
          read: false,
          createdAt,
          updatedAt: createdAt + 1,
        }),
      )
    }
  }, [store])

  const handleSend = useCallback(
    (thread: AgentThread, payload: ComposerSubmit) => {
      start(thread.id, payload.text)
    },
    [start],
  )

  const handleReset = useCallback(() => {
    store.clear()
    seededRef.current = false
  }, [store])

  const inlineRow = useCallback(
    (thread: AgentThread) => {
      const expanded = thread.id === expandedId
      const run = runs.get(thread.id)
      return (
        <Stack gap={4}>
          <Group gap={6}>
            <Badge variant="light" color="gray" size="xs" ff="monospace">
              {`mounted ${mountCounts.get(thread.id) ?? 0}×`}
            </Badge>
            <Badge variant="light" color="gray" size="xs" ff="monospace">
              {`stream started ${streamCounts.get(thread.id) ?? 0}×`}
            </Badge>
          </Group>
          <ThreadFeedRow
            thread={thread}
            expanded={expanded}
            onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
            {...(run !== undefined
              ? { liveParts: run.parts, liveStatus: 'streaming' as const }
              : {})}
            // `PartRenderers` is augmented PROGRAM-WIDE by ./agent-part-registry.type-guard.ts
            // ('data-toolProgress' | 'data-chart') — module augmentation is global for this whole
            // tsconfig, so the augmented type no longer accepts an arbitrary extra key by direct
            // assignment (excess-property-checked, unlike `definePartRenderers`'s own const-generic
            // call site — see that fixture's Fixture 3 for the asymmetry). This demo intentionally
            // hijacks the REAL 'reasoning' key, which was never meant to be constrained by that
            // augmentation at all, so the cast below is a scoped, deliberate escape — not a case the
            // augmented type was ever supposed to validate.
            renderers={
              { reasoning: makeReasoningProbe(thread.id, bumpMount) } as unknown as PartRenderers
            }
            onSend={(payload) => handleSend(thread, payload)}
            onStop={() => stop(thread.id)}
          />
        </Stack>
      )
    },
    [expandedId, runs, mountCounts, streamCounts, bumpMount, handleSend, stop],
  )

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>Thread feed — inline row vs outcome row</Title>
        <Text size="sm" c="dimmed" mt={4}>
          The same three threads, rendered two ways: the Slack-shaped inline row on the left (expand
          in place, transcript + composer), the unchanged inbox row on the right. Both load already
          settled — expand a row on the left, watch its two counters, then collapse and re-expand it
          a few times — both must stay flat. Sending a new message (the composer at the bottom of an
          expanded row) is the only thing allowed to move either counter, and now shows a Stop
          button while it streams.
        </Text>
      </div>

      <SimpleGrid cols={2} spacing="md">
        <Paper p="sm">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={6}>
            variant=&quot;inline&quot; (renderRow → ThreadFeedRow)
          </Text>
          <Box style={{ height: PANEL_HEIGHT }}>
            <ThreadFeed
              threads={store.threads}
              activeId={expandedId}
              onSelect={setExpandedId}
              renderRow={inlineRow}
            />
          </Box>
        </Paper>
        <Paper p="sm">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={6}>
            variant=&quot;outcome&quot; (ThreadOutcomeCard, unchanged)
          </Text>
          <Box style={{ height: PANEL_HEIGHT }}>
            <ThreadFeed
              threads={store.threads}
              activeId={outcomeSelectedId}
              onSelect={setOutcomeSelectedId}
              variant="outcome"
            />
          </Box>
        </Paper>
      </SimpleGrid>

      <Group gap="xs">
        <Button radius="md" variant="default" leftSection={<IconReset />} onClick={handleReset}>
          Reset demo
        </Button>
      </Group>
    </Stack>
  )
}
