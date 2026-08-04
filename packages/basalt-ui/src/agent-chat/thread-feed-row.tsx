/**
 * ThreadFeedRow — the inline-expanding "Slack shape" projection of one `AgentThread`: a header row
 * that expands IN PLACE to reveal the thread's live transcript and a composer, instead of opening a
 * separate detail pane (compare `ThreadOutcomeCard` + `ThreadDetailPanel`, the inbox variant).
 * `ThreadOutcomeCard` is untouched by this — it stays inbox-shaped by design and deliberately never
 * renders live text (its module doc, and its `isPreviewing` branch, which shows a skeleton rather
 * than the in-flight turn); this is a second, sibling component, not a mode on the first.
 *
 * LOAD-BEARING INVARIANT — read before touching the expand/collapse mechanics: once a row has been
 * expanded for the first time, its transcript+composer subtree mounts LAZILY (nothing renders before
 * that first expand) and then STAYS MOUNTED for the rest of the row's lifetime. Collapsing hides it
 * with CSS only (`display: none`); it never unmounts.
 *
 * Do NOT delegate this to Mantine `Collapse`. On the installed `@mantine/core@9.3.0` a bare
 * `<Collapse expanded>` happens to do the right thing (children stay mounted, hidden via
 * `display: none` from `useCollapse`) — but Mantine master has already flipped the defaults to
 * `keepMounted: true` + `keepMountedMode: 'activity'`, which wraps children in React 19 `<Activity>`.
 * `<Activity mode="hidden">` DESTROYS the subtree's effects and RE-CREATES them on show, so the day
 * this repo bumps Mantine, a bare `Collapse` would silently start re-firing every effect in the
 * transcript on every re-open — for a streaming transport's subscription/resume effect, a literal
 * duplicate stream replay. Own the show/hide here, in plain CSS, so no upstream default change can
 * flip the semantics out from under this component. There are two separate guarantees and both are
 * required: never render before the first expand (lazy), and never unmount after (kept).
 *
 * @example
 * import { ThreadFeedRow } from 'basalt-ui'
 *
 * <ThreadFeedRow
 *   thread={thread}
 *   expanded={openId === thread.id}
 *   onToggle={(id) => setOpenId((current) => (current === id ? null : id))}
 *   onSend={(payload) => send(thread.id, payload)}
 * />
 */
import { Box, Group, Stack, Text, UnstyledButton } from '@mantine/core'
import type { JSX } from 'react'
import { useState } from 'react'
import type {
  AgentThread,
  ForeignPart,
  PartRenderer,
  PartRenderers,
  StreamStatus,
  TranscriptPart,
} from '../agent'
import { VX } from '../tokens'
import type { ComposerProps, ComposerSubmit } from './composer'
import { Composer } from './composer'
import type { MessageAffordances } from './message-affordances'
import { formatRelativeTime } from './relative-time'
import { ThreadTranscript } from './thread-message'
import { resolveVirtualize } from './virtualize'
import type { VirtualizeProps } from './virtualize'

/** A minimal, dependency-free chevron — rotates 90deg when expanded (same inline-svg idiom as
 * `composer.tsx`'s `SendGlyph`/`StopGlyph`: no icon-library dependency for a one-off glyph). */
function ChevronGlyph({ expanded }: { expanded: boolean }): JSX.Element {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{
        transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 120ms ease',
        flexShrink: 0,
      }}
    >
      <path
        d="M9 6l6 6l-6 6"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type ThreadFeedRowBase = {
  /**
   * The thread this row projects. Typed against `AgentThread<TranscriptPart>` — not the plain,
   * `AgentPart`-defaulted `AgentThread` `ThreadFeed` uses, and not a type parameter. A consumer
   * with a registered `ForeignPart` union passes its own threads straight through with no generic
   * argument and no cast, because `TranscriptPart` is the widest part type and arrays are
   * structurally covariant: `AgentPart[]` and `ConsumerPart[]` both widen into `TranscriptPart[]`.
   * Widening the row is what lets both `ThreadFeed` (non-generic, `AgentThread<AgentPart>`) and a
   * part-registry consumer feed the same component.
   */
  readonly thread: AgentThread<TranscriptPart>
  /** Whether this row's transcript+composer body is currently visible. */
  readonly expanded: boolean
  /** Called with the thread's id when the header is clicked/activated. */
  readonly onToggle: (id: string) => void
  /** The live (in-flight) assistant turn's parts, when a run is streaming for this thread. */
  readonly liveParts?: readonly TranscriptPart[]
  /** The live run's status — drives the in-progress indicator on the live block. */
  readonly liveStatus?: StreamStatus
  /** Consumer renderers keyed by part.type, forwarded to `ThreadTranscript`. */
  readonly renderers?: PartRenderers
  /** Forwarded to `ThreadTranscript` — see its own prop doc. */
  readonly fallbackRenderer?: PartRenderer<ForeignPart>
  /**
   * Per-message hover-row contract (timestamp/copy/regenerate/actions), forwarded verbatim to the
   * row's `ThreadTranscript`. Shared with it via `message-affordances.ts` so the two cannot drift
   * on what an unset field means.
   */
  readonly affordances?: MessageAffordances
  /** Forwarded to `ThreadTranscript` — suppresses role label + chrome on same-speaker runs.
   * @default true */
  readonly groupConsecutive?: boolean
  /** Called with the composer's submit payload. */
  readonly onSend: (payload: ComposerSubmit) => void
  /** Shown as the composer's Stop action while `liveStatus === 'streaming'`. */
  readonly onStop?: () => void
  /** Forwarded to the row's `Composer`, minus the three props this component always wires itself
   * (`onSubmit`, `onStop`, and `streaming` — the last derived from `liveStatus` so a consumer can't
   * pass one that disagrees with the row's own live status). */
  readonly composerProps?: Omit<ComposerProps, 'onSubmit' | 'onStop' | 'streaming'>
}

