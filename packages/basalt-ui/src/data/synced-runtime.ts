/**
 * The session behind `createSyncedState`: one per QueryClient and owner, React-free. It holds the
 * local value, the pending patch, the one save in flight and the remote `{ value, rev }`; the
 * binding (`synced.ts`) supplies the Query wiring through `env`. Scheduler, storage and transport
 * are injected, so the transport contract suite runs on virtual time. Shaped by the S1 spike
 * (docs/v3/spikes/synced.md): the save base is the local value, a load that lands after a save
 * never regresses `rev`, and a value from another tab is never reverted by this tab's next save.
 */
import type { PersistedSchema } from '../core/persisted'
import type { StorageLike } from '../core/ports'
import { statusOf } from './query-client'

export type SyncedRev = string | null
/** `value: null` is an un-seeded server (argo `GET /gym` answers `state: null`). */
export type SyncedRemote<T> = { value: T | null; rev: SyncedRev }
/** `keepalive` is true only for the flush of a hidden tab whose body fits 64 KiB: pass it to `fetch`. */
export type SyncedSaveInit = { keepalive: boolean }
export type SyncedTransport<T> = {
  load(): Promise<SyncedRemote<T>>
  /**
   * `base.value` is the current local value (the resolved one before the first load), `rev` the
   * last remote rev; the seed passes `{ value: null, rev: null }`. Resolve with the stored value and
   * any monotonic string as `rev` (the core only stores it). Reject with an error whose numeric
   * `status` is 409 or 412 for a version conflict.
   */
  save(
    patch: Partial<T>,
    base: SyncedRemote<T>,
    init: SyncedSaveInit,
  ): Promise<{ value: T; rev: string }>
}
export type SyncStatus = 'saved' | 'saving' | 'offline' | 'error'
export type SyncedSnapshot<T> = { value: T; status: SyncStatus; rev: SyncedRev }
export type Scheduler = {
  now(): number
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(id: unknown): void
}

export type SyncedDefinition<T> = {
  key: string
  version: number
  schema: PersistedSchema<T>
  initial: T
  transport: SyncedTransport<T>
  editing?: () => boolean
  debounceMs?: number
}

export type SessionEnv<T> = {
  owner: string | null
  storage: StorageLike | null
  scheduler: Scheduler
  /** The remote the Query cache already holds (dehydrated on SSR). */
  remote?: SyncedRemote<T> | undefined
  /** Runs one save as the state's single writer; Query: a mutation in the key's scope. */
  write?: <R>(run: () => Promise<R>) => Promise<R>
  /** Every remote the session accepts; Query: `setQueryData`. */
  onRemote?: (remote: SyncedRemote<T>) => void
  online?: () => boolean
}

export type SyncedSession<T> = {
  readonly owner: string | null
  snapshot(): SyncedSnapshot<T>
  /** What the server rendered: the Query value, else `initial`. Never the mirror. */
  serverSnapshot(): SyncedSnapshot<T>
  /** The first listener attaches the cross-tab and hide listeners, the last detaches them. */
  subscribe(cb: () => void): () => void
  set(patch: Partial<T>): void
  /** The Query `queryFn`: no request while a save is pending or in flight. */
  load(): Promise<SyncedRemote<T>>
  flushHidden(): void
  dispose(): void
}

/** A remote value replaces a field only this long after the field's last local edit. */
export const SETTLE_MS = 2000
/** The browser's cap on a `keepalive` body. */
export const KEEPALIVE_MAX_BYTES = 64 * 1024
const RETRIES = 3
const BACKOFF_MS = 1000
const CONFLICT: ReadonlySet<number> = new Set([409, 412])
const TRANSIENT_4XX: ReadonlySet<number> = new Set([408, 425, 429])

type Bag = Record<string, unknown>

const isRecord = (x: unknown): x is Bag => typeof x === 'object' && x !== null && !Array.isArray(x)
const canon = (v: unknown): string =>
  JSON.stringify(v, (_, x: unknown) =>
    isRecord(x)
      ? Object.fromEntries(Object.entries(x).toSorted(([a], [b]) => (a < b ? -1 : 1)))
      : x,
  )
const same = (a: unknown, b: unknown): boolean => canon(a) === canon(b)
const hasKeys = (o: object): boolean => Object.keys(o).length > 0
const bytes = (v: unknown): number => new TextEncoder().encode(JSON.stringify(v)).byteLength
/** A 4xx other than a transient one: the same request cannot start succeeding. */
const permanent = (status: number | undefined): boolean =>
  status !== undefined && status >= 400 && status < 500 && !TRANSIENT_4XX.has(status)

