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

/** A persisted history item — message/title stored as strings (ReactNode is not serializable). */
export type NotificationHistoryItem = {
  id: string
  intent: NotificationIntent
  title?: string
  message: string
  createdAt: number
  readAt?: number
}

export type NotificationHistoryState = NotificationHistoryItem[]

export type UseNotificationHistoryReturn = {
  items: NotificationHistoryItem[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
  clear: () => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'basalt:notifications'
const VERSION = 1
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
 * Mark items read when the notification center opens.
 *
 * @example
 * function NotificationCenter() {
 *   const { items, unreadCount, markAllRead, clear } = useNotificationHistory()
 *   return (
 *     <div>
 *       <button onClick={markAllRead}>Mark all read</button>
 *       <button onClick={clear}>Clear</button>
 *       {items.map(item => <div key={item.id}>{item.message}</div>)}
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

  const unreadCount = items.filter((item) => item.readAt === undefined).length

  return { items, unreadCount, markRead, markAllRead, clear }
}
