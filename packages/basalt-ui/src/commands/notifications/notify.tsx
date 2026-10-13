/**
 * notify — core toast helper wrapping @mantine/notifications.
 *
 * Maps intent → Mantine color name, sets per-intent aria role and autoClose defaults,
 * records every toast into the module-level history store, and applies two-layer dedup:
 *   1. Mantine id-dedup (passing the same id to notifications.show is a no-op on screen)
 *   2. dedupKey window — module-level Map prevents duplicate keys within 1500ms
 *
 * Internal: consumers reach it through `emit` (`defineNotifications`).
 *
 * @example
 * notify({ intent: 'success', message: 'Saved' })
 * notify({ intent: 'error', message: 'Failed', title: 'Upload error', autoClose: false })
 */
import type { ReactNode } from 'react'
import { notifications } from '@mantine/notifications'
import { add, has } from './store'
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
/** dedupKey → when it was recorded, and the id that recording returned. */
const dedupKeyTimestamps = new Map<string, { at: number; id: string }>()

/** Drop entries past the window, so a long-lived page with many distinct keys never grows the map. */
function pruneDedupKeys(now: number): void {
  for (const [key, { at }] of dedupKeyTimestamps) {
    if (now - at >= DEDUP_WINDOW_MS) dedupKeyTimestamps.delete(key)
  }
}

/** The id recorded for `dedupKey` inside the window, or `undefined` when this call is a first. */
function recentIdForKey(dedupKey: string): string | undefined {
  const last = dedupKeyTimestamps.get(dedupKey)
  if (last === undefined || Date.now() - last.at >= DEDUP_WINDOW_MS) return undefined
  return last.id
}

// ── ID generation ─────────────────────────────────────────────────────────────

let seq = 0
function nextId(): string {
  return `basalt-${Date.now()}-${++seq}`
}

/** History stores serializable text: a string or number survives, any other node is dropped. */
function historyText(node: ReactNode): string | undefined {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  return undefined
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
 * Show a toast and record it to the notification history. Only string / number `message` and
 * `title` are recorded; any other node shows in the toast but the history keeps `''` (message) or
 * no title.
 * Returns the notification id (string).
 *
 * @example
 * const id = notify({ intent: 'success', message: 'Profile saved', title: 'Success' })
 * const id = notify({ intent: 'error', message: <b>Failed</b>, autoClose: false })
 */
export function notify(opts: NotifyOptions): string {
  const { intent = 'info', message, title, icon, autoClose, id, dedupKey, action } = opts

  // Two-layer dedup: dedupKey window guard — a hit returns the id the first call recorded.
  if (dedupKey !== undefined) {
    const recorded = recentIdForKey(dedupKey)
    if (recorded !== undefined) return recorded
  }

  const resolvedId = id ?? nextId()
  if (dedupKey !== undefined) {
    pruneDedupKeys(Date.now())
    dedupKeyTimestamps.set(dedupKey, { at: Date.now(), id: resolvedId })
  }
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

  // An explicit id already in the history is the same notification re-shown: Mantine updates it on
  // screen, and the history keeps its one record.
  if (id !== undefined && has(id)) return resolvedId

  const titleText = historyText(title)
  add({
    id: resolvedId,
    intent,
    ...(titleText !== undefined && { title: titleText }),
    message: historyText(message) ?? '',
    createdAt: Date.now(),
    ...(action !== undefined && { action }),
  })

  return resolvedId
}
