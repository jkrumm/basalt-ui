/**
 * NotificationsDemoPage — exercises basalt-ui/notifications:
 * notifySuccess, notifyError, notifyWarning, notifyInfo, notifyPromise,
 * NotificationBell, NotificationCenter, BasaltNotifications.
 *
 * BasaltNotifications is mounted in main.tsx — this page only drives the notify helpers.
 */
import { Badge, Button, Divider, Group, Paper, Stack, Text, Title } from '@mantine/core'
import {
  notifyError,
  notifyInfo,
  notifySuccess,
  notifyWarning,
  notifyPromise,
  useNotificationHistory,
  NotificationCenter,
} from 'basalt-ui/notifications'

// ── Demo helpers ──────────────────────────────────────────────────────────────

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function fakeAsync(ms: number, fail = false): Promise<string> {
  await delay(ms)
  if (fail) throw new Error('Simulated error')
  return 'done'
}

// ── Demo buttons ──────────────────────────────────────────────────────────────

function ToastButtons() {
  return (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">
        Toast helpers
      </Text>
      <Group gap="xs" wrap="wrap">
        <Button
          size="compact-sm"
          color="green"
          onClick={() => notifySuccess('Changes saved successfully')}
        >
          notifySuccess
        </Button>
        <Button
          size="compact-sm"
          color="red"
          onClick={() => notifyError('Upload failed', { title: 'Storage error' })}
        >
          notifyError
        </Button>
        <Button
          size="compact-sm"
          color="yellow"
          onClick={() =>
            notifyWarning('Session expires in 5 minutes', { dedupKey: 'session-warn' })
          }
        >
          notifyWarning (dedup)
        </Button>
        <Button
          size="compact-sm"
          color="blue"
          onClick={() => notifyInfo('New version available — reload to update')}
        >
          notifyInfo
        </Button>
      </Group>
    </Stack>
  )
}

function PromiseButtons() {
  return (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">
        notifyPromise
      </Text>
      <Group gap="xs" wrap="wrap">
        <Button
          size="compact-sm"
          variant="default"
          onClick={() =>
            notifyPromise(fakeAsync(1500), {
              loading: 'Saving…',
              success: 'Save complete',
              error: 'Save failed',
            })
          }
        >
          Simulate success (1.5s)
        </Button>
        <Button
          size="compact-sm"
          variant="default"
          onClick={() =>
            notifyPromise(fakeAsync(1000, true), {
              loading: 'Uploading…',
              success: 'Upload complete',
              error: 'Upload failed — try again',
            }).catch(() => {
              // swallow demo rejection
            })
          }
        >
          Simulate error (1s)
        </Button>
      </Group>
    </Stack>
  )
}

// ── History panel ─────────────────────────────────────────────────────────────

function HistoryPanel() {
  const { unreadCount } = useNotificationHistory()

  return (
    <Stack gap="xs">
      <Group gap="xs" align="center">
        <Text size="xs" tt="uppercase" fw={600} c="dimmed">
          Notification center (inline)
        </Text>
        {unreadCount > 0 && (
          <Badge size="xs" color="red">
            {unreadCount} unread
          </Badge>
        )}
      </Group>
      <Paper p="sm" radius="sm" withBorder>
        <NotificationCenter maxHeight={260} />
      </Paper>
    </Stack>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function NotificationsDemoPage() {
  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>./notifications adapter</Title>
        <Text size="sm" c="dimmed" mt={4}>
          notify helpers + notifyPromise + persisted history store + NotificationBell +
          NotificationCenter
        </Text>
      </div>

      <Paper p="sm" radius="md" withBorder>
        <Stack gap="xs">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">
            Behaviour
          </Text>
          <Text size="sm">
            Toasts appear bottom-right (BasaltNotifications overlay). Every toast is recorded in the
            history store (persisted to localStorage). The NotificationBell in the top bar shows
            unread count — click it to open the center.
          </Text>
        </Stack>
      </Paper>

      <Paper p="sm" radius="md" withBorder>
        <Stack gap="md">
          <ToastButtons />
          <Divider />
          <PromiseButtons />
        </Stack>
      </Paper>

      <Paper p="sm" radius="md" withBorder>
        <HistoryPanel />
      </Paper>
    </Stack>
  )
}
