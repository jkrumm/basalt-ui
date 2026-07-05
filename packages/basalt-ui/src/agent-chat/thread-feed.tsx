/**
 * ThreadFeed — a scrollable, animated list of `ThreadOutcomeCard` rows for a multi-thread inbox.
 *
 * Wraps the list in `AnimatePresence` (`popLayout`) so removing/reordering threads reflows the
 * remaining rows smoothly; each row is a `motion.div` keyed by `thread.id` (never index — index
 * keys would corrupt the layout animation identity when threads are prepended/removed). Branches
 * on `useReducedMotion` for a plain, unanimated `Stack`.
 *
 * @example
 * import { ThreadFeed } from 'basalt-ui/agent-chat'
 *
 * <ThreadFeed threads={threads} activeId={activeId} onSelect={select} />
 */
import { ScrollArea, Stack } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { AnimatePresence, motion } from 'motion/react'
import type { JSX } from 'react'
import type { AgentThread } from '../agent'
import { MOTION_SPRING } from '../motion'
import { ThreadOutcomeCard } from './thread-outcome-card'

export type ThreadFeedProps = {
  readonly threads: AgentThread[]
  /** The currently open thread id, or null when none is selected. */
  readonly activeId: string | null
  /** Called with a thread's id when its row is selected. */
  readonly onSelect: (id: string) => void
}

/**
 * A scrollable feed of thread rows, animated on add/remove/reorder. Each row renders via
 * `ThreadOutcomeCard`; selection highlighting is derived from `activeId`.
 *
 * @example
 * <ThreadFeed threads={threads} activeId={activeId} onSelect={(id) => select(id)} />
 */
export function ThreadFeed({ threads, activeId, onSelect }: ThreadFeedProps): JSX.Element {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return (
      <ScrollArea style={{ height: '100%' }}>
        <Stack gap="xs" p="xs">
          {threads.map((thread) => (
            <ThreadOutcomeCard
              key={thread.id}
              thread={thread}
              selected={thread.id === activeId}
              onSelect={() => onSelect(thread.id)}
            />
          ))}
        </Stack>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <Stack gap="xs" p="xs">
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
              <ThreadOutcomeCard
                thread={thread}
                selected={thread.id === activeId}
                onSelect={() => onSelect(thread.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </Stack>
    </ScrollArea>
  )
}
