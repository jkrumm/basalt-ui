/**
 * AgentForeignPartsDemoPage — the 1.11.0 playground gate's headline demo: a consumer-registered
 * foreign part type reaching the transcript alongside basalt's own built-in parts, driven through
 * the REAL streaming seam (transport → `useAgentThreadRuns<TranscriptPart>` → `runs.get(id).parts`
 * → `ThreadTranscript`'s `liveParts`) rather than a hand-injected static array — proving the
 * registry works end to end, not just at the type level.
 *
 * `BasaltRegister['parts']` is already augmented program-wide by
 * `./agent-part-registry.type-guard.ts` (`'data-toolProgress' | 'data-chart'`) — module augmentation
 * is global for the whole playground tsconfig, so `definePartRenderers` below is checked against
 * that SAME registered union; this file must not re-augment it (a second, differently-shaped
 * `declare module 'basalt-ui'` block for the same property would be a tsc error).
 *
 * A THIRD part type, `data-debugPing`, is deliberately left UNREGISTERED — it flows through the
 * exact same streaming path but has no renderer, so `ThreadTranscript`'s `fallbackRenderer` has to
 * render it instead of throwing or blanking the transcript. That is the point of this half of the
 * demo: a server that starts emitting a part type this build has never seen must not break the chat.
 *
 * @example
 * <Route path="/agent-foreign-parts" component={AgentForeignPartsDemoPage} />
 */
