// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:memory-state
import { externalField, type PlainStore } from 'basalt-ui'

type Mode = 'rest' | 'interval'

// One module store: a value, the listeners, nothing else.
function createMemoryStore<T>(initial: T): PlainStore<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return
      value = next
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const timerMode = createMemoryStore<Mode>('rest')

// The handle a control binds with `field={timerMode$}`; `clear()` writes `fallback`.
export const timerMode$ = externalField(timerMode, {
  key: 'timer-mode',
  kind: 'enum',
  fallback: 'rest',
  options: [
    { value: 'rest', label: 'Rest timer' },
    { value: 'interval', label: 'Interval timer' },
  ],
})
// #endregion
