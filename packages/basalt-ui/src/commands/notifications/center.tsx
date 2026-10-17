/**
 * NotificationCenter — a two-view notification surface, not a flat toast log.
 *
 *  - **Inbox** (default): items that need attention (errors, warnings, anything with an action) and
 *    are not yet dismissed. This is the working set — the things you still have to deal with.
 *  - **All**: the full persisted history, newest first.
 *
 * Each item can be marked read (on interaction), dismissed (leaves the Inbox, stays in history), or
 * removed outright. Actionable items render a button resolved from the notifications registry, so a
 * notification can navigate or open a modal even after a reload. Consumes useNotificationHistory.
 *
 * Internal: `NotificationBell` mounts it; `basalt-ui/commands` does not export it.
 *
 * @example
 * import { NotificationCenter } from './center'
 * <NotificationCenter />
 */
import { useState } from 'react'
import type { MouseEvent } from 'react'
import {
  Box,
  Button,
  CloseButton,
  Group,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core'
import type { BasaltProps } from '../../common/props'
import { cx } from '../../common/props'
import { relativeTime } from '../../format'
import { StatusVerdict } from '../../theme/status-verdict'
import { VX } from '../../tokens'
import { resolveAction } from './define-notifications'
import { useNotificationHistory } from './store'
import type { NotificationHistoryItem, NotificationIntent } from './store'

// ── Intent → the action Button's Mantine tint, the status dot colour and the visible word beside
// it (docs/DESIGN-SPEC.md §5: severity via status tokens). `info` has no status tone, so its dot is
// the neutral muted ink, not the accent.
const INTENT_META: Record<NotificationIntent, { color: string; dot: string; word: string }> = {
  success: { color: 'green', dot: VX.status.good, word: 'Success' },
  error: { color: 'red', dot: VX.status.bad, word: 'Error' },
  warning: { color: 'yellow', dot: VX.status.warn, word: 'Warning' },
  info: { color: 'blue', dot: VX.muted, word: 'Info' },
}

type CenterView = 'inbox' | 'all'

/** The popover width `NotificationBell` fixes at the `Popover` level (see `NotificationCenter`'s
 *  own doc for why WIDTH lives there and not on this component). Shared so the two call sites and
 *  this doc's example never drift apart. */
export const NOTIFICATION_POPOVER_WIDTH = 320

// ── NotificationItem ──────────────────────────────────────────────────────────

function NotificationItem({
  item,
  view,
  onMarkRead,
  onDismiss,
  onRemove,
}: {
  item: NotificationHistoryItem
  view: CenterView
  onMarkRead: (id: string) => void
  onDismiss: (id: string) => void
  onRemove: (id: string) => void
}) {
  const isUnread = item.readAt === undefined
  const isDismissed = item.dismissedAt !== undefined
  const { color, dot, word } = INTENT_META[item.intent]
  const resolved = item.action !== undefined ? resolveAction(item.action) : undefined

  function handleAction(e: MouseEvent): void {
    e.stopPropagation()
    onMarkRead(item.id)
    resolved?.run()
  }

  // In the Inbox, the close button archives (dismiss); in the full history it deletes (remove).
  function handleClose(): void {
    if (view === 'inbox') onDismiss(item.id)
    else onRemove(item.id)
  }

  return (
    <Box
      px="xs"
      py={6}
      onClick={isUnread ? () => onMarkRead(item.id) : undefined}
      style={{
        cursor: isUnread ? 'pointer' : 'default',
        borderRadius: 'var(--mantine-radius-sm)',
        background: isUnread ? 'var(--mantine-color-default-hover)' : 'transparent',
        opacity: isDismissed ? 0.55 : 1,
      }}
    >
      <Group gap="xs" align="flex-start" wrap="nowrap">
        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
          {item.title !== undefined ? (
            <>
              <Group gap="xs" align="center" wrap="nowrap">
                <StatusVerdict color={dot} word={word} />
                <Text size="sm" fw={isUnread ? 600 : 500} lh={1.2} miw={0} truncate="end">
                  {item.title}
                </Text>
              </Group>
              <Text size="sm" lh={1.3} c="dimmed" style={{ wordBreak: 'break-word' }}>
                {item.message}
              </Text>
            </>
          ) : (
            <Group gap="xs" align="flex-start" wrap="nowrap">
              <StatusVerdict color={dot} word={word} />
              <Text size="sm" lh={1.3} miw={0} style={{ wordBreak: 'break-word' }}>
                {item.message}
              </Text>
            </Group>
          )}
          <Group gap="xs" align="center" mt={2} wrap="nowrap">
            <Text ff="monospace" c="var(--vx-faint)" style={{ fontSize: VX.text.micro }}>
              {relativeTime(item.createdAt, { style: 'short' })}
            </Text>
            {resolved !== undefined && (
              <Button variant="light" color={color} size="compact-xs" onClick={handleAction}>
                {resolved.label}
              </Button>
            )}
          </Group>
        </Stack>
        <CloseButton
          size="sm"
          onClick={handleClose}
          aria-label={view === 'inbox' ? 'Dismiss notification' : 'Delete notification'}
          title={view === 'inbox' ? 'Dismiss' : 'Delete'}
          style={{ flexShrink: 0 }}
        />
      </Group>
    </Box>
  )
}

// ── NotificationCenter ────────────────────────────────────────────────────────

export type NotificationCenterProps = BasaltProps & {
  /** Maximum height of the scrollable list. Default: 320px. */
  maxHeight?: number | string
}

/**
 * Two-view notification center (Inbox / All) with per-item read, dismiss, and remove, plus
 * registry-resolved action buttons. Designed to be mounted inside a Popover or Drawer (e.g.
 * NotificationBell).
 *
 * Sizes to its host's full width (`width: 100%`) rather than a fixed px — a popover default that
 * overflowed any inline mount. `NotificationBell` fixes the WIDTH at the Popover level instead
 * (`<Popover width={NOTIFICATION_POPOVER_WIDTH}>`), which is the correct home for a
 * popover-specific dimension; a consumer mounting this directly controls the same thing through
 * its own container.
 *
 * @example
 * import { NOTIFICATION_POPOVER_WIDTH, NotificationCenter } from './center'
 *
 * <Popover width={NOTIFICATION_POPOVER_WIDTH}>
 *   <Popover.Dropdown>
 *     <NotificationCenter />
 *   </Popover.Dropdown>
 * </Popover>
 */
export function NotificationCenter({ maxHeight = 320, className, style }: NotificationCenterProps) {
  const { items, inbox, unreadCount, markRead, markAllRead, dismiss, dismissAll, remove, clear } =
    useNotificationHistory()
  const [view, setView] = useState<CenterView>('inbox')

  const list = view === 'inbox' ? inbox : items
  const emptyLabel = view === 'inbox' ? "You're all caught up" : 'No notifications yet'

  return (
    <Stack className={cx(className)} gap="xs" style={{ width: '100%', ...style }}>
      {/* Header: title + a single mark-all-read affordance (only when there's something unread) */}
      <Group justify="space-between" align="center" wrap="nowrap">
        <Text size="sm" fw={600}>
          Notifications
        </Text>
        {unreadCount > 0 && (
          <Button variant="subtle" size="compact-xs" onClick={markAllRead}>
            Mark all read
          </Button>
        )}
      </Group>

      {/* View switch */}
      {/* theme-allow control-outside-home — the center's own inbox/all view, rendered inside
          `NotificationBell`'s Popover (an overlay, a declared non-home the AST cannot see across
          the component boundary). */}
      <SegmentedControl
        fullWidth
        size="xs"
        value={view}
        onChange={(value) => setView(value as CenterView)}
        data={[
          { value: 'inbox', label: inbox.length > 0 ? `Inbox (${inbox.length})` : 'Inbox' },
          { value: 'all', label: 'All' },
        ]}
      />

      {/* List */}
      {list.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="lg">
          {emptyLabel}
        </Text>
      ) : (
        <ScrollArea.Autosize mah={maxHeight} type="hover">
          <Stack gap={4} pr="xs">
            {list.map((item) => (
              <NotificationItem
                key={item.id}
                item={item}
                view={view}
                onMarkRead={markRead}
                onDismiss={dismiss}
                onRemove={remove}
              />
            ))}
          </Stack>
        </ScrollArea.Autosize>
      )}

      {/* Footer: bulk action scoped to the active view */}
      {view === 'inbox' && inbox.length > 0 && (
        <Group justify="flex-end">
          <Button variant="subtle" size="compact-xs" color="gray" onClick={dismissAll}>
            Dismiss all
          </Button>
        </Group>
      )}
      {view === 'all' && items.length > 0 && (
        <Group justify="flex-end">
          <Button variant="subtle" size="compact-xs" color="gray" onClick={clear}>
            Clear all
          </Button>
        </Group>
      )}
    </Stack>
  )
}
