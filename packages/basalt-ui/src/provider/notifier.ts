/**
 * The one subscribe/notify pair behind every module-level store here (slots, the command stash, the
 * modals-live waiters) — shaped for `useSyncExternalStore`. A leaf: no React, nothing at import.
 */
export type Notifier = { subscribe: (listener: () => void) => () => void; notify: () => void }

export function createNotifier(): Notifier {
  const listeners = new Set<() => void>()
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    // Deleting from a Set mid-iteration is safe, so a listener may unsubscribe itself here.
    notify() {
      for (const listener of listeners) listener()
    },
  }
}

export type LiveCounter = {
  count: () => number
  /** Count one more live thing, notify subscribers, and return its retraction (idempotent). */
  acquire: () => () => void
  subscribe: Notifier['subscribe']
}

/**
 * A COUNTER of live things — not a flag: two overlapping mounts are normal (a route swap mounts the
 * next one before unmounting the previous), and a last-write-wins boolean would report the OLD one's
 * teardown as "none live" while the new one serves.
 */
export function createLiveCounter(): LiveCounter {
  let live = 0
  const changes = createNotifier()
  return {
    count: () => live,
    subscribe: changes.subscribe,
    acquire() {
      live++
      changes.notify()
      let released = false
      return () => {
        // A cleanup React runs twice (StrictMode remount) must not drive the count below the real one.
        if (released) return
        released = true
        live--
        changes.notify()
      }
    },
  }
}
