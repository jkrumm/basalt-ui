import type { ReactNode } from 'react'

/** What a rendered overlay body may call. */
export type OverlayApi = {
  /** Closes this overlay and leaves the ones under it open. */
  close: () => void
}

/** One overlay. `P` is the payload its opener passes and its body reads. */
export type OverlaySpec<P> = {
  /** The accessible name and the visible heading. Required. */
  title: string
  /** One sentence under the title (a dialog only). */
  description?: string
  /** `dialog` centres a panel, `sheet` slides in from the edge (the bottom on a phone). Default `dialog`. */
  as?: 'dialog' | 'sheet'
  /** Dialog width. Default `md`. */
  size?: 'sm' | 'md' | 'lg'
  render: (props: P, api: OverlayApi) => ReactNode
}

/** The shape `defineOverlays` accepts. A payload type is contravariant, so `never` admits every one. */
export type OverlayMap = Readonly<Record<string, OverlaySpec<never>>>

type PayloadOf<S> = S extends {
  render: (props: infer P, api: never) => ReactNode
}
  ? P
  : never

/** The arguments `open` takes after the key: none for a payload-less overlay, the payload otherwise. */
type OpenArgs<S> = unknown extends PayloadOf<S> ? [] : [props: PayloadOf<S>]

/** One legal `open` call of a registry, as a value: the key and its payload. */
export type OverlayCall<T extends OverlayMap> = {
  [K in keyof T & string]: unknown extends PayloadOf<T[K]>
    ? { key: K; props?: undefined }
    : { key: K; props: PayloadOf<T[K]> }
}[keyof T & string]

declare const REGISTRY: unique symbol

/** What `defineOverlays` returns: a typed handle to open overlays, and the value `OverlayHost` mounts. */
export type OverlayRegistry<T extends OverlayMap> = {
  readonly [REGISTRY]: T
  /** Opens the overlay under `key` on top of the stack. An unknown key, or a wrong payload, is a compile error. */
  open<K extends keyof T & string>(key: K, ...args: OpenArgs<T[K]>): void
  /** Closes the top overlay, or every overlay of the registry with `{ all: true }`. */
  close(options?: { all?: boolean }): void
}

export type OverlayEntry = {
  id: number
  key: string
  props: unknown
  open: boolean
}

/** The state `OverlayHost` subscribes to. Internal: a registry exposes `open` and `close` only. */
export type OverlayStore = {
  specs: OverlayMap
  subscribe: (listener: () => void) => () => void
  snapshot: () => readonly OverlayEntry[]
  open: (key: string, props: unknown) => void
  close: (options?: { all?: boolean }) => void
  remove: (id: number) => void
  dismiss: (id: number) => void
}

const stores = new WeakMap<object, OverlayStore>()

/** The store behind a registry; `OverlayHost` reads it. Throws on an object `defineOverlays` did not return. */
export function overlayStoreOf(registry: object): OverlayStore {
  const store = stores.get(registry)
  if (store === undefined)
    throw new Error('[basalt] OverlayHost: `overlays` must come from defineOverlays')
  return store
}

/**
 * Defines the overlays of an app once and returns the typed handle that opens them: `open('key',
 * payload)` fails to compile on a key that was not defined and on a payload the body does not
 * take. Each overlay is a title and a render function; a form dialog is an entry whose `render`
 * returns the form. Mount `<OverlayHost overlays={OVERLAYS} />` once beside the router. An app that
 * defines none, or never mounts the host, ships none of it.
 *
 * Opening before the host mounts is safe: the entry waits in the stack and renders on mount.
 *
 * @useWhen a dialog or sheet opens from anywhere (a row action, a command) and its keys and payloads should be checked at compile time
 * @neverWhen the overlay is route-addressable or one trigger owns its open state (use `Dialog` or `Sheet` with a trigger)
 *
 * @example
 * export const OVERLAYS = defineOverlays({
 *   'user:edit': { title: 'Edit user', render: (p: { id: string }) => <UserForm id={p.id} /> },
 *   'logs:filter': { title: 'Filter logs', as: 'sheet', render: () => <LogFilters /> },
 * })
 * OVERLAYS.open('user:edit', { id: '42' })
 * OVERLAYS.open('user:delete', { id: '42' }) // compile error: unknown key
 */
export function defineOverlays<const T extends OverlayMap>(specs: T): OverlayRegistry<T> {
  let entries: readonly OverlayEntry[] = []
  let nextId = 1
  const listeners = new Set<() => void>()
  const set = (next: readonly OverlayEntry[]): void => {
    entries = next
    for (const listener of listeners) listener()
  }
  const store: OverlayStore = {
    specs,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    snapshot: () => entries,
    open(key, props) {
      if (!(key in specs)) {
        if (process.env.NODE_ENV !== 'production')
          console.warn(`[basalt] overlays.open: no overlay defined for "${key}"`)
        return
      }
      set([...entries, { id: nextId++, key, props, open: true }])
    },
    close(options) {
      const live = entries.filter((e) => e.open)
      if (live.length === 0) return
      const closing = options?.all === true ? live : live.slice(-1)
      set(entries.map((e) => (closing.includes(e) ? { ...e, open: false } : e)))
    },
    dismiss(id) {
      set(entries.map((e) => (e.id === id && e.open ? { ...e, open: false } : e)))
    },
    remove(id) {
      if (entries.some((e) => e.id === id)) set(entries.filter((e) => e.id !== id))
    },
  }
  const registry = {
    open: (key: string, ...args: unknown[]) => store.open(key, args[0]),
    close: store.close,
  } as unknown as OverlayRegistry<T>
  stores.set(registry, store)
  return registry
}
