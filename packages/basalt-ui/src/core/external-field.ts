/**
 * `externalField` — a `ControlHandle` over a value some other store owns (a module store, a Zustand
 * slice, a context). The bridge for memory state: neither a URL param nor a device preference, so no
 * `persisted` key and no router field may hold it without forking the truth.
 *
 * Runtime imports: `react` only. The store is structural, so nothing here names Zustand.
 */
import { useSyncExternalStore } from 'react'
import type { ControlHandle } from './ports'

/** The plain shape: `get`, `set`, `subscribe`. Anything `useSyncExternalStore` can read. */
export type PlainStore<T> = {
  get(): T
  set(next: T): void
  subscribe(onChange: () => void): () => void
}

/** The Zustand shape (`getState`, `setState`, `subscribe`), declared structurally. */
export type StateStore<S> = {
  getState(): S
  setState(partial: Partial<S>): void
  subscribe(listener: (state: S, prev: S) => void): () => void
}

type FieldBase<T> = {
  /** Stable identity of the control (`ControlHandle.key`). */
  key: string
  kind: ControlHandle<T>['kind']
  /** What `clear()` writes: a foreign store has no "unset". */
  fallback: T
  options?: ControlHandle<T>['options']
  /** Equality for `isDefault`. Defaults to `Object.is`. */
  equals?: (a: T, b: T) => boolean
}

/** A selector must return a stable reference for an unchanged slice, or the hook re-renders forever. */
export type StateFieldOptions<S, T> = FieldBase<T> & {
  select: (state: S) => T
  /** The partial state that writes `next` through `setState`. */
  update: (next: T) => Partial<S>
}

function isStateStore(
  store: PlainStore<unknown> | StateStore<unknown>,
): store is StateStore<unknown> {
  return 'getState' in store
}

/**
 * Binds a store basalt does not own as a `ControlHandle`: a control reads and writes only through
 * it, with no `value` or `onChange`. `clear()` writes `fallback` through the store, mounted or not.
 * The handle has no lane, so `useSource()` always reports `own`.
 *
 * @useWhen a filter, mode or selection lives in a store another module owns (a Zustand slice, a module singleton) and a basalt control must show and change it
 * @neverWhen the value should survive a reload (use `persisted`) or a shared link (use a router field)
 * @example
 * const mode = externalField(timer, { key: 'timer-mode', kind: 'enum', fallback: 'rest' })
 * const [value, setValue] = mode.use()
 */
export function externalField<T>(store: PlainStore<T>, o: FieldBase<T>): ControlHandle<T>
export function externalField<S, T>(
  store: StateStore<S>,
  o: StateFieldOptions<S, T>,
): ControlHandle<T>
export function externalField(
  store: PlainStore<unknown> | StateStore<unknown>,
  o: FieldBase<unknown> & Partial<StateFieldOptions<unknown, unknown>>,
): ControlHandle<unknown> {
  let read: () => unknown
  let write: (next: unknown) => void
  let subscribe: (onChange: () => void) => () => void

  if (isStateStore(store)) {
    const { select, update } = o
    if (select === undefined || update === undefined) {
      throw new Error(
        `basalt-ui: externalField("${o.key}") over a state store needs select and update.`,
      )
    }
    read = () => select(store.getState())
    write = (next) => store.setState(update(next))
    subscribe = (onChange) => store.subscribe(() => onChange())
  } else {
    read = () => store.get()
    write = (next) => store.set(next)
    subscribe = (onChange) => store.subscribe(onChange)
  }

  const equals = o.equals ?? Object.is
  const source = { source: 'own', inherited: undefined } as const

  return {
    key: o.key,
    kind: o.kind,
    ...(o.options === undefined ? {} : { options: o.options }),
    use: () => [useSyncExternalStore(subscribe, read, read), write] as const,
    useSource: () => source,
    clear: () => write(o.fallback),
    get isDefault() {
      return equals(read(), o.fallback)
    },
  }
}
