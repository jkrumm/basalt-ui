/**
 * `notify` — the intent-to-priority queue behind every toast (docs/v3/concepts/state-persistence-forms.md
 * section 5). It lives in core and imports no Base UI: a call made before the `ToastHost` chunk has
 * loaded waits in the queue (cap 50) and is delivered when the host mounts, so no early call is lost.
 *
 * Runtime imports: none. The register seam is a type import only.
 */
import type { Slot } from '../register'

/** The four kinds basalt ships. An app adds more by augmenting `BasaltRegister['notifications']`. */
export type DefaultNotifyKind = 'error' | 'success' | 'info' | 'warning'

type Registered = Slot<'notifications', Record<string, unknown>>

/** A shipped kind, or a key the app registered under `BasaltRegister['notifications']`. */
export type NotifyKind = DefaultNotifyKind | Extract<keyof Registered, string>

export type NotifyUndo = {
  /** Inverts the change, which is already applied. Runs at most once, from the toast or `notify.undo`. */
  revert(): void | Promise<void>
  /** How long the Undo action stays offered. Default 8000. */
  windowMs?: number
}

export type NotificationPayload = {
  message: string
  title?: string
  /** Milliseconds, clamped to at least 5000; `false` keeps the toast until dismissed. */
  autoClose?: number | false
  undo?: NotifyUndo
}

/** Called as a notification of the kind is delivered; see `notify.onShow`. */
export type NotifyShowHook = (payload: NotificationPayload, id: string) => void

/** What the host renders: the payload with its intent resolved to a priority and a timeout. */
export type NotifyEntry = {
  id: string
  kind: string
  message: string
  title?: string
  /** `error` is announced urgently; everything else politely. */
  priority: 'high' | 'low'
  /** Milliseconds; 0 keeps the toast until dismissed. */
  timeout: number
  undo?: { revert: () => void; windowMs: number }
}

/** The host's side of the queue. `ToastHost` connects one on mount. */
export type NotifySink = {
  add(entry: NotifyEntry): void
  close(id: string): void
}

/** The floor of every auto-close: Base UI's own default, and the length a toast needs to be read. */
export const NOTIFY_FLOOR_MS = 5000
/** The same payload within this window shows one toast. */
export const NOTIFY_DEDUP_MS = 1500
/** The queue holds this many until a host mounts; the oldest is dropped past it. */
export const NOTIFY_QUEUE_CAP = 50
/** A dev warning fires when a notification waits this long with no host. */
export const NOTIFY_NO_HOST_MS = 3000
const UNDO_WINDOW_MS = 8000

function timeoutOf(kind: string, autoClose: NotificationPayload['autoClose']): number {
  if (autoClose === false) return 0
  if (autoClose !== undefined) return Math.max(NOTIFY_FLOOR_MS, autoClose)
  return kind === 'error' ? 0 : NOTIFY_FLOOR_MS
}

let sink: NotifySink | undefined
let pending: NotifyEntry[] = []
let sequence = 0
let warnTimer: ReturnType<typeof setTimeout> | undefined
const recent = new Map<string, { id: string; at: number }>()
/** Per live notification: the payload for `onShow`, and the once-guarded revert. */
const live = new Map<string, { revert?: () => void; done: () => boolean }>()

function dedupKey(kind: string, p: NotificationPayload): string {
  return JSON.stringify([kind, p.title ?? null, p.message, p.undo === undefined])
}

const hooks = new Map<string, NotifyShowHook>()
const payloads = new Map<string, NotificationPayload>()

function deliver(entry: NotifyEntry, payload: NotificationPayload): void {
  payloads.delete(entry.id)
  sink?.add(entry)
  hooks.get(entry.kind)?.(payload, entry.id)
}

function armNoHostWarning(): void {
  if (process.env.NODE_ENV === 'production' || warnTimer !== undefined) return
  warnTimer = setTimeout(() => {
    warnTimer = undefined
    if (sink !== undefined || pending.length === 0) return
    console.warn(
      `basalt-ui notify: ${pending.length} notification(s) are waiting and no <ToastHost /> is mounted. ` +
        'Render <ToastHost /> from "basalt-ui/page" once, inside the app.',
    )
  }, NOTIFY_NO_HOST_MS)
}

