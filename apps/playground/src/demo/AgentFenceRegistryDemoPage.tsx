/**
 * AgentFenceRegistryDemoPage — basalt-ui 1.12.0 playground gate demo 1: `Markdown`'s
 * `fenceRenderers` registry + `settledOnly`, the F1 fix, and the decline/throw containment that
 * ships alongside it.
 *
 * The streamed answer below carries five custom fences, deliberately positioned so every case is
 * independently observable in ONE run:
 *
 *  - a `card` fence, immediately followed by more text (NOT the message's tail block) — it settles
 *    (CodeBlock → the real card renderer) as soon as the next block starts, mid-stream. This half
 *    already worked before 1.12.0: `blockSplit` closes a block the moment a boundary after it has
 *    been emitted.
 *  - three degradation fences (`strict-json`, `always-throws`, `throws-in-render`) proving a
 *    malformed or failing custom renderer can never take the whole message down — see each
 *    renderer's own comment for which containment path it exercises.
 *  - a `vega-lite`-shaped fence with nothing after it — the message's TRUE tail block. It stays a
 *    plain `CodeBlock` for the rest of the stream (blockSplit never closes the tail while more text
 *    could still arrive), then upgrades the instant the WHOLE message finishes. Before 1.12.0 that
 *    upgrade never happened: `threadPartRenderers.text` hardcoded `streaming` on `Markdown`
 *    regardless of whether the message itself had settled, so a finished message's final fence (and
 *    its copy action) stayed hidden forever — defect F1, the headline fix of this release.
 *
 * `streaming={status === 'streaming'}` on the single `<Markdown>` call below IS the fix, at the call
 * site: bind it to whether the RUN — not just this block — is still in flight, and the tail settles
 * for free the moment the run ends.
 */
import { Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core'
import type { AgentPart, AgentTransport } from 'basalt-ui/agent'
import { useAgentStream } from 'basalt-ui/agent'
import { Markdown, settledOnly } from 'basalt-ui/content'
import type { FenceRenderContext, FenceRenderers } from 'basalt-ui/content'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { IconSparkle } from './icons'

// ── Custom fence renderers (module scope — referentially stable for Markdown's memoization) ────

type CardFields = Record<string, string>

function parseCardFence(code: string): CardFields {
  const fields: CardFields = {}
  for (const line of code.split('\n')) {
    const separator = line.indexOf(':')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    if (key.length === 0) continue
    fields[key] = line.slice(separator + 1).trim()
  }
  return fields
}

function CardFenceRenderer({ code }: FenceRenderContext) {
  const fields = parseCardFence(code)
  return (
    <Paper p="sm">
      <Stack gap={4}>
        <Group gap={6}>
          <Badge size="xs" variant="light" color="blue">
            card fence
          </Badge>
          <Text fw={600} size="sm">
            {fields['title'] ?? 'Untitled card'}
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          {fields['body'] ?? ''}
        </Text>
      </Stack>
    </Paper>
  )
}

type VegaLiteSpec = { readonly mark?: string; readonly encoding?: Record<string, unknown> }

function parseVegaLiteSpec(code: string): VegaLiteSpec | null {
  try {
    const parsed: unknown = JSON.parse(code)
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as VegaLiteSpec
  } catch {
    return null
  }
}

/** A "vega-lite-shaped" fence renderer — parses the spec's `mark`/`encoding` shape and shows what
 * it would chart, without pulling in a real vega-lite runtime (out of scope for this registry
 * demo; the point is proving the registry dispatches on the `vega-lite` fence language).
 *
 * Returning `undefined` on an unparseable spec DECLINES — FenceBlock falls back to the default
 * CodeBlock rendering itself, with the fence's own `language`/`title`/`showCopy` wired in for
 * free. Before the decline convention this had to hand-roll `<CodeBlock code={code}
 * language="json" />`, which loses the fence's real language/title metadata and duplicates what
 * the framework's own fallback already does — the decline convention is a genuine simplification,
 * not just fewer lines. */
function VegaLiteFenceRenderer({ code }: FenceRenderContext): ReactNode {
  const spec = parseVegaLiteSpec(code)
  if (spec === null) return undefined
  const fields = spec.encoding !== undefined ? Object.keys(spec.encoding) : []
  return (
    <Paper p="sm">
      <Stack gap={4}>
        <Group gap={6}>
          <Badge size="xs" variant="light" color="grape">
            vega-lite fence
          </Badge>
          <Text fw={600} size="sm">
            {spec.mark ?? 'unknown'} mark
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          {fields.length > 0 ? `Encoded fields: ${fields.join(', ')}` : 'No encoding channels.'}
        </Text>
      </Stack>
    </Paper>
  )
}

// ── Degradation cases — a malformed or failing custom renderer must never take the message down ──

/** DECLINE case: returns `undefined` on a body it cannot parse as JSON, so `FenceBlock` falls back
 * to the default `CodeBlock` rendering instead of crashing or showing nothing. Not wrapped in
 * `settledOnly` — the decline path is a parse-robustness concern, independent of streaming
 * settlement, so it should fall back the instant a malformed body streams in, not only once
 * settled. */
function StrictJsonFenceRenderer({ code }: FenceRenderContext): ReactNode {
  try {
    JSON.parse(code)
  } catch {
    return undefined
  }
  return (
    <Paper p="sm">
      <Group gap={6}>
        <Badge size="xs" variant="light" color="teal">
          strict-json fence
        </Badge>
        <Text size="xs" c="dimmed">
          Parsed OK.
        </Text>
      </Group>
    </Paper>
  )
}

/** THROW case #1: the renderer FUNCTION itself throws synchronously — contained by
 * `renderFenceSafely`'s try/catch in `fence-block.tsx`, which sits in the same call stack as this
 * invocation. */
function AlwaysThrowsFenceRenderer(): ReactNode {
  throw new Error('AlwaysThrowsFenceRenderer: simulated synchronous renderer failure')
}

/** THROW case #2: the renderer returns a valid element descriptor, but the COMPONENT it returns
 * throws during ITS OWN render — a later, separate stack frame `renderFenceSafely`'s try/catch
 * cannot reach. Contained by `FenceRenderBoundary`, the error boundary wrapping every fence. */
function BoomComponent(): ReactNode {
  throw new Error('BoomComponent: simulated render-phase failure inside the returned subtree')
}
function ThrowsInRenderFenceRenderer(): ReactNode {
  return <BoomComponent />
}

const FENCE_RENDERERS: FenceRenderers = {
  card: settledOnly(CardFenceRenderer),
  'vega-lite': settledOnly(VegaLiteFenceRenderer),
  'strict-json': StrictJsonFenceRenderer,
  'always-throws': AlwaysThrowsFenceRenderer,
  'throws-in-render': ThrowsInRenderFenceRenderer,
}

// ── A scripted, word-by-word stream carrying all five fences ────────────────────

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const done = (): void => resolve()
    const timer = setTimeout(done, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        done()
      },
      { once: true },
    )
  })
}

