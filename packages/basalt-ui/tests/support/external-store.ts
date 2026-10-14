/** A bare external store — the `{ get, set, subscribe }` shape `externalField` takes (zustand's API). */
import type { ExternalStore } from '../../src/state/fields'

export function createExternalStore<T>(initial: T): ExternalStore<T> & { sets: T[] } {
  let value = initial
  const sets: T[] = []
  const listeners = new Set<() => void>()
  return {
    sets,
    get: () => value,
    set: (next) => {
      sets.push(next)
      value = next
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