/**
 * Show a toast. Returns its id. Errors stay until dismissed; every other kind closes after 5 s; an
 * explicit `autoClose` under 5000 is raised to 5000. An identical payload within 1,500 ms returns
 * the first toast's id and shows nothing new.
 *
 * @useWhen a result needs a short, passing note the user can ignore
 * @neverWhen the message must be read to continue, or belongs next to a field
 *
 * @example
 * notify('success', { message: 'Saved' })
 * notify('error', { message: 'Upload failed', title: 'photo.jpg' })
 */
export function notify(kind: NotifyKind, payload: NotificationPayload): string {
  const now = Date.now()
  // An undoable payload is never a duplicate: each carries its own revert.
  const key = dedupKey(kind, payload)
  const last = payload.undo === undefined ? recent.get(key) : undefined
  if (last !== undefined && now - last.at < NOTIFY_DEDUP_MS) return last.id

  sequence += 1
  const id = `basalt-notify-${sequence}`
  recent.set(key, { id, at: now })
  if (recent.size > NOTIFY_QUEUE_CAP) {
    const oldest = recent.keys().next().value
    if (oldest !== undefined) recent.delete(oldest)
  }

  let reverted = false
  const state: { revert?: () => void; done: () => boolean } = { done: () => reverted }
  const { undo } = payload
  if (undo !== undefined) {
    state.revert = () => {
      if (reverted) return
      reverted = true
      void undo.revert()
    }
  }
  if (undo !== undefined) {
    live.set(id, state)
    if (live.size > NOTIFY_QUEUE_CAP) {
      const oldest = live.keys().next().value
      if (oldest !== undefined) live.delete(oldest)
    }
  }
  payloads.set(id, payload)

  const entry: NotifyEntry = {
    id,
    kind,
    message: payload.message,
    priority: kind === 'error' ? 'high' : 'low',
    timeout: timeoutOf(kind, payload.autoClose),
    ...(payload.title === undefined ? {} : { title: payload.title }),
    ...(state.revert === undefined
      ? {}
      : { undo: { revert: state.revert, windowMs: undo?.windowMs ?? UNDO_WINDOW_MS } }),
  }

  if (sink === undefined) {
    pending.push(entry)
    if (pending.length > NOTIFY_QUEUE_CAP) {
      const dropped = pending.shift()
      if (dropped !== undefined) {
        live.delete(dropped.id)
        payloads.delete(dropped.id)
      }
    }
    armNoHostWarning()
  } else {
    deliver(entry, payload)
  }
  return id
}

/**
 * Run a notification's `undo.revert` once and close its toast. The app's own Undo path (Cmd+Z, a
 * button) calls this instead of its own function, so the toast action and the app share one revert.
 * Returns false when the notification has no undo or it already ran.
 *
 * @example
 * notify.undo(id)
 */
notify.undo = function undo(id: string): boolean {
  const state = live.get(id)
  if (state?.revert === undefined || state.done()) return false
  const wasPending = pending.some((e) => e.id === id)
  state.revert()
  if (wasPending) pending = pending.filter((e) => e.id !== id)
  else sink?.close(id)
  return true
}

/**
 * Register a kind's `onShow` hook, called once as each of its notifications is delivered to the
 * host (after a queued one drains, too). This is where an inbox recipe hangs. Returns the
 * unregister function.
 *
 * @example
 * const off = notify.onShow('error', (payload, id) => inbox.push(id, payload.message))
 */
notify.onShow = function onShow(kind: NotifyKind, hook: NotifyShowHook): () => void {
  hooks.set(kind, hook)
  return () => {
    if (hooks.get(kind) === hook) hooks.delete(kind)
  }
}

/**
 * Connect the host: queued notifications are delivered in order, later ones directly. Returns the
 * disconnect function; a second host replaces the first.
 *
 * @internal
 */
export function connectNotifyHost(next: NotifySink): () => void {
  sink = next
  if (warnTimer !== undefined) {
    clearTimeout(warnTimer)
    warnTimer = undefined
  }
  const queued = pending
  pending = []
  for (const entry of queued) {
    const payload = payloads.get(entry.id)
    if (payload !== undefined) deliver(entry, payload)
  }
  return () => {
    if (sink === next) sink = undefined
  }
}

/** @internal Test seam: forget every queued, live and recent notification. */
export function resetNotify(): void {
  sink = undefined
  pending = []
  sequence = 0
  if (warnTimer !== undefined) clearTimeout(warnTimer)
  warnTimer = undefined
  recent.clear()
  live.clear()
  payloads.clear()
  hooks.clear()
}
