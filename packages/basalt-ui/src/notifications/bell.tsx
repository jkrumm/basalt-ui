/**
 * NotificationBell — ActionIcon + Indicator showing the unread Inbox count, opens a
 * NotificationCenter in a Popover. Designed for the shell `globalActions` slot (ReactNode).
 *
 * The badge counts unread Inbox items (errors / warnings / actionable notifications you haven't
 * seen) — not every toast that fired. Opening the bell does NOT mark anything read; items are
 * marked read when interacted with inside the center.
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
import { ActionIcon, Indicator, Popover } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useRef } from 'react'
import { useNotificationHistory } from './store'
import { NotificationCenter } from './center'

const HOVER_OPEN_DELAY = 150
const HOVER_CLOSE_DELAY = 200

export type NotificationBellProps = {
  /** Tooltip label. Default: 'Notifications'. */
  label?: string
}

/**
 * Bell icon button with an unread-Inbox indicator. Opens a NotificationCenter popover.
 *
 * @example
 * <BasaltShell globalActions={<NotificationBell />} {...rest} />
 */
export function NotificationBell({ label = 'Notifications' }: NotificationBellProps) {
  const [opened, { open, toggle, close }] = useDisclosure(false)
  const { unreadCount } = useNotificationHistory()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const scheduleOpen = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => open(), HOVER_OPEN_DELAY)
  }
  const scheduleClose = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => close(), HOVER_CLOSE_DELAY)
  }

  return (
    <Popover opened={opened} onClose={close} position="bottom-end" withArrow withinPortal>
      <Popover.Target>
        <Indicator
          color="color-mix(in srgb, var(--vx-ink) 8%, transparent)"
          size={16}
          label={unreadCount > 9 ? '9+' : String(unreadCount)}
          disabled={unreadCount === 0}
          processing={false}
          styles={{
            indicator: {
              color: 'var(--vx-ink)',
              fontFamily: 'var(--basalt-font-mono)',
              fontWeight: 500,
            },
          }}
        >
          <ActionIcon
            variant="transparent"
            color="gray"
            onClick={toggle}
            onMouseEnter={scheduleOpen}
            onMouseLeave={scheduleClose}
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
              stroke="var(--mantine-color-dimmed)"
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
      </Popover.Target>

      <Popover.Dropdown
        p="md"
        aria-label="Notification center"
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
      >
        <NotificationCenter />
      </Popover.Dropdown>
    </Popover>
  )
}
