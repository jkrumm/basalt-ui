/**
 * In-memory `ControlHandle`s for the `ControlView` tests and the layout fixture: a plain field, and a
 * widget bound to a global that can override it. No router; the shape is the frozen
 * `ControlHandle`, so a test drives exactly what `./router` hands a page.
 */
import { useSyncExternalStore } from 'react'
import type { ControlHandle } from '../core/ports'

type Kind = ControlHandle<unknown>['kind']
type Option<T> = { value: T; label: string }

export type MemoryHandle<T> = ControlHandle<T> & {
  /** Every value `set` received, in order. */
  readonly writes: T[]
  /** How many times `clear()` ran. */
  readonly clears: { count: number }
  /** Moves the stored value from outside, as a link or another surface would. */
  put(next: T): void
}

export type MemoryHandleOptions<T> = {
  kind: Kind
  options?: readonly Option<T>[]
  bounds?: { min?: number; max?: number; step?: number; int?: boolean }
}

function store<S>(initial: S): {
  get(): S
  set(next: S): void
  subscribe(cb: () => void): () => void
} {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(next) {
      state = next
      for (const cb of listeners) cb()
    },
    subscribe(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
}

/** A field that is its own source: `source` is always `'own'`. */
export function memoryHandle<T>(
  key: string,
  initial: T,
  o: MemoryHandleOptions<T>,
): MemoryHandle<T> {
  const value = store(initial)
  const writes: T[] = []
  const clears = { count: 0 }
  const set = (next: T): void => {
    writes.push(next)
    value.set(next)
  }
  return {
    key,
    kind: o.kind,
    ...(o.options !== undefined && { options: o.options }),
    ...(o.bounds !== undefined && { bounds: o.bounds }),
    writes,
    clears,
    put: value.set,
    use: () => [useSyncExternalStore(value.subscribe, value.get, value.get), set],
    useSource: () => ({ source: 'own' as const, inherited: undefined }),
    clear() {
      clears.count += 1
      value.set(initial)
    },
    get isDefault() {
      return Object.is(value.get(), initial)
    },
  } as MemoryHandle<T>
}

/**
 * A widget field bound to a global value. It shows the override when one is set and the global
 * otherwise; `clear()` drops the override. `global.set` moves the inherited value.
 */
export function widgetHandle<T>(
  key: string,
  global: T,
  o: MemoryHandleOptions<T> & { override?: T },
): MemoryHandle<T> & { readonly scope: 'widget'; setGlobal(next: T): void } {
  const inherited = store(global)
  const override = store<{ v: T } | null>(o.override === undefined ? null : { v: o.override })
  const writes: T[] = []
  const clears = { count: 0 }
  const effective = (): T => override.get()?.v ?? inherited.get()
  const sourceNow = (): 'inherited' | 'override' =>
    override.get() === null ? 'inherited' : 'override'
  const subscribe = (cb: () => void): (() => void) => {
    const stops = [inherited.subscribe(cb), override.subscribe(cb)]
    return () => {
      for (const stop of stops) stop()
    }
  }
  return {
    key,
    scope: 'widget' as const,
    kind: o.kind,
    ...(o.options !== undefined && { options: o.options }),
    ...(o.bounds !== undefined && { bounds: o.bounds }),
    writes,
    clears,
    put: (next: T) => {
      override.set({ v: next })
    },
    setGlobal: (next: T) => {
      inherited.set(next)
    },
    use: () => [
      useSyncExternalStore(subscribe, effective, effective),
      (next: T) => {
        writes.push(next)
        override.set({ v: next })
      },
    ],
    useSource: () => {
      const source = useSyncExternalStore(subscribe, sourceNow, sourceNow)
      const base = useSyncExternalStore(inherited.subscribe, inherited.get, inherited.get)
      return { source, inherited: base }
    },
    clear() {
      clears.count += 1
      override.set(null)
    },
    get isDefault() {
      return override.get() === null
    },
  } as MemoryHandle<T> & { readonly scope: 'widget'; setGlobal(next: T): void }
}
