/**
 * ThreadOutcomeCard — one inbox-row projection of an `AgentThread` for a multi-thread feed.
 *
 * Never renders the raw transcript or the live streaming text — only the distilled `AgentOutcome`
 * (title + summary), a relative timestamp, and a status badge. While a thread has no outcome yet
 * and is still `pending`/`streaming`, it renders a skeleton preview instead of any prompt/partial
 * text, so a feed never leaks in-progress content.
 *
 * Presentational only — the enclosing `ThreadFeed` owns the enter/exit + reorder animation, so
 * this row stays a plain button with no motion wrapper of its own.
 *
 * @example
 * import { ThreadOutcomeCard } from 'basalt-ui/agent-chat'
 *
 * <ThreadOutcomeCard
 *   thread={thread}
 *   selected={thread.id === activeId}
 *   onSelect={() => select(thread.id)}
 * />
 */
import { Badge, Group, Skeleton, Stack, Text, UnstyledButton } from '@mantine/core'
import { useHover } from '@mantine/hooks'
import type { JSX } from 'react'
import type { AgentThread, ThreadStatus } from '../agent'

// ── Status badge — shown ONLY for states that need a glance (attention/error). ────
// done/pending/streaming stay badge-free: a settled feed shouldn't be a wall of green chips —
// read/unread title weight + the timestamp already carry the rest.

const STATUS_BADGE: Partial<
  Record<ThreadStatus, { readonly label: string; readonly color: string }>
> = {
  attention: { label: 'Needs review', color: 'yellow' },
  error: { label: 'Failed', color: 'red' },
}

// ── Dependency-free relative-time helper (no date-fns) ────────────────────────

const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const RELATIVE_TIME_UNITS: readonly {
  readonly unit: Intl.RelativeTimeFormatUnit
  readonly ms: number
}[] = [
  { unit: 'year', ms: 31_536_000_000 },
  { unit: 'month', ms: 2_628_000_000 },
  { unit: 'week', ms: 604_800_000 },
  { unit: 'day', ms: 86_400_000 },
  { unit: 'hour', ms: 3_600_000 },
  { unit: 'minute', ms: 60_000 },
]

/** Formats an epoch-ms timestamp as a short relative string ("3 hours ago", "just now"). */
function formatRelativeTime(timestamp: number): string {
  const diffMs = timestamp - Date.now()
  const absMs = Math.abs(diffMs)
  if (absMs < 60_000) return 'just now'
  const unit = RELATIVE_TIME_UNITS.find(({ ms }) => absMs >= ms) ?? RELATIVE_TIME_UNITS.at(-1)!
  return RELATIVE_TIME_FORMAT.format(Math.round(diffMs / unit.ms), unit.unit)
}

// ── Row bodies ─────────────────────────────────────────────────────────────────

/** Preview skeleton shown while a thread has no resolved outcome yet (never raw prompt/live text). */
function OutcomeSkeleton(): JSX.Element {
  return (
    <Stack gap={6}>
      <Skeleton height={14} width="60%" radius="sm" />
      <Skeleton height={11} width="90%" radius="sm" />
    </Stack>
  )
}

/** The thread's opening user prompt — the fallback title for a thread with no resolved outcome. */
function promptOf(thread: AgentThread): string | undefined {
  const firstUser = thread.messages.find((message) => message.role === 'user')
  if (firstUser === undefined) return undefined
  const text = firstUser.parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')
    .trim()
  return text.length > 0 ? text : undefined
}

function OutcomeBody({ thread }: { thread: AgentThread }): JSX.Element {
  const badge = STATUS_BADGE[thread.status]
  const title = thread.outcome?.title ?? promptOf(thread) ?? 'Untitled'
  const summary =
    thread.outcome?.summary ?? (thread.status === 'error' ? 'This run didn’t finish.' : '')
  return (
    <Stack gap={2}>
      <Group justify="space-between" gap="xs" wrap="nowrap" align="flex-start">
        <Text size="sm" fw={thread.read ? 400 : 700} lineClamp={1} style={{ flex: 1 }}>
          {title}
        </Text>
        {badge !== undefined && (
          <Badge size="xs" color={badge.color} variant="light">
            {badge.label}
          </Badge>
        )}
      </Group>
      <Text size="xs" c="dimmed" lineClamp={1}>
        {summary}
      </Text>
      <Text size="10px" c="dimmed">
        {formatRelativeTime(thread.updatedAt)}
      </Text>
    </Stack>
  )
}

// ── ThreadOutcomeCard ─────────────────────────────────────────────────────────

export type ThreadOutcomeCardProps = {
  readonly thread: AgentThread
  /** Whether this row is the active/open thread — applies a subtle highlight. */
  readonly selected: boolean
  /** Called when the row is clicked/activated. */
  readonly onSelect: () => void
}

/**
 * One inbox row: title + summary + relative timestamp + status badge, or a skeleton preview
 * while the outcome hasn't resolved. Shared-element `layoutId` (thread.id) drives the FLIP into
 * `ThreadDetailPanel`'s header when reduced motion is not requested.
 *
 * @example
 * <ThreadOutcomeCard thread={thread} selected={false} onSelect={() => select(thread.id)} />
 */
export function ThreadOutcomeCard({
  thread,
  selected,
  onSelect,
}: ThreadOutcomeCardProps): JSX.Element {
  const { hovered, ref } = useHover<HTMLButtonElement>()
  const isPreviewing =
    thread.outcome === null && (thread.status === 'pending' || thread.status === 'streaming')

  const background = selected
    ? 'var(--mantine-color-default-hover)'
    : hovered
      ? 'var(--mantine-color-default-light)'
      : 'transparent'

  return (
    <UnstyledButton
      ref={ref}
      onClick={onSelect}
      p="sm"
      w="100%"
      style={{ display: 'block', borderRadius: 'var(--mantine-radius-md)', background }}
    >
      {isPreviewing ? <OutcomeSkeleton /> : <OutcomeBody thread={thread} />}
    </UnstyledButton>
  )
}
