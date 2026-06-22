/**
 * Notification history store — module-level persisted external store.
 *
 * Ring-buffer cap of 50 items. Keys are namespaced `basalt:notifications` mirroring
 * createPersistedState's `basalt:*` pattern. Reads/writes use the same versioned `{ v, value }`
 * envelope. Cross-tab sync via the `storage` event.
 *
 * Module-level add/markRead/markAllRead/clear are callable from notify() (not hook-scoped), and
 * useNotificationHistory() exposes the reactive slice to components.
 *
 * @example
 * // Module-level (non-React):
 * import { add, markRead, markAllRead, clear } from 'basalt-ui/notifications'
 * add({ id: 'x', intent: 'success', message: 'Done', createdAt: Date.now() })
 *
 * // React:
 * import { useNotificationHistory } from 'basalt-ui/notifications'
 * const { items, unreadCount, markRead, markAllRead, clear } = useNotificationHistory()
 */
import { useSyncExternalStore } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationIntent = 'success' | 'error' | 'warning' | 'info'

/**
 * A serializable reference to a registered action. Resolved at render time against the
 * notifications registry (see resolveAction in ./define-notifications). The handler itself is NOT
 * stored — only the kind + payload — so an actionable notification survives a reload.
 */
export type NotificationActionRef = {
  kind: string
  /** Must be JSON-serializable — it is persisted to localStorage alongside the item. */
  payload?: unknown
}

/** A persisted history item — message/title stored as strings (ReactNode is not serializable). */
export type NotificationHistoryItem = {
  id: string
  intent: NotificationIntent
  title?: string
  message: string
  createdAt: number
  /** Set when the user has seen the item (markRead). undefined = unread. */
  readAt?: number
  /** Set when the user has dealt with the item (dismiss) — removes it from the Inbox view. */
  dismissedAt?: number
  /** A registry-resolved action — gives the item an actionable button in the center. */
  action?: NotificationActionRef
}

export type NotificationHistoryState = NotificationHistoryItem[]

export type UseNotificationHistoryReturn = {
  /** All history items, newest first (the "All" view). */
  items: NotificationHistoryItem[]
  /** Items that need attention and are not yet dismissed (the "Inbox" view). */
  inbox: NotificationHistoryItem[]
  /** Unread Inbox items — the bell badge count ("N things need your attention"). */
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
  dismiss: (id: string) => void
  dismissAll: () => void
  remove: (id: string) => void
  clear: () => void
}

/**
 * Whether an item belongs in the Inbox: it has an action, or it is an error/warning. Plain
 * success/info confirmations are disposable — they live only in the full history, never the Inbox.
 */
export function needsAttention(item: NotificationHistoryItem): boolean {
  return item.action !== undefined || item.intent === 'error' || item.intent === 'warning'
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'basalt:notifications'
// v2: added dismissedAt + action (inbox/all split). v1 payloads are dropped on read (no consumers).
const VERSION = 2
const RING_CAP = 50

// ── Persistence helpers ───────────────────────────────────────────────────────

type Envelope = { v: number; value: unknown }

function isEnvelope(raw: unknown): raw is Envelope {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    'v' in raw &&
    typeof (raw as Record<string, unknown>)['v'] === 'number' &&
    'value' in raw
  )
}

function readStorage(): NotificationHistoryState {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!isEnvelope(parsed) || parsed.v !== VERSION) return []
    return Array.isArray(parsed.value) ? (parsed.value as NotificationHistoryState) : []
  } catch {
    return []
  }
}

function writeStorage(next: NotificationHistoryState): void {
  if (typeof window === 'undefined') return
  try {
    const envelope: Envelope = { v: VERSION, value: next }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
  } catch {
    // Silently fail (storage full, private browsing, etc.)
  }
}

// ── Module-level state + listeners ───────────────────────────────────────────

let state: NotificationHistoryState = readStorage()
const listeners = new Set<() => void>()

function notifyListeners(): void {
  for (const cb of listeners) cb()
}

