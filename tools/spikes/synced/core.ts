// fallow-ignore-file
/**
 * Spike 620 (docs/v3/concepts/state-persistence-forms.md section 6, falsifier S1): the throwaway
 * `createSyncedState` core. Browser-safe, no React, no Query: the scheduler, storage and transport
 * are injected. Each flow supplies only a transport.
 */
export type Scheduler = {
  now(): number
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(id: unknown): void
}
export type Rev = string | null
export type Remote<T> = { value: T | null; rev: Rev }
export type Transport<T> = {
  load(): Promise<Remote<T>> // null value = un-seeded server
  save(patch: Partial<T>, base: Remote<T>): Promise<{ value: T; rev: string }>
}
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>
export type Status = 'idle' | 'saving' | 'error'
export type Synced<T> = {
  get(): { value: T; status: Status; rev: Rev }
  set(patch: Partial<T>): void
  refresh(): Promise<void>
  start(): void
  dispose(): void
}
export type SyncedOptions<T> = {
  key: string
  version: number
  initial: T
  owner: () => string | null
  transport: Transport<T>
  scheduler: Scheduler
  pollMs?: number
  editing?: () => boolean
  storage?: StorageLike
  debounceMs?: number
  settleMs?: number
}

type Bag = Record<string, unknown>
type Runtime<T> = {
  owner: string | null
  value: T
  remote: Remote<T>
  pending: Partial<T>
  flight: Partial<T> | null
  status: Status
  touch: Bag // per-field edit counter: a load that began before an edit must not undo it
  editedAt: Bag
  seeded: boolean
  debounce: unknown
  poll: unknown
}

const canon = (v: unknown): string =>
  JSON.stringify(v, (_, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)))
      : x,
  )
const same = (a: unknown, b: unknown): boolean => canon(a) === canon(b)
const hasKeys = (o: object): boolean => Object.keys(o).length > 0

export function createSyncedState<T extends object>(o: SyncedOptions<T>): Synced<T> {
  const { scheduler: clock, transport } = o
  const debounceMs = o.debounceMs ?? 600
  const settleMs = o.settleMs ?? 2000
  const store = (): StorageLike => o.storage ?? localStorage
  const mirrorKey = (owner: string): string => `basalt:${owner}:${o.key}`
  let started = false
  let disposed = false

  function parse(raw: string | null): T | null {
    if (!raw) return null
    try {
      const m = JSON.parse(raw) as { v?: unknown; value?: unknown } | null
      return m?.v === o.version && m.value && typeof m.value === 'object' ? (m.value as T) : null
    } catch {
      return null
    }
  }
  const mirrored = (owner: string | null): T => ({
    ...o.initial,
    ...(owner ? parse(store().getItem(mirrorKey(owner))) : null),
  })
  function writeMirror(r: Runtime<T>): void {
    if (r.owner)
      store().setItem(mirrorKey(r.owner), JSON.stringify({ v: o.version, value: r.value }))
  }

  function fresh(): Runtime<T> {
    const owner = o.owner()
    return {
      owner,
      value: mirrored(owner),
      remote: { value: null, rev: null },
      pending: {},
      flight: null,
      status: 'idle',
      touch: {},
      editedAt: {},
      seeded: false,
      debounce: null,
      poll: null,
    }
  }
  let rt = fresh()
  const live = (r: Runtime<T>): boolean => !disposed && r === rt
  const stop = (r: Runtime<T>): void => {
    if (r.debounce !== null) clock.clearTimeout(r.debounce)
    if (r.poll !== null) clock.clearTimeout(r.poll)
    r.debounce = r.poll = null
  }

  // The one writer: at most one save in flight, leftovers go out when it returns.
  function flush(r: Runtime<T>): void {
    if (r.debounce !== null) clock.clearTimeout(r.debounce)
    r.debounce = null
    if (!live(r) || !r.owner || r.flight || !hasKeys(r.pending)) return
    const patch = r.pending
    r.pending = {}
    void send(r, patch, r.remote)
  }
  async function send(r: Runtime<T>, patch: Partial<T>, base: Remote<T>): Promise<void> {
    r.flight = patch
    r.status = 'saving'
    let res: { value: T; rev: string }
    try {
      res = await transport.save(patch, base)
    } catch {
      if (!live(r)) return
      r.pending = { ...r.flight, ...r.pending }
      r.flight = null
      r.status = 'error'
      return
    }
    if (!live(r)) return
    r.flight = null
    r.status = 'idle'
    r.remote = res
    const next = { ...res.value, ...r.pending }
    if (!same(next, r.value)) {
      r.value = next
      writeMirror(r)
    }
    flush(r)
  }
  // First device wins: once per runtime the mirror (else initial) is saved whole.
  function seed(r: Runtime<T>): void {
    if (r.seeded || r.flight) return
    r.seeded = true
    void send(r, mirrored(r.owner), { value: null, rev: null })
  }

  // Adopt a load per field; busy fields (pending, in flight, touched since the load began, or edited
  // within settleMs) keep the local value. Never schedules a write.
  async function load(r: Runtime<T>): Promise<void> {
    const owner = r.owner
    if (!owner) return
    const seen = { ...r.touch }
    const res = await transport.load().catch(() => null)
    if (!res || !live(r) || o.owner() !== owner || o.editing?.()) return
    if (res.value === null) return seed(r)
    r.remote = res
    const now = clock.now()
    const next = { ...r.value } as Bag
    for (const [k, v] of Object.entries(res.value)) {
      const editedAt = r.editedAt[k] as number | undefined
      const busy =
        k in r.pending ||
        (r.flight !== null && k in r.flight) ||
        r.touch[k] !== seen[k] ||
        (editedAt !== undefined && now - editedAt < settleMs)
      if (!busy && !same(next[k], v)) next[k] = v
    }
    if (same(next, r.value)) return
    r.value = next as T
    writeMirror(r)
  }

  function schedulePoll(r: Runtime<T>): void {
    if (o.pollMs) r.poll = clock.setTimeout(() => tick(r), o.pollMs)
  }
  function tick(r: Runtime<T>): void {
    if (!live(r)) return
    schedulePoll(r)
    if (r.flight || hasKeys(r.pending)) return // poll pauses while saving
    void load(r)
  }

  // Cross-tab: memory only. No pending patch, no mirror write, so it can never echo.
  function onStorage(e: StorageEvent): void {
    const r = rt
    if (!r.owner || e.key !== mirrorKey(r.owner)) return
    const m = parse(e.newValue)
    if (m) r.value = { ...m, ...r.pending }
  }

  return {
    get: () => ({ value: rt.value, status: rt.status, rev: rt.remote.rev }),
    set(patch) {
      const r = rt
      r.value = { ...r.value, ...patch }
      if (!r.owner) return
      const now = clock.now()
      for (const k of Object.keys(patch)) {
        r.touch[k] = ((r.touch[k] as number | undefined) ?? 0) + 1
        r.editedAt[k] = now
      }
      r.pending = { ...r.pending, ...patch }
      writeMirror(r)
      if (r.debounce !== null) clock.clearTimeout(r.debounce)
      r.debounce = clock.setTimeout(() => flush(r), debounceMs)
    },
    async refresh() {
      if (o.owner() !== rt.owner) {
        stop(rt)
        rt = fresh()
        if (started) schedulePoll(rt)
      }
      await load(rt)
    },
    start() {
      if (started || disposed) return
      started = true
      globalThis.addEventListener('storage', onStorage)
      schedulePoll(rt)
      void load(rt)
    },
    dispose() {
      disposed = true
      stop(rt)
      globalThis.removeEventListener('storage', onStorage)
    },
  }
}
