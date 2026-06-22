/**
 * notify — core toast helper wrapping @mantine/notifications.
 *
 * Maps intent → Mantine color name, sets per-intent aria role and autoClose defaults,
 * records every toast into the module-level history store, and applies two-layer dedup:
 *   1. Mantine id-dedup (passing the same id to notifications.show is a no-op on screen)
 *   2. dedupKey window — module-level Map prevents duplicate keys within 1500ms
 *
 * For loading→success/error transitions use notifyPromise — it calls notifications.update
 * (never show()) so the loading state is replaced correctly.
 *
 * @example
 * notify({ intent: 'success', message: 'Saved' })
 * notify({ intent: 'error', message: 'Failed', title: 'Upload error', autoClose: false })
 * notifyPromise(apiCall(), { loading: 'Saving…', success: 'Saved', error: 'Failed' })
 */
import type { ReactNode } from 'react'
import { notifications } from '@mantine/notifications'
import { add } from './store'
import type { NotificationIntent, NotificationActionRef } from './store'

export type { NotificationIntent }

// ── Intent → Mantine color + defaults ────────────────────────────────────────

const INTENT_COLOR: Record<NotificationIntent, string> = {
  success: 'green',
  error: 'red',
  warning: 'yellow',
  info: 'blue',
}

/**
 * Aria role per intent.
 * 'alert' = assertive (error/warning: must be announced immediately)
 * 'status' = polite (success/info: waits for a natural pause)
 */
const INTENT_ROLE: Record<NotificationIntent, 'alert' | 'status'> = {
  error: 'alert',
  warning: 'alert',
  success: 'status',
  info: 'status',
}

/** Per-intent default autoClose (ms). false = until-dismissed. */
const INTENT_AUTO_CLOSE: Record<NotificationIntent, number | false> = {
  success: 2000,
  info: 3000,
  warning: 5000,
  error: false,
}

// ── Two-layer dedup — dedupKey window ────────────────────────────────────────

const DEDUP_WINDOW_MS = 1500
const dedupKeyTimestamps = new Map<string, number>()

function isDuplicateKey(dedupKey: string): boolean {
  const last = dedupKeyTimestamps.get(dedupKey)
  if (last !== undefined && Date.now() - last < DEDUP_WINDOW_MS) return true
  dedupKeyTimestamps.set(dedupKey, Date.now())
  return false
}

// ── ID generation ─────────────────────────────────────────────────────────────

let seq = 0
function nextId(): string {
  return `basalt-${Date.now()}-${++seq}`
}

// ── NotifyOptions ─────────────────────────────────────────────────────────────

export type NotifyOptions = {
  intent?: NotificationIntent
  message: ReactNode
  title?: ReactNode
  icon?: ReactNode
  autoClose?: number | false
  id?: string
  dedupKey?: string
  /**
   * A serializable action ref — gives the recorded item an action button in the notification
   * center. Usually attached automatically by `emit()` from the kind's spec; pass it directly
   * only when calling `notify()` for an action registered in the notifications registry.
   */
  action?: NotificationActionRef
}

// ── notify ────────────────────────────────────────────────────────────────────

/**
 * Show a toast and record it to the notification history.
 * Returns the notification id (string).
 *
 * @example
 * const id = notify({ intent: 'success', message: 'Profile saved', title: 'Success' })
 * const id = notify({ intent: 'error', message: <b>Failed</b>, autoClose: false })
 */
export function notify(opts: NotifyOptions): string {
  const { intent = 'info', message, title, icon, autoClose, id, dedupKey, action } = opts

  // Two-layer dedup: dedupKey window guard
  if (dedupKey !== undefined && isDuplicateKey(dedupKey)) return id ?? nextId()

  const resolvedId = id ?? nextId()
  const color = INTENT_COLOR[intent]
  const role = INTENT_ROLE[intent]
  const resolvedAutoClose = autoClose !== undefined ? autoClose : INTENT_AUTO_CLOSE[intent]

  notifications.show({
    id: resolvedId,
    message,
    title: title ?? undefined,
    color,
    icon: icon ?? undefined,
    autoClose: resolvedAutoClose,
    role,
  })

  // Record to history store (stringify ReactNode — store only serializable text)
  add({
    id: resolvedId,
    intent,
    ...(title !== undefined && { title: String(title) }),
    message: String(message),
    createdAt: Date.now(),
    ...(action !== undefined && { action }),
  })

  return resolvedId
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

/**
 * Show a success toast.
 *
 * @example
 * notifySuccess('Profile saved')
 * notifySuccess('Done', { title: 'Upload complete', icon: <IconCheck /> })
 */
export function notifySuccess(
  message: ReactNode,
  opts?: Omit<NotifyOptions, 'intent' | 'message'>,
): string {
  return notify({ ...opts, intent: 'success', message })
}

/**
 * Show an error toast (auto-close off by default).
 *
 * @example
 * notifyError('Upload failed', { title: 'Error' })
 */
export function notifyError(
  message: ReactNode,
  opts?: Omit<NotifyOptions, 'intent' | 'message'>,
): string {
  return notify({ ...opts, intent: 'error', message })
}

/**
 * Show a warning toast.
 *
 * @example
 * notifyWarning('Session expires in 5 minutes')
 */
export function notifyWarning(
  message: ReactNode,
  opts?: Omit<NotifyOptions, 'intent' | 'message'>,
): string {
  return notify({ ...opts, intent: 'warning', message })
}

/**
 * Show an info toast.
 *
 * @example
 * notifyInfo('New version available')
 */
export function notifyInfo(
  message: ReactNode,
  opts?: Omit<NotifyOptions, 'intent' | 'message'>,
): string {
  return notify({ ...opts, intent: 'info', message })
}

// ── notifyPromise ─────────────────────────────────────────────────────────────

export type NotifyPromiseMessages = {
  loading: ReactNode
  success: ReactNode
  error: ReactNode
}

/**
 * Show a loading toast while a promise is pending, then update to success or error on settle.
 * Uses notifications.show for loading → notifications.update for the final state (Mantine dedup
 * requires update, not show, to replace an existing id).
 * Records the final state (success/error) to history.
 *
 * @example
 * await notifyPromise(uploadFile(file), {
 *   loading: 'Uploading…',
 *   success: 'Upload complete',
 *   error: 'Upload failed',
 * })
 */
export function notifyPromise<T>(promise: Promise<T>, messages: NotifyPromiseMessages): Promise<T> {
  const id = nextId()

  notifications.show({
    id,
    message: messages.loading,
    loading: true,
    autoClose: false,
    withCloseButton: false,
    role: 'status',
  })

  return promise.then(
    (result) => {
      notifications.update({
        id,
        message: messages.success,
        color: INTENT_COLOR['success'],
        loading: false,
        autoClose: INTENT_AUTO_CLOSE['success'],
        withCloseButton: true,
        role: 'status',
      })
      add({
        id,
        intent: 'success',
        message: String(messages.success),
        createdAt: Date.now(),
      })
      return result
    },
    (err: unknown) => {
      notifications.update({
        id,
        message: messages.error,
        color: INTENT_COLOR['error'],
        loading: false,
        autoClose: INTENT_AUTO_CLOSE['error'],
        withCloseButton: true,
        role: 'alert',
      })
      add({
        id,
        intent: 'error',
        message: String(messages.error),
        createdAt: Date.now(),
      })
      throw err
    },
  )
}
