/**
 * ./notifications — Mantine notification adapter battery.
 *
 * Provides notify helpers, a typed registry, a persisted history store, and a bell/center
 * component on top of @mantine/notifications. The overlay mount is `<BasaltOverlays notifications
 * />` (`basalt-ui/commands`) — this subpath no longer ships one of its own (C1 consolidation:
 * `BasaltNotifications` was superseded and is removed).
 *
 * Optional peer: @mantine/notifications ^9.3.0.
 *
 * Install with: bun add @mantine/notifications
 *
 * @example
 * // main.tsx — mount the overlay:
 * import { BasaltOverlays } from 'basalt-ui/commands'
 * <BasaltProvider><BasaltOverlays><App /></BasaltOverlays></BasaltProvider>
 *
 * // Usage:
 * import { notifySuccess, notifyError, notifyPromise, NotificationBell } from 'basalt-ui/notifications'
 * notifySuccess('Saved')
 * notifyError('Failed', { title: 'Upload error' })
 * notifyPromise(save(), { loading: 'Saving…', success: 'Saved', error: 'Failed' })
 *
 * // Optimistic mutation with an undo window (the toast's autoClose IS the window):
 * import { notifyUndo } from 'basalt-ui/notifications'
 * notifyUndo({ message: 'Item deleted', onUndo: () => restore(), onExpire: () => api.delete(id) })
 *
 * // Shell bell (globalActions slot):
 * <BasaltShell globalActions={[{ key: 'notifications', node: <NotificationBell />, mobile: 'bar' }]} ... />
 */

// ── notify core ───────────────────────────────────────────────────────────────
export {
  notify,
  notifySuccess,
  notifyError,
  notifyWarning,
  notifyInfo,
  notifyPromise,
  notifyUndo,
  notifyUndoable,
} from './notify'
export type {
  NotifyOptions,
  NotifyPromiseMessages,
  NotifyUndoOptions,
  NotifyUndoHandle,
} from './notify'

// ── defineNotification + defineNotifications + typed emit ─────────────────────
export {
  defineNotification,
  defineNotifications,
  emit,
  resolveAction,
  type NotificationAction,
  type NotificationKind,
  type NotificationSpec,
  type NotificationSpecMap,
  type NotificationIntent,
} from './define-notifications'

// ── history store ─────────────────────────────────────────────────────────────
export {
  add,
  markRead,
  markAllRead,
  dismiss,
  dismissAll,
  remove,
  clear,
  needsAttention,
  useNotificationHistory,
} from './store'
export type {
  NotificationActionRef,
  NotificationHistoryItem,
  NotificationHistoryState,
  UseNotificationHistoryReturn,
} from './store'

// ── NotificationBell ──────────────────────────────────────────────────────────
export { NotificationBell } from './bell'
export type { NotificationBellProps } from './bell'

// ── NotificationCenter ────────────────────────────────────────────────────────
export { NotificationCenter } from './center'
export type { NotificationCenterProps } from './center'
