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
 * @example
 * import { NotificationCenter } from 'basalt-ui/notifications'
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
import { VX } from '../tokens'
import { resolveAction } from './define-notifications'
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

// ── Intent → Mantine color (drives the action Button's own `light`-variant tint) ──────────────

const INTENT_COLOR: Record<NotificationIntent, string> = {
  success: 'green',
  error: 'red',
  warning: 'yellow',
  info: 'blue',
}

// ── Intent → status token (docs/DESIGN-SPEC.md §5: "severity accents via status tokens") — the
// exact spec success/warning/danger hex, used for the item's left-border accent. `info` has no
// status tone, so it reads the neutral accent instead.
const INTENT_STATUS: Record<NotificationIntent, string> = {
  success: VX.status.good,
  error: VX.status.bad,
  warning: VX.status.warn,
  info: VX.accent,
}

type CenterView = 'inbox' | 'all'

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
  const color = INTENT_COLOR[item.intent]
  const statusAccent = INTENT_STATUS[item.intent]
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
        borderInlineStart: `3px solid ${statusAccent}`,
        borderRadius: 'var(--mantine-radius-sm)',
        background: isUnread ? 'var(--mantine-color-default-hover)' : 'transparent',
        opacity: isDismissed ? 0.55 : 1,
      }}
    >
      <Group gap="xs" align="flex-start" wrap="nowrap">
        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
          {item.title !== undefined && (
            <Text size="sm" fw={isUnread ? 600 : 500} lh={1.2} truncate="end">
              {item.title}
            </Text>
          )}
          <Text
            size="sm"
            lh={1.3}
            {...(item.title !== undefined && { c: 'dimmed' })}
            style={{ wordBreak: 'break-word' }}
          >
            {item.message}
          </Text>
          <Group gap="xs" align="center" mt={2} wrap="nowrap">
            <Text ff="monospace" c="var(--vx-faint)" style={{ fontSize: VX.text.micro }}>
              {relativeTime(item.createdAt)}
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

export type NotificationCenterProps = {
  /** Maximum height of the scrollable list. Default: 320px. */
  maxHeight?: number | string
}

/**
 * Two-view notification center (Inbox / All) with per-item read, dismiss, and remove, plus
 * registry-resolved action buttons. Designed to be mounted inside a Popover or Drawer (e.g.
 * NotificationBell).
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
  const { items, inbox, unreadCount, markRead, markAllRead, dismiss, dismissAll, remove, clear } =
    useNotificationHistory()
  const [view, setView] = useState<CenterView>('inbox')

  const list = view === 'inbox' ? inbox : items
  const emptyLabel = view === 'inbox' ? "You're all caught up" : 'No notifications yet'

  return (
    <Stack gap="xs" style={{ width: 320 }}>
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
