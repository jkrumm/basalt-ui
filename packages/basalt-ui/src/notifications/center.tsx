/**
 * NotificationCenter — lists history items with title, message, relative time, unread dot,
 * "Mark all read" and "Clear" actions. Consumes useNotificationHistory.
 *
 * @example
 * import { NotificationCenter } from 'basalt-ui/notifications'
 * <NotificationCenter />
 */
import { ActionIcon, Badge, Button, Group, ScrollArea, Stack, Text } from '@mantine/core'
import { useNotificationHistory } from './store'
import type { NotificationHistoryItem, NotificationIntent } from './store'

// ── Relative time ─────────────────────────────────────────────────────────────

function relativeTime(createdAt: number): string {
  const seconds = Math.floor((Date.now() - createdAt) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ── Intent dot color ──────────────────────────────────────────────────────────

const INTENT_DOT: Record<NotificationIntent, string> = {
  success: 'green',
  error: 'red',
  warning: 'yellow',
  info: 'blue',
}

// ── NotificationItem ──────────────────────────────────────────────────────────

function NotificationItem({
  item,
  onMarkRead,
}: {
  item: NotificationHistoryItem
  onMarkRead: (id: string) => void
}) {
  const isUnread = item.readAt === undefined

  return (
    <Group
      gap="xs"
      align="flex-start"
      wrap="nowrap"
      style={{ cursor: isUnread ? 'pointer' : 'default' }}
      onClick={isUnread ? () => onMarkRead(item.id) : undefined}
    >
      {/* Unread indicator */}
      <Badge
        size="xs"
        circle
        color={INTENT_DOT[item.intent]}
        variant={isUnread ? 'filled' : 'outline'}
        style={{ flexShrink: 0, marginTop: 4 }}
        aria-label={isUnread ? 'Unread' : undefined}
      />

      <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
        {item.title !== undefined && (
          <Text size="sm" fw={isUnread ? 600 : 400} truncate="end">
            {item.title}
          </Text>
        )}
        <Text size="sm" {...(item.title !== undefined && { c: 'dimmed' })} truncate="end">
          {item.message}
        </Text>
        <Text size="xs" c="dimmed">
          {relativeTime(item.createdAt)}
        </Text>
      </Stack>
    </Group>
  )
}

// ── NotificationCenter ────────────────────────────────────────────────────────

export type NotificationCenterProps = {
  /** Maximum height of the scrollable list. Default: 320px. */
  maxHeight?: number | string
}

/**
 * Notification history list with mark-all-read and clear actions.
 * Designed to be mounted inside a Popover or Drawer (e.g. NotificationBell).
 *
 * @example
 * import { NotificationCenter } from 'basalt-ui/notifications'
 *
 * <Popover>
 *   <Popover.Dropdown>
 *     <NotificationCenter />
 *   </Popover.Dropdown>
 * </Popover>
 */
export function NotificationCenter({ maxHeight = 320 }: NotificationCenterProps) {
  const { items, unreadCount, markRead, markAllRead, clear } = useNotificationHistory()

  return (
    <Stack gap="xs" style={{ width: 300 }}>
      {/* Header row */}
      <Group justify="space-between" align="center">
        <Text size="sm" fw={600}>
          Notifications
          {unreadCount > 0 && (
            <Text span c="blue" ml={4}>
              ({unreadCount})
            </Text>
          )}
        </Text>
        <Group gap={4}>
          {unreadCount > 0 && (
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={markAllRead}
              aria-label="Mark all read"
              title="Mark all read"
            >
              {/* Double-check icon (simple SVG, no @tabler/icons dep) */}
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M2 12l5 5L17 7" />
                <path d="M9 12l5 5 5-8" />
              </svg>
            </ActionIcon>
          )}
          {items.length > 0 && (
            <ActionIcon
              variant="subtle"
              size="sm"
              color="gray"
              onClick={clear}
              aria-label="Clear all notifications"
              title="Clear all"
            >
              {/* X icon */}
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </ActionIcon>
          )}
        </Group>
      </Group>

      {/* Item list */}
      {items.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No notifications
        </Text>
      ) : (
        <ScrollArea style={{ maxHeight }}>
          <Stack gap="sm" py={4}>
            {items.map((item) => (
              <NotificationItem key={item.id} item={item} onMarkRead={markRead} />
            ))}
          </Stack>
        </ScrollArea>
      )}

      {/* Footer actions */}
      {items.length > 0 && (
        <Group justify="flex-end" gap={4}>
          {unreadCount > 0 && (
            <Button variant="subtle" size="compact-xs" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
          <Button variant="subtle" size="compact-xs" color="gray" onClick={clear}>
            Clear all
          </Button>
        </Group>
      )}
    </Stack>
  )
}
