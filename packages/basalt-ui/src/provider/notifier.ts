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
