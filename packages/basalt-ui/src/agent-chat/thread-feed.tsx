/**
 * ThreadFeed — a scrollable, animated list of thread rows for a multi-thread inbox.
 *
 * Wraps the list in `AnimatePresence` (`popLayout`) so removing/reordering threads reflows the
 * remaining rows smoothly; each row is a `motion.div` keyed by `thread.id` (never index — index
 * keys would corrupt the layout animation identity when threads are prepended/removed). Branches
 * on `useReducedMotion` for a plain, unanimated `Stack`.
 *
 * Row content is picked by `variant` (default `'outcome'`, today's `ThreadOutcomeCard` inbox
 * behaviour, unchanged) or `'inline'` (`ThreadFeedRow`, the Slack shape) — or by `renderRow`, which
 * takes priority over `variant` entirely when supplied. The built-in `'inline'` row sends through
 * `onSend` when supplied; omit it and the row's composer renders visibly disabled rather than
 * silently discarding input — see `onSend`'s own doc.
 *
 * @example
 * import { ThreadFeed } from 'basalt-ui'
 *
 * <ThreadFeed threads={threads} activeId={activeId} onSelect={select} />
 */
import { Box, ScrollArea, Stack } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { AnimatePresence, motion } from 'motion/react'
import type { JSX, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type { AgentThread } from '../agent'
import { BasaltStickToBottom } from '../agent'
import { cx } from '../common/props'
import type { BasaltProps } from '../common/props'
import { assertRequiredProps } from '../common/validate'
import { MOTION_SPRING } from '../common/motion'
import type { ComposerSubmit } from './composer'
import { ThreadFeedRow } from './thread-feed-row'
import { ThreadOutcomeCard } from './thread-outcome-card'

/** A submit handler for the built-in `'inline'` row when the consumer supplies no `onSend` — paired
 * with `composerProps={{ disabled: true }}` so it is unreachable, not silently reachable. See
 * `onSend`'s doc for why an inert composer beats a live one that eats input. */
function noopSend(): void {}

export type ThreadFeedProps = BasaltProps & {
  readonly threads: AgentThread[]
  /** The currently open thread id, or null when none is selected. */
  readonly activeId: string | null
  /** Called with a thread's id when its row is selected. Never called to report a collapse — see
   * `variant`'s doc for how the built-in `'inline'` row's expand/collapse is decoupled from this. */
  readonly onSelect: (id: string) => void
  /**
   * Row shape: `'outcome'` (default) renders today's `ThreadOutcomeCard` inbox row, unchanged.
   * `'inline'` renders `ThreadFeedRow`, the Slack-style inline-expanding row, wired to this feed's
   * own `activeId` for which row is open (so at most one row is open at a time, mirroring the
   * inbox's single-selection model) — with its OWN collapse tracking layered on top, not a raw
   * pass-through of `onSelect` as `onToggle`. `onSelect` is documented as a selection event, and
   * collapsing a row that remains the active thread isn't one; wiring `onToggle={onSelect}`
   * directly (the previous shape) meant a plain `onSelect={setActiveId}` consumer could never
   * collapse a row, since re-selecting the same id is a no-op state update. Collapsing here is
   * local, UI-only state, reset whenever `activeId` changes to point at a DIFFERENT thread. Since
   * this reset is a `useEffect` keyed on `activeId`, re-driving it to the SAME id from outside
   * this component is a no-op React dep comparison, so it does not clear the override.
   */
  readonly variant?: 'outcome' | 'inline'
  /**
   * Wires the built-in `'inline'` row's composer to a real send channel — called with the thread
   * and the composer's submit payload. Omit it and the row's composer renders disabled (visibly
   * inert) instead of a live control that silently discards whatever is typed into it; a consumer
   * that needs the composer live must supply this (or `renderRow`, for full control over the row).
   */
  readonly onSend?: (thread: AgentThread, payload: ComposerSubmit) => void
  /** Overrides row rendering entirely, for BOTH variants — when supplied, this is called for every
   * thread instead of either built-in row. Gives full control over live-run wiring
   * (`onStop`/`liveParts`/`liveStatus`) the built-in `'inline'` row doesn't expose; see `variant`
   * and `onSend`. */
  readonly renderRow?: (thread: AgentThread) => ReactNode
  /**
   * Scroll anchor. `'start'` (default) is today's top-anchored `ScrollArea` feed, unchanged.
   * `'end'` anchors the feed's growth to the BOTTOM instead — a `BasaltStickToBottom` scroll node
   * (auto-follows the live turn, same container `ThreadDetailPanel` uses) rather than `ScrollArea`,
   * with the row stack `justify`-ed to the end and grown to the full height so a short feed still
   * sits at the bottom rather than floating at the top. This is what a bottom-anchored chat feed
   * (argo's hermes-chat S15 — oldest→newest top→bottom, pinned last, `renderRow`-driven) needs
   * instead of hand-rolling its own scroll shell around `renderRow`.
   */
  readonly anchor?: 'start' | 'end'
}

function defaultRow(
  thread: AgentThread,
  variant: 'outcome' | 'inline',
  activeId: string | null,
  collapsedId: string | null,
  onToggle: (id: string) => void,
  onSelect: (id: string) => void,
  onSend: ((thread: AgentThread, payload: ComposerSubmit) => void) | undefined,
): ReactNode {
  if (variant === 'inline') {
    const expanded = thread.id === activeId && thread.id !== collapsedId
    return (
      <ThreadFeedRow
        thread={thread}
        expanded={expanded}
        onToggle={onToggle}
        onSend={onSend !== undefined ? (payload) => onSend(thread, payload) : noopSend}
        {...(onSend === undefined ? { composerProps: { disabled: true } } : {})}
      />
    )
  }
  return (
    <ThreadOutcomeCard
      thread={thread}
      selected={thread.id === activeId}
      onSelect={() => onSelect(thread.id)}
    />
  )
}

/**
 * A scrollable feed of thread rows, animated on add/remove/reorder. Row content comes from
 * `renderRow` when supplied, else from the built-in `variant` row (`ThreadOutcomeCard` or
 * `ThreadFeedRow`) — see `ThreadFeedProps` for the full contract.
 *
 * @example
 * <ThreadFeed threads={threads} activeId={activeId} onSelect={(id) => select(id)} />
 */
export function ThreadFeed({
  threads,
  activeId,
  onSelect,
  variant = 'outcome',
  onSend,
  renderRow,
  anchor = 'start',
  className,
  style,
}: ThreadFeedProps): JSX.Element {
  assertRequiredProps('ThreadFeed', { threads }, ['threads'])
  const reduceMotion = useReducedMotion()

  // The inline row's own manual-collapse override — see `ThreadFeedProps.variant`'s doc. Only ever
  // meaningful for the id it names; a stale value left over for a since-deselected thread is inert
  // (the per-row `expanded` check below always requires `thread.id === activeId` too).
  const [collapsedId, setCollapsedId] = useState<string | null>(null)
  // Any externally-driven move of `activeId` to a DIFFERENT thread clears a stale override. React
  // bails on a same-value dep, so re-driving `activeId` to the id it already holds (e.g. the SAME
  // thread re-selected after being manually collapsed) does NOT re-run this effect. A collapse
  // triggered by this component's own header click does NOT touch `activeId` at all (see
  // `handleInlineToggle`), so it does not re-trigger this effect either.
  useEffect(() => {
    setCollapsedId(null)
  }, [activeId])

  function handleInlineToggle(id: string): void {
    const isOpen = id === activeId && id !== collapsedId
    if (isOpen) {
      // Collapsing the already-selected row is a visual-only action. `onSelect` is documented as a
      // SELECTION event; a row that remains the active thread while visually collapsed hasn't had
      // its selection change, so this does not call it.
      setCollapsedId(id)
      return
    }
    setCollapsedId(null)
    onSelect(id)
  }

  const rowFor = (thread: AgentThread): ReactNode =>
    renderRow !== undefined
      ? renderRow(thread)
      : defaultRow(thread, variant, activeId, collapsedId, handleInlineToggle, onSelect, onSend)

  // B5: `anchor="end"` grows the stack to the full scroll height and pins its content to the
  // bottom, so a feed with only a couple of threads still sits flush against the composer instead
  // of floating at the top of an otherwise-empty ScrollArea.
  const stackAnchorProps = anchor === 'end' ? { justify: 'flex-end' as const, mih: '100%' } : {}

  const list = reduceMotion ? (
    <Stack gap="sm" p="sm" {...stackAnchorProps}>
      {threads.map((thread) => (
        <Box key={thread.id}>{rowFor(thread)}</Box>
      ))}
    </Stack>
  ) : (
    <Stack gap="sm" p="sm" {...stackAnchorProps}>
      <AnimatePresence mode="popLayout" initial={false}>
        {threads.map((thread) => (
          <motion.div
            key={thread.id}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={MOTION_SPRING}
          >
            {rowFor(thread)}
          </motion.div>
        ))}
      </AnimatePresence>
    </Stack>
  )

  // `anchor="end"`: a `BasaltStickToBottom` scroll node instead of `ScrollArea` — it owns an
  // initial scroll-to-end on mount and auto-follows appended content (the live turn), which a
  // plain `ScrollArea` has no notion of.
  if (anchor === 'end') {
    return (
      <BasaltStickToBottom className={cx(className)} style={{ height: '100%', ...style }}>
        {list}
      </BasaltStickToBottom>
    )
  }

  return (
    <ScrollArea className={cx(className)} style={{ height: '100%', ...style }}>
      {list}
    </ScrollArea>
  )
}
