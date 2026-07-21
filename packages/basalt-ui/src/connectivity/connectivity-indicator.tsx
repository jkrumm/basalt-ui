/**
 * ConnectivityIndicator — header ActionIcon + Popover showing per-signal connection detail.
 *
 * Designed for the shell's `globalActions` slot. Shows a wifi icon whose color reflects overall
 * status (faint=online, status-warn=degraded, status-danger=offline — `docs/DESIGN-SPEC.md` §5's
 * status tokens, not the Mantine teal/yellow/red ramps). Click opens a Popover with per-signal rows.
 *
 * @example
 * import { ConnectivityIndicator } from 'basalt-ui'
 *
 * <BasaltShell globalActions={<ConnectivityIndicator />} {...rest} />
 */
import { ActionIcon, Badge, Divider, Group, Popover, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useRef } from 'react'
import { alpha, VX } from '../tokens'
import { useConnectivity } from './use-connectivity'
import type { ConnectivityStatus } from './types'

const HOVER_OPEN_DELAY = 150
const HOVER_CLOSE_DELAY = 200

// ── Inline icons (14px, same stroke pattern as NotificationBell) ──────────────────────────────────────

function GlobeIcon() {
  return (
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
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function LightningIcon() {
  return (
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
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )
}

function AntennaIcon() {
  return (
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
      <path d="M5 17l3-5 3 5" />
      <path d="M11 13l3-5 3 5" />
      <path d="M17 9l3-5 3 5" />
      <path d="M3 21h18" />
    </svg>
  )
}

function HeartIcon() {
  return (
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
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

// ── Wifi icon for the ActionIcon button (18px) ────────────────────────────────────────────────────────

function WifiIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 18h.01" />
      <path d="M9.172 15.172a4 4 0 0 1 5.656 0" />
      <path d="M6.343 12.343a8 8 0 0 1 11.314 0" />
      <path d="M3.515 9.515c4.686 -4.687 12.284 -4.687 16.97 0" />
    </svg>
  )
}

// ── Per-signal row ────────────────────────────────────────────────────────────────────────────────────

function SignalRow({
  label,
  value,
  icon,
}: {
  label: string
  value: boolean | null
  icon: React.ReactNode
}) {
  const color = value === true ? VX.status.good : value === false ? VX.status.bad : 'dimmed'
  const text = value === true ? 'Connected' : value === false ? 'Disconnected' : 'Not configured'
  return (
    <Group justify="space-between">
      <Group gap="xs">
        {icon}
        <Text size="sm">{label}</Text>
      </Group>
      <Text size="sm" c={color}>
        {text}
      </Text>
    </Group>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────────────────────────────

// Status dot/badge colors read the exact spec status tokens (docs/DESIGN-SPEC.md §5: "connectivity
// indicator: status dot colors from status tokens"), not the Mantine teal/yellow/red theme ramps —
// those are a different hue family than STATUS.good/warn/bad.
const STATUS_CONFIG: Record<ConnectivityStatus, { token: string; label: string }> = {
  online: { token: VX.status.good, label: 'Connected' },
  degraded: { token: VX.status.warn, label: 'Degraded' },
  offline: { token: VX.status.bad, label: 'Offline' },
}

/** Icon color is neutral when online — only degrades when something is wrong. */
const ICON_COLOR: Record<ConnectivityStatus, string> = {
  online: VX.faint,
  degraded: VX.status.warn,
  offline: VX.status.bad,
}

// ── Component ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * ConnectivityIndicator — clickable wifi icon that opens a per-signal detail popover.
 *
 * @example
 * <BasaltShell globalActions={<ConnectivityIndicator />} {...rest} />
 */
export function ConnectivityIndicator() {
  const [opened, { open, toggle, close }] = useDisclosure(false)
  const { status, details } = useConnectivity()
  const statusCfg = STATUS_CONFIG[status]
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
        <ActionIcon
          variant="transparent"
          color={ICON_COLOR[status]}
          size="md"
          onClick={toggle}
          onMouseEnter={scheduleOpen}
          onMouseLeave={scheduleClose}
          aria-label={statusCfg.label}
          aria-expanded={opened}
          aria-haspopup="dialog"
        >
          <WifiIcon />
        </ActionIcon>
      </Popover.Target>

      <Popover.Dropdown
        p="md"
        aria-label="Connectivity details"
        w={260}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
      >
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" fw={600}>
              Status
            </Text>
            <Badge
              size="sm"
              styles={{
                root: {
                  backgroundColor: alpha(statusCfg.token, 0.13),
                  color: statusCfg.token,
                  fontFamily: 'var(--basalt-font-mono)',
                  fontWeight: 600,
                  fontSize: VX.text.xs,
                  borderRadius: 'var(--vx-radius-ctrl)',
                },
              }}
            >
              {statusCfg.label}
            </Badge>
          </Group>

          <Divider />

          <SignalRow label="Browser" value={details.browserOnline} icon={<GlobeIcon />} />
          <SignalRow label="React Query" value={details.queryOnline} icon={<LightningIcon />} />
          <SignalRow label="SSE" value={details.sseOpen} icon={<AntennaIcon />} />
          <SignalRow label="Health Check" value={details.healthPassing} icon={<HeartIcon />} />
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
