---
name: memory-state
use-when: live client state across routes (a timer, a selection) that a basalt control must read and write
file: apps/playground/src/recipes/memory-state.ts
---

Memory state is one `useSyncExternalStore`-compatible store: `get`, `set`, `subscribe`.
`externalField(store, options)` turns it into a `ControlHandle`; a control binds the handle and has no `value` or `onChange`.
A Zustand store binds the same way: pass `select` and `update` instead of `get` and `set`.
A selector must return a stable reference for an unchanged slice.
The handle has no lane: it never reaches the URL or storage, and `clear()` writes `fallback`.
A SSR app creates the store per request and keeps it in router context, never as a module singleton.

```ts
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
```
