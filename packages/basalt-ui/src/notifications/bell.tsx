/**
 * NotificationBell — ActionIcon + Indicator showing unread count, opens a NotificationCenter
 * in a Popover. Designed for the shell `globalActions` slot (ReactNode).
 * Marks all items read when the center opens.
 *
 * @example
 * import { NotificationBell } from 'basalt-ui/notifications'
 *
 * // In the shell's globalActions prop:
 * <BasaltShell
 *   globalActions={<NotificationBell />}
 *   {...rest}
 * />
 */
import { ActionIcon, Indicator, Popover, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useNotificationHistory } from './store'
import { NotificationCenter } from './center'

export type NotificationBellProps = {
  /** Tooltip label. Default: 'Notifications'. */
  label?: string
}

/**
 * Bell icon button with unread count indicator. Opens a NotificationCenter popover.
 * Mark items read when the center opens (onOpen calls markAllRead).
 *
 * @example
 * <BasaltShell globalActions={<NotificationBell />} {...rest} />
 */
export function NotificationBell({ label = 'Notifications' }: NotificationBellProps) {
  const [opened, { open, close }] = useDisclosure(false)
  const { unreadCount, markAllRead } = useNotificationHistory()

  function handleOpen(): void {
    open()
    // Mark all read when the center opens
    markAllRead()
  }

  return (
    <Popover opened={opened} onClose={close} position="bottom-end" withArrow withinPortal>
      <Popover.Target>
        <Tooltip label={label} withArrow>
          <Indicator
            color="red"
            size={16}
            label={unreadCount > 9 ? '9+' : String(unreadCount)}
            disabled={unreadCount === 0}
            processing={false}
          >
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={opened ? close : handleOpen}
              aria-label={label}
              aria-expanded={opened}
              aria-haspopup="dialog"
            >
              {/* Bell icon (simple SVG — no @tabler/icons dep per house rules) */}
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </ActionIcon>
          </Indicator>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown p="md" aria-label="Notification center">
        <NotificationCenter />
      </Popover.Dropdown>
    </Popover>
  )
}
