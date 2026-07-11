/**
 * NotificationsDemoPage — exercises basalt-ui/notifications:
 * notifySuccess, notifyError, notifyWarning, notifyInfo, notifyPromise,
 * NotificationBell, NotificationCenter, BasaltNotifications,
 * defineNotifications (typed registry) + emit() (typed dispatch) + registry-resolved actions.
 *
 * BasaltNotifications is mounted in main.tsx — this page only drives the notify helpers.
 *
 * TYPED REGISTRY PATTERN:
 *   In a real app, defineNotifications lives in notifications.ts + a BasaltRegister augment:
 *     declare module 'basalt-ui' { interface BasaltRegister { notifications: typeof DEMO_NOTIFS } }
 *   Then emit('demo:upload-success', { name: 'photo.jpg' }) is fully typed at the call site.
 *   This demo includes that augment, so the emit() calls below are fully typed — no casts.
 *
 * ACTION PATTERN:
 *   A kind's spec can carry an `action: { label, run }`. emit() persists a serializable
 *   { kind, payload } ref; the notification center resolves the handler from the registry at render
 *   time, so the action button survives a reload. Because `run` is module-scope (it can't call
 *   component hooks directly), it dispatches through the module-level `demoActions` bridge, which the
 *   page wires to real navigation / modal behaviour in an effect.
 */
import {
  Badge,
  Button,
  Code,
  Divider,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useNavigate } from '@tanstack/react-router'
import {
  add,
  clear,
  defineNotifications,
  dismiss,
  emit,
  markAllRead,
  markRead,
  notifyError,
  notifyInfo,
  notifyPromise,
  notifySuccess,
  notifyWarning,
  remove,
  useNotificationHistory,
  NotificationCenter,
} from 'basalt-ui/notifications'
import { useEffect } from 'react'