export function createSyncedSession<T extends object>(
  def: SyncedDefinition<T>,
  env: SessionEnv<T>,
): SyncedSession<T> {
  const { scheduler: clock, storage, owner } = env
  const { transport } = def
  const debounceMs = def.debounceMs ?? 600
  const mirrorKey = owner === null ? null : `basalt:${owner}:${def.key}`
  const write = env.write ?? (<R>(run: () => Promise<R>) => run())
  const online = env.online ?? (() => globalThis.navigator?.onLine !== false)

  const read = (key: string): string | null => {
    try {
      return storage?.getItem(key) ?? null
    } catch {
      return null
    }
  }
  function envelope(raw: string | null): { value: T; rev: SyncedRev } | null {
    if (!raw) return null
    let m: unknown
    try {
      m = JSON.parse(raw)
    } catch {
      return null
    }
    if (!isRecord(m) || m['v'] !== def.version || !isRecord(m['value'])) return null
    const checked = def.schema['~standard'].validate({ ...def.initial, ...m['value'] })
    // An async schema counts as invalid, as in `persisted`.
    if (checked instanceof Promise || checked.issues !== undefined) return null
    return { value: checked.value, rev: typeof m['rev'] === 'string' ? m['rev'] : null }
  }

  // Resolution: pending patch, Query value, mirror (legacy `basalt:<key>` adopted), initial.
  const stored =
    mirrorKey === null ? null : (envelope(read(mirrorKey)) ?? envelope(read(`basalt:${def.key}`)))
  let remote: SyncedRemote<T> = env.remote ?? { value: null, rev: null }
  let value: T = { ...def.initial, ...(remote.value ?? stored?.value) }
  const server: SyncedSnapshot<T> = {
    value: { ...def.initial, ...remote.value },
    status: 'saved',
    rev: remote.rev,
  }

  let pending: Partial<T> = {}
  let flight: Partial<T> | null = null
  let failed: 'error' | 'offline' | null = null
  const touch: Record<string, number> = {} // per-field edit count: a load begun before an edit cannot undo it
  const editedAt: Record<string, number> = {}
  let seeded = false
  let saves = 0
  let debounce: unknown = null
  let dead = false
  let snap: SyncedSnapshot<T> | null = null
  let lastWritten: string | null = null
  const listeners = new Set<() => void>()
  const wakers = new Set<() => void>()
  let detach: (() => void) | null = null

  const status = (): SyncStatus =>
    failed ?? (flight !== null || hasKeys(pending) ? 'saving' : 'saved')
  function emit(): void {
    snap = null
    for (const cb of listeners) cb()
  }
  function writeMirror(): void {
    if (mirrorKey === null || !storage) return
    const raw = JSON.stringify({ v: def.version, value, rev: remote.rev })
    lastWritten = raw
    try {
      storage.setItem(mirrorKey, raw)
    } catch {
      // Full or blocked storage: memory still holds the value.
    }
  }
  // The mirror is written only when the value changes: a poll that brings nothing new stays silent.
  function commit(next: T): void {
    const changed = !same(next, value)
    value = next
    if (changed) writeMirror()
    emit()
  }
  const bump = (k: string, now: number): void => {
    touch[k] = (touch[k] ?? 0) + 1
    editedAt[k] = now
  }
  const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      const wake = (): void => {
        wakers.delete(wake)
        resolve()
      }
      wakers.add(wake)
      clock.setTimeout(wake, ms)
    })

  // The one writer: at most one save in flight, leftovers go out when it returns.
  function flush(keepalive = false): void {
    if (debounce !== null) clock.clearTimeout(debounce)
    debounce = null
    if (dead || flight !== null || !hasKeys(pending)) return
    const patch = pending
    pending = {}
    void send(patch, { value, rev: remote.rev }, keepalive)
  }

  async function attempt(
    first: Partial<T>,
    firstBase: SyncedRemote<T>,
    keepalive: boolean,
  ): Promise<{ value: T; rev: string }> {
    let patch = first
    let base = firstBase
    let rebased = false
    let failures = 0
    for (;;) {
      try {
        const once = keepalive && failures === 0 && !rebased
        return await transport.save(patch, base, { keepalive: once })
      } catch (error) {
        const code = statusOf(error)
        if (dead) throw error
        if (code !== undefined && CONFLICT.has(code)) {
          if (rebased) throw error
          rebased = true
          // Conflict: load, re-apply everything unsent on the fresh base, retry once.
          const fresh = await transport.load()
          if (dead) throw error
          patch = { ...patch, ...pending }
          pending = {}
          flight = patch
          remote = fresh
          base = { value: { ...value, ...fresh.value, ...patch }, rev: fresh.rev }
          commit(base.value as T)
          continue
        }
        if (permanent(code) || failures >= RETRIES) throw error
        failures += 1
        await delay(BACKOFF_MS * 2 ** (failures - 1))
        if (dead) throw error
      }
    }
  }

  async function send(patch: Partial<T>, base: SyncedRemote<T>, keepalive: boolean): Promise<void> {
    flight = patch
    failed = null
    emit()
    const sent = { ...touch }
    let res: { value: T; rev: string }
    try {
      res = await write(() => attempt(patch, base, keepalive))
    } catch {
      if (dead) return
      pending = { ...flight, ...pending }
      flight = null
      failed = online() ? 'error' : 'offline'
      emit()
      return
    }
    if (dead) return
    flight = null
    saves += 1
    remote = res
    env.onRemote?.(res)
    // A field edited here or in another tab since the save left keeps its local value.
    const next = { ...value } as Bag
    for (const [k, v] of Object.entries(res.value)) {
      if (touch[k] === sent[k] && !(k in pending)) next[k] = v
    }
    commit(next as T)
    if (debounce === null) flush()
  }

  // First device wins: once per session the mirror (else initial), with any edit, is saved whole.
  function seed(): void {
    if (seeded || flight !== null) return
    seeded = true
    if (debounce !== null) clock.clearTimeout(debounce)
    debounce = null
    pending = {}
    void send({ ...value }, { value: null, rev: null }, false)
  }

  async function load(): Promise<SyncedRemote<T>> {
    if (dead || mirrorKey === null || flight !== null || hasKeys(pending)) return remote
    const seen = { ...touch }
    const at = saves
    const res = await transport.load()
    if (dead) return res
    if (res.value === null) {
      if (saves === at) seed()
      return remote
    }
    // A save landed since this load began (its rev is newer), or the person is editing: skip.
    if (saves !== at || flight !== null || def.editing?.()) return remote
    remote = res
    const now = clock.now()
    const next = { ...value } as Bag
    for (const [k, v] of Object.entries(res.value)) {
      const edited = editedAt[k]
      const busy =
        k in pending || touch[k] !== seen[k] || (edited !== undefined && now - edited < SETTLE_MS)
      if (!busy) next[k] = v
    }
    commit(next as T)
    return remote
  }

  // Cross-tab: memory only, never a pending patch or a mirror write, so it cannot echo.
  function receive(raw: string | null): void {
    if (dead || raw === null || raw === lastWritten) return
    const m = envelope(raw)
    if (!m) return
    const now = clock.now()
    const next = { ...value } as Bag
    for (const [k, v] of Object.entries(m.value)) {
      if (k in pending || same(next[k], v)) continue
      next[k] = v
      bump(k, now)
    }
    remote = {
      value: remote.value === null ? null : ({ ...remote.value, ...m.value } as T),
      rev: m.rev ?? remote.rev,
    }
    value = next as T
    emit()
  }

  function connect(): () => void {
    if (mirrorKey === null) return () => {}
    const offs: (() => void)[] = []
    if (storage?.subscribe) {
      offs.push(
        storage.subscribe((key) => {
          if (key === null || key === mirrorKey) receive(read(mirrorKey))
        }),
      )
    } else if (typeof globalThis.addEventListener === 'function') {
      const onStorage = (e: StorageEvent): void => {
        if (e.key === mirrorKey && e.storageArea === (storage as unknown)) receive(e.newValue)
      }
      globalThis.addEventListener('storage', onStorage)
      offs.push(() => globalThis.removeEventListener('storage', onStorage))
    }
    const doc = globalThis.document as Document | undefined
    if (doc) {
      const onVisibility = (): void => {
        if (doc.visibilityState === 'hidden') flushHidden()
      }
      doc.addEventListener('visibilitychange', onVisibility)
      offs.push(() => doc.removeEventListener('visibilitychange', onVisibility))
    }
    return () => {
      for (const off of offs) off()
    }
  }

  function flushHidden(): void {
    flush(bytes(value) <= KEEPALIVE_MAX_BYTES)
  }

  return {
    owner,
    snapshot: () => (snap ??= { value, status: status(), rev: remote.rev }),
    serverSnapshot: () => server,
    subscribe(cb) {
      listeners.add(cb)
      if (listeners.size === 1 && !dead) detach = connect()
      return () => {
        listeners.delete(cb)
        if (listeners.size > 0) return
        detach?.()
        detach = null
      }
    },
    set(patch) {
      if (dead) return
      value = { ...value, ...patch }
      if (mirrorKey !== null) {
        const now = clock.now()
        for (const k of Object.keys(patch)) bump(k, now)
        pending = { ...pending, ...patch }
        failed = null
        writeMirror()
        if (debounce !== null) clock.clearTimeout(debounce)
        debounce = clock.setTimeout(() => flush(), debounceMs)
      }
      emit()
    },
    load,
    flushHidden,
    dispose() {
      if (dead) return
      dead = true
      if (debounce !== null) clock.clearTimeout(debounce)
      debounce = null
      for (const wake of wakers) wake()
      detach?.()
      detach = null
    },
  }
}