function tokens(text: string): string[] {
  const pieces = text.match(/\S+\s*/g) ?? [text]
  const out: string[] = []
  for (let i = 0; i < pieces.length; i += 2) out.push(pieces.slice(i, i + 2).join(''))
  return out
}

const STEP_DELAY = 110

const FENCE_DEMO_TEXT =
  `A custom \`card\` fence, immediately followed by more text — it is NOT this message's tail ` +
  `block:\n\n` +
  '```card\n' +
  `title: Render budget\n` +
  `body: One re-render per streamed delta once parts are coalesced.\n` +
  '```\n\n' +
  `A \`strict-json\` fence with a deliberately malformed body — the renderer DECLINES and the ` +
  `default CodeBlock renders it instead:\n\n` +
  '```strict-json\n' +
  `{ this is not valid JSON }\n` +
  '```\n\n' +
  `An \`always-throws\` fence — the renderer function itself throws synchronously, caught and ` +
  `falling back to CodeBlock:\n\n` +
  '```always-throws\n' +
  `this body is never reached\n` +
  '```\n\n' +
  `A \`throws-in-render\` fence — the renderer returns a component that throws during ITS OWN ` +
  `render, caught by an error boundary instead:\n\n` +
  '```throws-in-render\n' +
  `this body is never reached either\n` +
  '```\n\n' +
  `The spec below IS this message's tail block — it stays a plain CodeBlock until the whole ` +
  `message finishes, then upgrades:\n\n` +
  '```vega-lite\n' +
  '{\n  "mark": "bar",\n  "encoding": { "x": "day", "y": "count" }\n}\n' +
  '```\n'

const fenceDemoTransport: AgentTransport<AgentPart, string> = {
  async *stream(_input, signal) {
    const id = crypto.randomUUID()
    for (const delta of tokens(FENCE_DEMO_TEXT)) {
      if (signal?.aborted) return
      await sleep(STEP_DELAY, signal)
      if (signal?.aborted) return
      yield { id, type: 'text', text: delta }
    }
  },
}

function isTextPart(part: AgentPart): part is Extract<AgentPart, { type: 'text' }> {
  return part.type === 'text'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AgentFenceRegistryDemoPage() {
  const { parts, status, send } = useAgentStream({ transport: fenceDemoTransport })

  const text = useMemo(
    () =>
      parts
        .filter(isTextPart)
        .map((part) => part.text)
        .join(''),
    [parts],
  )

  const streaming = status === 'streaming'
  const hasStarted = status !== 'idle'

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>Fence renderer registry</Title>
        <Text size="sm" c="dimmed" mt={4}>
          Five custom fences, all registered through <code>Markdown</code>'s{' '}
          <code>fenceRenderers</code>: a <code>card</code> fence and a <code>vega-lite</code>-shaped
          fence (both wrapped in <code>settledOnly</code>), plus three degradation cases proving a
          malformed or failing custom renderer can never take the page down —{' '}
          <code>strict-json</code> DECLINES on a body it can't parse, <code>always-throws</code>{' '}
          throws synchronously from the renderer itself, and <code>throws-in-render</code> returns a
          component that throws during its own render. All three visibly fall back to a plain{' '}
          <code>CodeBlock</code>. Run the stream and watch the trailing <code>vega-lite</code> spec
          sit as a plain <code>CodeBlock</code> for as long as the message is in flight — then watch
          it upgrade the instant the run finishes.
        </Text>
      </div>

      <Group gap="xs" align="center">
        <Button
          radius="md"
          leftSection={<IconSparkle />}
          onClick={() => void send('run')}
          disabled={streaming}
        >
          {hasStarted ? 'Run again' : 'Run stream'}
        </Button>
        <Badge size="sm" color={streaming ? 'blue' : hasStarted ? 'green' : 'gray'} variant="light">
          {streaming ? 'streaming' : hasStarted ? 'done' : 'idle'}
        </Badge>
      </Group>

      <Paper p="sm" mih={220}>
        {!hasStarted ? (
          <Text size="sm" c="dimmed">
            Nothing streamed yet — click "Run stream".
          </Text>
        ) : (
          <Markdown
            streaming={streaming}
            contentTrust="untrusted"
            density="chat"
            fenceRenderers={FENCE_RENDERERS}
          >
            {text}
          </Markdown>
        )}
      </Paper>
    </Stack>
  )
}