// ── Action bridge ─────────────────────────────────────────────────────────────
// Registry `run` handlers are module-scope, so they can't call component hooks (navigate, modal)
// directly. They dispatch through this mutable bridge; the page wires the real behaviour in an
// effect. A real app would instead import its router instance / a global modal manager here.
const demoActions = {
  openDetails: (_payload: unknown) => {},
  manageStorage: () => {},
}

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
    action: { label: 'Open details', run: (p: unknown) => demoActions.openDetails(p) },
  },
  'demo:quota-warn': {
    intent: 'warning',
    toMessage: (p: unknown) => `Storage ${(p as { pct: number }).pct}% full`,
    action: { label: 'Manage storage', run: () => demoActions.manageStorage() },
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
      <Text size="xs" c="dimmed">
        Success / info are disposable — they land in <strong>All</strong> but never the{' '}
        <strong>Inbox</strong>. Errors / warnings need attention, so they show in both and light up
        the bell.
      </Text>
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

// ── Typed registry + emit() demo (incl. actions) ──────────────────────────────

function TypedRegistrySection() {
  return (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">
        defineNotifications + emit() (typed registry + actions)
      </Text>
      <Code block style={{ fontSize: 11 }}>{`// notifications.ts
const NOTIFS = defineNotifications({
  'demo:upload-success': { intent: 'success', toMessage: (p) => \`Uploaded \${p.name}\` },
  'demo:save-error':     { intent: 'error',   toMessage: () => 'Failed to save',
                           action: { label: 'Open details', run: (p) => openDetails(p) } },
})
declare module 'basalt-ui' { interface BasaltRegister { notifications: typeof NOTIFS } }
// usage — the action ref is persisted, the handler is resolved from the registry at render:
emit('demo:save-error', { id: 42 })  // ✓ shows in the Inbox with an "Open details" button`}</Code>
      <Group gap="xs" wrap="wrap">
        <Button
          size="compact-sm"
          color="green"
          onClick={() => emit('demo:upload-success', { name: 'photo.jpg' })}
        >
          emit upload-success
        </Button>
        <Button size="compact-sm" color="red" onClick={() => emit('demo:save-error', { id: 42 })}>
          emit save-error (→ modal)
        </Button>
        <Button
          size="compact-sm"
          color="yellow"
          onClick={() => emit('demo:quota-warn', { pct: 87 })}
        >
          emit quota-warn (→ navigate)
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        The two action emits land in the Inbox with a button. <strong>Open details</strong> opens a
        modal; <strong>Manage storage</strong> navigates to /settings — both resolved from the
        registry, so they keep working after a reload.
      </Text>
    </Stack>
  )
}

// ── History store mutation API demo ──────────────────────────────────────────

function HistoryMutationSection() {
  const { items, inbox, unreadCount } = useNotificationHistory()
  const firstUnread = inbox.find((item) => item.readAt === undefined)
  const firstInbox = inbox[0]
  const firstItem = items[0]

  return (
    <Stack gap="xs">
      <Text size="xs" tt="uppercase" fw={600} c="dimmed">
        History store mutation API
      </Text>
      <Text size="xs" c="dimmed">
        <code>add</code> / <code>markRead(id)</code> / <code>markAllRead()</code> /{' '}
        <code>dismiss(id)</code> / <code>remove(id)</code> / <code>clear()</code> are the imperative
        mutations. <code>inbox</code>: {inbox.length} · <code>unreadCount</code>: {unreadCount}.
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
        <Button
          size="compact-sm"
          variant="default"
          disabled={firstInbox === undefined}
          onClick={() => firstInbox !== undefined && dismiss(firstInbox.id)}
        >
          dismiss(first inbox)
        </Button>
        <Button
          size="compact-sm"
          variant="default"
          disabled={firstItem === undefined}
          onClick={() => firstItem !== undefined && remove(firstItem.id)}
        >
          remove(first)
        </Button>
        <Button
          size="compact-sm"
          variant="default"
          color="red"
          disabled={items.length === 0}
          onClick={() => clear()}
        >
          clear()
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
      <Paper p="sm">
        <NotificationCenter maxHeight={260} />
      </Paper>
    </Stack>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function NotificationsDemoPage() {
  const navigate = useNavigate()
  const [detailsOpen, { open: openDetails, close: closeDetails }] = useDisclosure(false)

  // Wire the module-level action bridge to real navigation / modal behaviour.
  useEffect(() => {
    demoActions.openDetails = () => openDetails()
    demoActions.manageStorage = () => navigate({ to: '/settings' })
  }, [navigate, openDetails])

  return (
    <Stack gap="md" p="md">
      <div>
        <Title order={3}>./notifications adapter</Title>
        <Text size="sm" c="dimmed" mt={4}>
          notify helpers + notifyPromise + defineNotifications typed registry + emit() +
          registry-resolved actions + persisted history store + NotificationBell +
          NotificationCenter
        </Text>
      </div>

      <Paper p="sm">
        <Stack gap="xs">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">
            Behaviour
          </Text>
          <Text size="sm">
            Toasts appear bottom-right (BasaltNotifications overlay) and are recorded to a persisted
            history. The bell badge counts <strong>unread Inbox items</strong> — things that need
            attention (errors, warnings, actionable notifications), not every toast. Opening the
            bell no longer marks everything read; items are marked read when you interact with them,
            and you dismiss (Inbox) or delete (All) them individually.
          </Text>
        </Stack>
      </Paper>

      <Paper p="sm">
        <Stack gap="md">
          <ToastButtons />
          <Divider />
          <PromiseButtons />
          <Divider />
          <TypedRegistrySection />
        </Stack>
      </Paper>

      <Paper p="sm">
        <Stack gap="md">
          <HistoryMutationSection />
          <Divider />
          <HistoryPanel />
        </Stack>
      </Paper>

      <Modal opened={detailsOpen} onClose={closeDetails} title="Save error details" centered>
        <Text size="sm">
          This modal was opened by a notification action resolved from the registry. In a real app
          this is where you'd show the failure detail, a retry button, or a diff.
        </Text>
      </Modal>
    </Stack>
  )
}