import { Badge, Box, Button, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core'
import { EmptyState } from 'basalt-ui'
import { createThreadsStore, definePartRenderers, useAgentThreadRuns } from 'basalt-ui/agent'
import type {
  AgentPart,
  AgentTransport,
  ForeignPart,
  OutcomeResolver,
  PartRenderContext,
  TranscriptPart,
} from 'basalt-ui/agent'
import { ThreadTranscript } from 'basalt-ui/agent-chat'
import { Bars, ChartCard } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'
import type { ReactNode } from 'react'
import { useCallback } from 'react'
import { IconReset, IconSparkle } from './icons'

// Mirrors thread-message.tsx's/tool-chip.tsx's micro-label/rail idiom — duplicated locally per the
// existing precedent of each Mantine-facing renderer file owning its own copy of these style objects.
const MICRO_LABEL_STYLE = {
  fontFamily: 'var(--basalt-font-mono)',
  fontSize: VX.text.micro,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: VX.faint,
} as const
const RAIL_STYLE = {
  borderLeft: `2px solid ${VX.divider}`,
  paddingLeft: 'var(--vx-space-agent-rail-inset-x)',
} as const

// ── Scripted foreign-part stream ──────────────────────────────────────────────

// The demo's own shapes for the two REGISTERED foreign part types — structurally identical to the
// (unexported) types the type-guard fixture augmented `BasaltRegister['parts']` with. Only `type`/
// `id` need to line up for the runtime resolution in ThreadTranscript; the renderer's `part`
// parameter below is independently typed from `ConsumerPart`, not from these local aliases.
type ToolProgressPart = ForeignPart & {
  readonly type: 'data-toolProgress'
  readonly tool: string
  readonly message: string
}
type ChartPart = ForeignPart & {
  readonly type: 'data-chart'
  readonly spec: {
    readonly title: string
    readonly data: { readonly label: string; readonly value: number }[]
  }
}
/** Deliberately NOT registered on `BasaltRegister['parts']` — this is the "server just started
 * emitting a new part type" case the fallback path exists for. */
type DebugPingPart = ForeignPart & {
  readonly type: 'data-debugPing'
  readonly note: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const STEP_DELAY = 340

/** One scripted turn: built-in text/reasoning/tool/source parts interleaved with the two
 * registered foreign types AND one unregistered one — streamed through a real AsyncGenerator, not
 * assembled into a static array. */
async function* scriptedForeignStream(input: string): AsyncGenerator<TranscriptPart> {
  yield { id: crypto.randomUUID(), type: 'start', runId: 'foreign-parts-demo' }

  await sleep(STEP_DELAY)
  yield { id: crypto.randomUUID(), type: 'text', text: `Looking into "${input}"…\n\n` }

  await sleep(STEP_DELAY)
  const toolProgress: ToolProgressPart = {
    id: crypto.randomUUID(),
    type: 'data-toolProgress',
    tool: 'inventory_lookup',
    message: 'Checking warehouse stock…',
  }
  yield toolProgress

  await sleep(STEP_DELAY)
  yield {
    id: crypto.randomUUID(),
    type: 'reasoning',
    text: 'Three warehouses carry this SKU — comparing lead time against stock depth before answering.',
  }

  await sleep(STEP_DELAY)
  const toolCallId = crypto.randomUUID()
  yield {
    id: `tool#${toolCallId}`,
    type: 'tool',
    toolCallId,
    toolName: 'inventory_lookup',
    state: 'output-available',
    input: { sku: 'SKU-4471' },
    output: {
      warehouses: [
        { id: 'w-12', stock: 84 },
        { id: 'w-07', stock: 3 },
      ],
    },
  }

  await sleep(STEP_DELAY)
  const chart: ChartPart = {
    id: crypto.randomUUID(),
    type: 'data-chart',
    spec: {
      title: 'Stock by warehouse — SKU-4471',
      data: [
        { label: 'w-12', value: 84 },
        { label: 'w-07', value: 3 },
      ],
    },
  }
  yield chart

  await sleep(STEP_DELAY)
  // A part type this build never registered — proves the never-throws fallback path renders
  // something instead of blanking the transcript.
  const debugPing: DebugPingPart = {
    id: crypto.randomUUID(),
    type: 'data-debugPing',
    note: 'trace=a91f — upstream latency 128ms',
  }
  yield debugPing

  await sleep(STEP_DELAY)
  yield {
    id: crypto.randomUUID(),
    type: 'source',
    url: 'https://internal.example/inventory/SKU-4471',
    title: 'Inventory ledger — SKU-4471',
  }

  await sleep(STEP_DELAY)
  yield {
    id: crypto.randomUUID(),
    type: 'text',
    text: 'Warehouse w-12 has 84 units; w-07 is low at 3. Recommend fulfilling from w-12.',
  }
}

const foreignPartsTransport: AgentTransport<TranscriptPart, string> = {
  stream: (input) => scriptedForeignStream(input),
}

// ── Store + outcome resolver ──────────────────────────────────────────────────

// One stable store at module scope (createThreadsStore must be called ONCE per key, same rule as
// every other agent demo).
const useForeignPartsThreads = createThreadsStore<TranscriptPart>({
  key: 'playground-foreign-parts',
  version: 1,
})

const resolveForeignOutcome: OutcomeResolver<TranscriptPart> = (thread) => {
  const lastAssistant = thread.messages.toReversed().find((message) => message.role === 'assistant')
  const textPart = lastAssistant?.parts.find(
    (part): part is Extract<AgentPart, { type: 'text' }> => part.type === 'text',
  )
  return { title: 'Foreign parts demo', summary: textPart?.text.slice(0, 88) ?? '', status: 'done' }
}

/** Required because TPart isn't the default AgentPart union — wraps raw composer input in a
 * single built-in text part (the demo never lets the user type a foreign part). */
function toForeignUserParts(input: string): TranscriptPart[] {
  return [{ id: crypto.randomUUID(), type: 'text', text: input }]
}

// ── Consumer renderers for the two REGISTERED foreign types ──────────────────

const foreignRenderers = definePartRenderers({
  'data-toolProgress': ({ part }) => (
    <Box style={RAIL_STYLE}>
      <Group gap={6} align="center">
        <Loader size="xs" />
        <Text style={MICRO_LABEL_STYLE}>{part.tool}</Text>
        <Text size="xs" c="dimmed">
          {part.message}
        </Text>
      </Group>
    </Box>
  ),
  'data-chart': ({ part, settled }) => (
    <Stack gap={4}>
      <Text style={MICRO_LABEL_STYLE}>Chart (consumer-rendered)</Text>
      <ChartCard
        title={part.spec.title}
        tooltip="Warehouse stock levels for this SKU — rendered by the consumer's own data-chart renderer, not basalt."
      >
        {/* Single-series categorical bars: stock level per warehouse is one metric plotted across
         * categories, not two competing series — stays neutral per the "a lone single-series metric
         * stays neutral" rule rather than earning a color per warehouse. */}
        <Bars
          data={part.spec.data}
          height={160}
          chartId={`foreign-chart-${part.id}`}
          getX={(d) => d.label}
          getValue={(d) => d.value}
          isPending={!settled}
          positiveBars={[{ key: 'value', label: 'Stock', color: VX.line }]}
          y={{ domain: 'auto' }}
        />
      </ChartCard>
    </Stack>
  ),
})

/** Rendered only for a part that is neither a registered consumer type nor a built-in AgentPart —
 * here, `data-debugPing`. Explicit (not the library default) so this stays visible in a production
 * build of the playground too, not just in dev. */
function foreignFallbackRenderer(ctx: PartRenderContext<ForeignPart>): ReactNode {
  return (
    <Box style={RAIL_STYLE}>
      <Group gap={6} align="center">
        <Badge color="orange" variant="light" size="xs">
          unregistered
        </Badge>
        <Text style={MICRO_LABEL_STYLE}>{`type: ${ctx.part.type}`}</Text>
      </Group>
      {typeof ctx.part['note'] === 'string' && (
        <Text size="xs" c="dimmed" mt={2}>
          {ctx.part['note']}
        </Text>
      )}
    </Box>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AgentForeignPartsDemoPage() {
  const store = useForeignPartsThreads()
  const { runs, start } = useAgentThreadRuns<TranscriptPart>({
    transport: foreignPartsTransport,
    store,
    resolveOutcome: resolveForeignOutcome,
    toUserParts: toForeignUserParts,
  })

  const thread = store.threads[0]
  const run = thread !== undefined ? runs.get(thread.id) : undefined

  const handleRun = useCallback(() => {
    const id = thread?.id ?? store.create()
    start(id, "Where's my order for SKU-4471?")
  }, [store, thread, start])

  const handleReset = useCallback(() => {
    store.clear()
  }, [store])

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>Agent chat — foreign parts</Title>
        <Text size="sm" c="dimmed" mt={4}>
          A custom <code>data-toolProgress</code> and <code>data-chart</code> part type — registered
          through <code>BasaltRegister[&apos;parts&apos;]</code> — rendered by consumer renderers
          alongside built-in text/reasoning/tool/source parts in one transcript, streamed through{' '}
          <code>useAgentThreadRuns&lt;TranscriptPart&gt;</code>. A third, unregistered{' '}
          <code>data-debugPing</code> type proves the never-throws fallback path.
        </Text>
      </div>

      <Paper py="xs" px="sm" style={{ minHeight: 220 }}>
        {thread === undefined ? (
          <Stack align="center" justify="center" mih={200}>
            <EmptyState
              icon={<IconSparkle />}
              title="Run the demo to start"
              description="Streams a scripted turn mixing built-in parts with two registered foreign types and one unregistered one."
              variant="section"
            />
          </Stack>
        ) : (
          <ThreadTranscript
            messages={thread.messages}
            {...(run !== undefined
              ? { liveParts: run.parts, liveStatus: 'streaming' as const }
              : {})}
            renderers={foreignRenderers}
            fallbackRenderer={foreignFallbackRenderer}
          />
        )}
      </Paper>

      <Group gap="xs">
        <Button
          radius="md"
          leftSection={<IconSparkle />}
          onClick={handleRun}
          disabled={thread !== undefined}
        >
          Run demo turn
        </Button>
        <Button radius="md" variant="default" leftSection={<IconReset />} onClick={handleReset}>
          Reset demo
        </Button>
      </Group>
    </Stack>
  )
}
