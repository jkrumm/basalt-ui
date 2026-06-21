/**
 * NotificationsDemoPage — exercises basalt-ui/notifications:
 * notifySuccess, notifyError, notifyWarning, notifyInfo, notifyPromise,
 * NotificationBell, NotificationCenter, BasaltNotifications,
 * defineNotifications (typed registry) + emit() (typed dispatch).
 *
 * BasaltNotifications is mounted in main.tsx — this page only drives the notify helpers.
 *
 * TYPED REGISTRY PATTERN:
 *   In a real app, defineNotifications lives in notifications.ts + a BasaltRegister augment:
 *     declare module 'basalt-ui' { interface BasaltRegister { notifications: typeof DEMO_NOTIFS } }
 *   Then emit('demo:upload-success', { name: 'photo.jpg' }) is fully typed at the call site.
 *   This demo includes that augment, so the emit() calls below are fully typed — no casts.
 */
import { Badge, Button, Code, Divider, Group, Paper, Stack, Text, Title } from '@mantine/core'
import {
  add,
  defineNotifications,
  emit,
  markAllRead,
  markRead,
  notifyError,
  notifyInfo,
  notifyPromise,
  notifySuccess,
  notifyWarning,
  useNotificationHistory,
  NotificationCenter,
} from 'basalt-ui/notifications'

// ── Typed registry (module-scope, call once) ──────────────────────────────────
// In a real app this lives in notifications.ts alongside the BasaltRegister augment.
// The last call to defineNotifications wins as the active runtime registry.
const DEMO_NOTIFS = defineNotifications({
  'demo:upload-success': {
    intent: 'success',
    toMessage: (p: unknown) => `Uploaded ${(p as { name: string }).name}`,
  },
  'demo:save-error': {
    intent: 'error',
    toMessage: () => 'Failed to save — try again',
  },
  'demo:quota-warn': {
    intent: 'warning',
    toMessage: (p: unknown) => `Storage ${(p as { pct: number }).pct}% full`,
  },
})
// Augment BasaltRegister with the demo registry — the real typed path: emit()'s keys are now
// checked at the call site (a stale key is a tsc error), exactly as a consumer app would wire it.
declare module 'basalt-ui' {
  interface BasaltRegister {
    notifications: typeof DEMO_NOTIFS
  }
}

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

// ── Typed registry + emit() demo ─────────────────────────────────────────────

function TypedRegistrySection() {
  return (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">
        defineNotifications + emit() (typed registry)
      </Text>
      <Code block style={{ fontSize: 11 }}>{`// notifications.ts
const NOTIFS = defineNotifications({
  'demo:upload-success': { intent: 'success', toMessage: (p) => \`Uploaded \${p.name}\` },
  'demo:save-error':     { intent: 'error',   toMessage: () => 'Failed to save' },
})
declare module 'basalt-ui' { interface BasaltRegister { notifications: typeof NOTIFS } }
// usage:
emit('demo:upload-success', { name: 'photo.jpg' })  // ✓ typed
emit('nonexistent', {})                              // ✗ tsc error`}</Code>
      <Group gap="xs" wrap="wrap">
        <Button
          size="compact-sm"
          color="green"
          onClick={() => emit('demo:upload-success', { name: 'photo.jpg' })}
        >
          emit upload-success
        </Button>
        <Button size="compact-sm" color="red" onClick={() => emit('demo:save-error', null)}>
          emit save-error
        </Button>
        <Button
          size="compact-sm"
          color="yellow"
          onClick={() => emit('demo:quota-warn', { pct: 87 })}
        >
          emit quota-warn
        </Button>
      </Group>
    </Stack>
  )
}

// ── History store mutation API demo ──────────────────────────────────────────

function HistoryMutationSection() {
  const { items, unreadCount } = useNotificationHistory()
  const firstUnread = items.find((item) => item.readAt === undefined)

  return (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">
        History store mutation API
      </Text>
      <Text size="xs" c="dimmed">
        <code>add</code> / <code>markRead(id)</code> / <code>markAllRead()</code> are the three
        imperative mutations — trigger toasts above to populate the store, then exercise the APIs
        here. <code>unreadCount</code>: {unreadCount}.
      </Text>
      <Group gap="xs" wrap="wrap">
        <Button
          size="compact-sm"
          variant="default"
          onClick={() =>
            add({
              id: crypto.randomUUID(),
              intent: 'info',
              title: 'Manual add',
              message: `Added at ${new Date().toLocaleTimeString()}`,
              createdAt: Date.now(),
            })
          }
        >
          add() directly
        </Button>
        <Button
          size="compact-sm"
          variant="default"
          disabled={firstUnread === undefined}
          onClick={() => firstUnread !== undefined && markRead(firstUnread.id)}
        >
          markRead(first unread)
        </Button>
        <Button
          size="compact-sm"
          variant="default"
          disabled={unreadCount === 0}
          onClick={() => markAllRead()}
        >
          markAllRead()
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        Note: <code>markRead</code> / <code>markAllRead</code> are also exposed on the{' '}
        <code>useNotificationHistory()</code> return, for components that already subscribe to the
        store.
      </Text>
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
          notify helpers + notifyPromise + defineNotifications typed registry + emit() + persisted
          history store + NotificationBell + NotificationCenter
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
          <Divider />
          <TypedRegistrySection />
        </Stack>
      </Paper>

      <Paper p="sm" radius="md" withBorder>
        <Stack gap="md">
          <HistoryMutationSection />
          <Divider />
          <HistoryPanel />
        </Stack>
      </Paper>
    </Stack>
  )
}