function setState(next: NotificationHistoryState): void {
  state = next
  writeStorage(next)
  notifyListeners()
}

// ── Cross-tab sync ────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      state = readStorage()
      notifyListeners()
    }
  })
}

// ── Module-level public API ───────────────────────────────────────────────────

/**
 * Add a notification to the history store (ring-buffer capped at 50).
 * Called by notify() — safe to call outside React.
 *
 * @example
 * add({ id: 'x', intent: 'success', message: 'Saved', createdAt: Date.now() })
 */
export function add(item: NotificationHistoryItem): void {
  const next = [item, ...state].slice(0, RING_CAP)
  setState(next)
}

/**
 * Mark a single notification as read by id.
 *
 * @example
 * markRead('notification-id')
 */
export function markRead(id: string): void {
  setState(state.map((item) => (item.id === id ? { ...item, readAt: Date.now() } : item)))
}

/**
 * Mark all notifications as read.
 *
 * @example
 * markAllRead()
 */
export function markAllRead(): void {
  const now = Date.now()
  setState(state.map((item) => (item.readAt === undefined ? { ...item, readAt: now } : item)))
}

/**
 * Dismiss a single item — marks it dealt-with so it leaves the Inbox view. The item stays in the
 * full history ("All" view). Use remove() to delete it outright.
 *
 * @example
 * dismiss('notification-id')
 */
export function dismiss(id: string): void {
  setState(state.map((item) => (item.id === id ? { ...item, dismissedAt: Date.now() } : item)))
}

/**
 * Dismiss every Inbox item at once — archives the whole attention set (they stay in the full
 * history). The bulk counterpart to dismiss(); does not touch already-dismissed or non-attention
 * items.
 *
 * @example
 * dismissAll()
 */
export function dismissAll(): void {
  const now = Date.now()
  setState(
    state.map((item) =>
      item.dismissedAt === undefined && needsAttention(item) ? { ...item, dismissedAt: now } : item,
    ),
  )
}

/**
 * Remove a single item from history entirely (per-item clear).
 *
 * @example
 * remove('notification-id')
 */
export function remove(id: string): void {
  setState(state.filter((item) => item.id !== id))
}

/**
 * Clear all notification history.
 *
 * @example
 * clear()
 */
export function clear(): void {
  setState([])
}

// ── useSyncExternalStore plumbing ─────────────────────────────────────────────

const noopSubscribe =
  (_cb: () => void): (() => void) =>
  () => {}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot(): NotificationHistoryState {
  return state
}

const serverState: NotificationHistoryState = []
function getServerSnapshot(): NotificationHistoryState {
  return serverState
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const isServer = typeof window === 'undefined'

/**
 * Reactive notification history — consumes the module-level persisted store.
 * Exposes both the full history (`items`) and the attention Inbox (`inbox`); `unreadCount` is the
 * unread Inbox count (the bell badge). Items are marked read on interaction, not on open.
 *
 * @example
 * function NotificationCenter() {
 *   const { inbox, unreadCount, markRead, dismiss } = useNotificationHistory()
 *   return (
 *     <div>
 *       {inbox.map(item => (
 *         <div key={item.id} onClick={() => markRead(item.id)}>
 *           {item.message}
 *           <button onClick={() => dismiss(item.id)}>Dismiss</button>
 *         </div>
 *       ))}
 *     </div>
 *   )
 * }
 */
export function useNotificationHistory(): UseNotificationHistoryReturn {
  const items = useSyncExternalStore<NotificationHistoryState>(
    isServer ? noopSubscribe : subscribe,
    isServer ? getServerSnapshot : getSnapshot,
    getServerSnapshot,
  )

  const inbox = items.filter((item) => item.dismissedAt === undefined && needsAttention(item))
  const unreadCount = inbox.filter((item) => item.readAt === undefined).length

  return { items, inbox, unreadCount, markRead, markAllRead, dismiss, dismissAll, remove, clear }
}