/**
 * `virtualize`/`height` are forwarded straight to the row's `ThreadTranscript`, carrying the same
 * union guard: an inline row holding a very long thread can window it, and doing so REQUIRES a
 * `height` (the transcript then owns a fixed-height scroll node inside the expanded body, instead
 * of the body growing to the thread's full length). Omit both and the row's transcript is
 * content-sized, as before.
 */
export type ThreadFeedRowProps = ThreadFeedRowBase & VirtualizeProps

/** The row header's title: the resolved outcome title, else a plain placeholder — this row never
 * falls back to scanning the first user message the way `ThreadOutcomeCard`'s `promptOf` does,
 * since an inline row's own expanded transcript already shows that prompt a scroll away. */
function rowTitle(thread: AgentThread<TranscriptPart>): string {
  return thread.outcome?.title ?? 'Untitled thread'
}

/**
 * One inline-expanding thread row: a header (title + relative timestamp) that toggles a lazily
 * mounted, kept-mounted transcript + composer body. See the module doc for the mount lifecycle
 * invariant this component exists to guarantee.
 *
 * @example
 * <ThreadFeedRow thread={thread} expanded={expanded} onToggle={onToggle} onSend={onSend} />
 */
export function ThreadFeedRow(props: ThreadFeedRowProps): JSX.Element {
  const {
    thread,
    expanded,
    onToggle,
    liveParts,
    liveStatus,
    renderers,
    fallbackRenderer,
    affordances,
    groupConsecutive,
    onSend,
    onStop,
    composerProps,
  } = props

  // Resolved through the shared narrowing point rather than by destructuring `virtualize`/`height`
  // apart — see `resolveVirtualize`'s doc for why the two must be read together.
  const virtualized = resolveVirtualize(props)
  const virtualizeProps: VirtualizeProps =
    virtualized === null ? {} : { virtualize: virtualized.options, height: virtualized.height }

  // Lazy-mount + keep-mounted: flips true on the row's first expand and never resets. Everything
  // below this line renders — once — the first time `expanded` becomes true, and stays in the tree
  // (hidden via `display` only) for every collapse/expand after that. See the module doc.
  //
  // Set during render, not a `useEffect` — React's documented "adjusting state as props change"
  // pattern (bails out via the `!hasOpened` guard, so this runs at most once per mount). A
  // `useEffect` would flip `hasOpened` only AFTER the first expand's render had already committed
  // with the body absent, so the header's first expand painted one tick before the body appeared.
  // Setting it here makes React restart this render with `hasOpened` already true, so the header
  // and the newly-lazy-mounted body commit in the same paint.
  const [hasOpened, setHasOpened] = useState(expanded)
  if (expanded && !hasOpened) {
    setHasOpened(true)
  }

  const summary = thread.outcome?.summary ?? ''

  // The composer half of `liveStatus`: `Composer` only shows its Stop action and gates the
  // textarea when it is TOLD a run is streaming (`composer.tsx`'s `showStop`/`inputDisabled`) — it
  // has no way to infer that from `onStop` alone. Forwarding `onStop` without this was the defect:
  // Stop never rendered and a second turn could still be typed into a live thread.
  const streaming = liveStatus === 'streaming'

  return (
    <Box
      style={{
        borderRadius: VX.radiusCard,
        boxShadow: VX.shadowCard,
        backgroundColor: VX.surface.panel,
        overflow: 'hidden',
      }}
    >
      <UnstyledButton
        onClick={() => onToggle(thread.id)}
        w="100%"
        aria-expanded={expanded}
        style={{
          display: 'block',
          padding: 'var(--mantine-spacing-xs) var(--mantine-spacing-sm)',
        }}
      >
        <Group justify="space-between" gap="xs" wrap="nowrap" align="center">
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Text
              fw={550}
              lineClamp={1}
              style={{
                fontFamily: 'var(--basalt-font-head)',
                fontSize: VX.text.md,
                fontStretch: '88%',
              }}
            >
              {rowTitle(thread)}
            </Text>
            {summary.length > 0 && (
              <Text size="xs" c="dimmed" lineClamp={1}>
                {summary}
              </Text>
            )}
          </Stack>
          <Text
            style={{
              fontFamily: 'var(--basalt-font-mono)',
              fontSize: VX.text.micro,
              color: VX.faint,
              flexShrink: 0,
            }}
          >
            {formatRelativeTime(thread.updatedAt)}
          </Text>
          <ChevronGlyph expanded={expanded} />
        </Group>
      </UnstyledButton>
      {hasOpened && (
        <Box
          data-testid="thread-feed-row-body"
          style={{
            display: expanded ? 'block' : 'none',
            padding: 'var(--mantine-spacing-sm)',
            paddingTop: 0,
          }}
        >
          <Stack gap="sm">
            <ThreadTranscript
              messages={thread.messages}
              {...(liveParts !== undefined ? { liveParts } : {})}
              {...(liveStatus !== undefined ? { liveStatus } : {})}
              {...(renderers !== undefined ? { renderers } : {})}
              {...(fallbackRenderer !== undefined ? { fallbackRenderer } : {})}
              {...(affordances !== undefined ? { affordances } : {})}
              {...(groupConsecutive !== undefined ? { groupConsecutive } : {})}
              {...virtualizeProps}
            />
            <Composer
              onSubmit={onSend}
              streaming={streaming}
              {...(onStop !== undefined ? { onStop } : {})}
              {...composerProps}
            />
          </Stack>
        </Box>
      )}
    </Box>
  )
}
