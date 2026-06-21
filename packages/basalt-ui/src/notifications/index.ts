/**
 * ./notifications — Mantine notification adapter battery.
 *
 * Provides notify helpers, a typed registry, a persisted history store, and a bell/center
 * overlay component on top of @mantine/notifications.
 *
 * Optional peer: @mantine/notifications ^9.3.0.
 *
 * Install with: bun add @mantine/notifications
 *
 * @example
 * // main.tsx — mount the overlay:
 * import { BasaltNotifications } from 'basalt-ui/notifications'
 * <BasaltProvider><BasaltNotifications /><App /></BasaltProvider>
 *
 * // Usage:
 * import { notifySuccess, notifyError, notifyPromise, NotificationBell } from 'basalt-ui/notifications'
 * notifySuccess('Saved')
 * notifyError('Failed', { title: 'Upload error' })
 * notifyPromise(save(), { loading: 'Saving…', success: 'Saved', error: 'Failed' })
 *
 * // Shell bell (globalActions slot):
 * <BasaltShell globalActions={<NotificationBell />} ... />
 */

// ── notify core ───────────────────────────────────────────────────────────────
export {
  notify,
  notifySuccess,
  notifyError,
  notifyWarning,
  notifyInfo,
  notifyPromise,
} from './notify'
export type { NotifyOptions, NotifyPromiseMessages } from './notify'

// ── defineNotification + defineNotifications + typed emit ─────────────────────
export {
  defineNotification,
  defineNotifications,
  emit,
  type NotificationKind,
  type NotificationSpec,
  type NotificationSpecMap,
  type NotificationIntent,
} from './define-notifications'

// ── history store ─────────────────────────────────────────────────────────────
export { add, markRead, markAllRead, clear, useNotificationHistory } from './store'
export type { NotificationHistoryItem, UseNotificationHistoryReturn } from './store'

// ── NotificationBell ──────────────────────────────────────────────────────────
export { NotificationBell } from './bell'
export type { NotificationBellProps } from './bell'

// ── NotificationCenter ────────────────────────────────────────────────────────
export { NotificationCenter } from './center'
export type { NotificationCenterProps } from './center'

// ── BasaltNotifications overlay ───────────────────────────────────────────────
export { BasaltNotifications } from './overlay'
export type { BasaltNotificationsProps } from './overlay'
