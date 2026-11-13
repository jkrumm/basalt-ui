/**
 * The `createSyncedState` transport contract suite (state-persistence-forms 9, spike S1 in
 * docs/v3/spikes/synced.md). The session runs on a virtual scheduler against fake servers reached
 * through a fake HTTP channel, and two tabs share one fake storage whose `subscribe` plays the
 * `storage` event. Two transports, synthesised from the argo gym and epos settings shapes, run on
 * the same core: an LWW whole-state PUT with `rev` from `updated_at`, and a per-field PUT whose
 * server answers `{}`. A third, versioned transport carries the 409 rebase.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import type { StorageLike } from '../core/ports'
import { KEEPALIVE_MAX_BYTES, SETTLE_MS, createSyncedSession } from './synced-runtime'
import type { SyncedDefinition, SyncedSession, SyncedTransport } from './synced-runtime'

// ---- virtual scheduler ----------------------------------------------------------------------

const drain = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0))
}

function virtualClock() {
  let now = 0
  let seq = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  return {
    now: () => now,
    setTimeout(fn: () => void, ms: number): unknown {
      seq += 1
      timers.set(seq, { at: now + ms, fn })
      return seq
    },
    clearTimeout(id: unknown): void {
      timers.delete(id as number)
    },
    /** Runs every timer due within `ms`, in order, settling promises between them. */
    async advance(ms: number): Promise<void> {
      const end = now + ms
      for (;;) {
        await drain()
        const due = [...timers.entries()]
          .filter(([, t]) => t.at <= end)
          .toSorted(([a, x], [b, y]) => x.at - y.at || a - b)[0]
        if (!due) break
        timers.delete(due[0])
        now = due[1].at
        due[1].fn()
      }
      now = end
      await drain()
    },
  }
}
type Clock = ReturnType<typeof virtualClock>

// ---- fake HTTP channel ----------------------------------------------------------------------

type Request = { method: string; path: string; body: unknown; keepalive: boolean }
type Reply = { status: number; body: unknown }
type Http = (
  method: string,
  path: string,
  body?: unknown,
  init?: { keepalive: boolean },
) => Promise<unknown>

/**
 * A server reached through `http`. The reply is computed on arrival; `hold(method?)` parks the
 * delivery of every request (or one method's) until `release()`.
 */
function fakeChannel(handle: (req: Request) => Reply) {
  const log: Request[] = []
  let parked: (() => void)[] | null = null
  let holding: string | null = null
  let inFlight = 0
  let maxInFlight = 0
  const http: Http = async (method, path, body, init) => {
    const req = { method, path, body, keepalive: init?.keepalive ?? false }
    log.push(req)
    inFlight += 1
    maxInFlight = Math.max(maxInFlight, inFlight)
    const reply = handle(req)
    if (parked && (holding === null || holding === method)) {
      await new Promise<void>((r) => parked?.push(r))
    }
    inFlight -= 1
    if (reply.status >= 400) {
      throw Object.assign(new Error(`HTTP ${reply.status}`), { status: reply.status })
    }
    return reply.body
  }
  return {
    http,
    log,
    of: (method: string) => log.filter((r) => r.method === method),
    maxInFlight: () => maxInFlight,
    hold(method: string | null = null): void {
      parked = []
      holding = method
    },
    release(): void {
      const waiting = parked ?? []
      parked = null
      for (const go of waiting) go()
    },
  }
}

// ---- argo gym: whole-state GET/PUT, null until seeded, `updated_at` LWW, no 409 -------------

type Gym = { unit: 'kg' | 'lb'; rest: number; warmup: boolean; note: string }
const GYM: Gym = { unit: 'kg', rest: 90, warmup: false, note: '' }

function argoGymTransport(http: Http): SyncedTransport<Gym> {
  return {
    async load() {
      const row = (await http('GET', '/gym')) as { state: Gym | null; updated_at: string | null }
      return { value: row.state, rev: row.updated_at }
    },
    async save(patch, base, init) {
      const state = { ...GYM, ...base.value, ...patch }
      const row = (await http('PUT', '/gym', { state }, init)) as {
        state: Gym
        updated_at: string
      }
      return { value: row.state, rev: row.updated_at }
    },
  }
}

function argoServer(row: Gym | null) {
  const db = { row, stamp: 0 }
  const updatedAt = (): string => `2026-01-01T00:00:00.${String(db.stamp).padStart(3, '0')}Z`
  const channel = fakeChannel((req) => {
    if (req.method === 'PUT') {
      db.stamp += 1
      db.row = (req.body as { state: Gym }).state
    }
    return { status: 200, body: { state: db.row, updated_at: db.row ? updatedAt() : null } }
  })
  const remoteWrite = (fields: Partial<Gym>): void => {
    db.stamp += 1
    db.row = { ...GYM, ...db.row, ...fields }
  }
  return { ...channel, db, updatedAt, remoteWrite }
}

// ---- epos settings: per-field PUT answering `{}`, no rev, no poll ---------------------------

type Settings = { theme: string; send_key: string; level: string; density: string }
const SETTINGS: Settings = {
  theme: 'light',
  send_key: 'enter',
  level: 'normal',
  density: 'comfortable',
}

function eposSettingsTransport(http: Http): SyncedTransport<Settings> {
  // The server stamps nothing: any monotonic string is a valid rev, the core only stores it.
  let counter = 0
  return {
    async load() {
      return { value: (await http('GET', '/settings')) as Settings, rev: null }
    },
    async save(patch, base, init) {
      await http('PUT', '/settings', patch, init)
      counter += 1
      return { value: { ...SETTINGS, ...base.value, ...patch }, rev: String(counter) }
    },
  }
}

function eposServer(values: Settings = SETTINGS) {
  const db = { values }
  const channel = fakeChannel((req) => {
    if (req.method === 'PUT') db.values = { ...db.values, ...(req.body as Partial<Settings>) }
    return { status: 200, body: req.method === 'PUT' ? {} : { ...db.values } }
  })
  const remoteWrite = (fields: Partial<Settings>): void => {
    db.values = { ...db.values, ...fields }
  }
  return { ...channel, db, remoteWrite }
}

// ---- a versioned server: PATCH {patch, baseRev}, 409 on a stale base -------------------------

type Pair = { a: string; b: string }
const PAIR: Pair = { a: 'a0', b: 'b0' }

function versionedServer(opts: { alwaysConflict?: boolean } = {}) {
  const db = { value: PAIR, rev: 1 }
  const channel = fakeChannel((req) => {
    if (req.method === 'GET') return { status: 200, body: { value: db.value, rev: String(db.rev) } }
    // Another device always writes between this client's GET and its PATCH.
    if (opts.alwaysConflict) db.rev += 1
    const { patch, baseRev } = req.body as { patch: Partial<Pair>; baseRev: string | null }
    if (baseRev !== String(db.rev)) return { status: 409, body: null }
    db.rev += 1
    db.value = { ...db.value, ...patch }
    return { status: 200, body: { value: db.value, rev: String(db.rev) } }
  })
  const transport: SyncedTransport<Pair> = {
    load: async () => (await channel.http('GET', '/pair')) as { value: Pair; rev: string },
    save: async (patch, base) =>
      (await channel.http('PATCH', '/pair', { patch, baseRev: base.rev })) as {
        value: Pair
        rev: string
      },
  }
  const remoteWrite = (fields: Partial<Pair>): void => {
    db.rev += 1
    db.value = { ...db.value, ...fields }
  }
  return { ...channel, db, transport, remoteWrite }
}

// ---- storage: one fake origin, a `subscribe` per tab ------------------------------------------

function sharedStorage() {
  const data = new Map<string, string>()
  const tabs: { subs: Set<(key: string | null) => void>; writes: string[] }[] = []
  function tab(): StorageLike & { writes: string[] } {
    const me = { subs: new Set<(key: string | null) => void>(), writes: [] as string[] }
    tabs.push(me)
    return {
      writes: me.writes,
      getItem: (key) => data.get(key) ?? null,
      setItem(key, value) {
        me.writes.push(key)
        data.set(key, value)
        // Like the `storage` event: other tabs only, never the writer, delivered as a task.
        for (const other of tabs) {
          if (other !== me) setTimeout(() => other.subs.forEach((cb) => cb(key)), 0)
        }
      },
      removeItem: (key) => void data.delete(key),
      subscribe(cb) {
        me.subs.add(cb)
        return () => me.subs.delete(cb)
      },
    }
  }
  return { data, tab }
}

const mirror = (value: unknown, rev: string | null = null): string =>
  JSON.stringify({ v: 1, value, rev })

const accept = <T>() => ({
  '~standard': { validate: (value: unknown) => ({ value: value as T }) },
})

// ---- sessions ---------------------------------------------------------------------------------

const open: SyncedSession<unknown>[] = []
afterEach(() => {
  for (const s of open.splice(0)) s.dispose()
})

function session<T extends object>(o: {
  key: string
  initial: T
  transport: SyncedTransport<T>
  clock: Clock
  storage: StorageLike
  owner?: string | null
  editing?: () => boolean
  online?: () => boolean
}): SyncedSession<T> {
  const def: SyncedDefinition<T> = {
    key: o.key,
    version: 1,
    schema: accept<T>(),
    initial: o.initial,
    transport: o.transport,
    ...(o.editing && { editing: o.editing }),
  }
  const s = createSyncedSession(def, {
    owner: o.owner === undefined ? 'u1' : o.owner,
    storage: o.storage,
    scheduler: o.clock,
    online: o.online ?? (() => true),
  })
  s.subscribe(() => {})
  open.push(s as SyncedSession<unknown>)
  return s
}

const gymTab = (server: ReturnType<typeof argoServer>, clock: Clock, storage: StorageLike) =>
  session({ key: 'gym', initial: GYM, transport: argoGymTransport(server.http), clock, storage })
const eposTab = (
  server: ReturnType<typeof eposServer>,
  clock: Clock,
  storage: StorageLike,
  editing?: () => boolean,
) =>
  session({
    key: 'settings',
    initial: SETTINGS,
    transport: eposSettingsTransport(server.http),
    clock,
    storage,
    ...(editing && { editing }),
  })

// ---- the suite --------------------------------------------------------------------------------

describe('synced contract: null server seeds from the mirror once', () => {
  test('an un-seeded row takes the mirror whole in one PUT; rev is its updated_at', async () => {
    const server = argoServer(null)
    const clock = virtualClock()
    const store = sharedStorage()
    const local: Gym = { unit: 'lb', rest: 120, warmup: true, note: 'legacy' }
    store.data.set('basalt:u1:gym', mirror(local))
    const s = gymTab(server, clock, store.tab())
    await s.load()
    await clock.advance(0)
    expect(server.of('PUT')).toHaveLength(1)
    expect(server.of('PUT')[0]?.body).toEqual({ state: local })
    expect(s.snapshot().rev).toBe(server.updatedAt())
    // Another device clears the row: this session never seeds twice.
    server.db.row = null
    await s.load()
    await clock.advance(1000)
    expect(server.of('PUT')).toHaveLength(1)
  })

  test('the legacy `basalt:<key>` mirror seeds when the owner key is absent', async () => {
    const server = argoServer(null)
    const clock = virtualClock()
    const store = sharedStorage()
    store.data.set('basalt:gym', mirror({ ...GYM, unit: 'lb' }))
    const s = gymTab(server, clock, store.tab())
    await s.load()
    await clock.advance(0)
    expect(server.of('PUT')[0]?.body).toEqual({ state: { ...GYM, unit: 'lb' } })
  })

  test('a seeded row is never overwritten by the seed', async () => {
    const server = argoServer({ ...GYM, rest: 60 })
    const clock = virtualClock()
    const store = sharedStorage()
    store.data.set('basalt:u1:gym', mirror({ ...GYM, rest: 150 }))
    const s = gymTab(server, clock, store.tab())
    await s.load()
    await clock.advance(SETTLE_MS)
    expect(server.of('PUT')).toHaveLength(0)
    expect(s.snapshot().value.rest).toBe(60)
  })
})

describe('synced contract: poll pauses while saving', () => {
  test('no GET while a patch is pending or a PUT is in flight', async () => {
    const server = argoServer(GYM)
    const clock = virtualClock()
    const s = gymTab(server, clock, sharedStorage().tab())
    await s.load()
    expect(server.of('GET')).toHaveLength(1)
    s.set({ rest: 100 })
    await s.load() // inside the debounce window
    expect(server.of('GET')).toHaveLength(1)
    server.hold()
    await clock.advance(600)
    expect(server.of('PUT')).toHaveLength(1)
    await s.load() // PUT parked
    expect(server.of('GET')).toHaveLength(1)
    server.release()
    await clock.advance(0)
    await s.load()
    expect(server.of('GET')).toHaveLength(2)
  })
})

describe('synced contract: serial order', () => {
  test('one PUT in flight; the second carries the latest values after the first returns', async () => {
    const server = eposServer()
    const clock = virtualClock()
    const s = eposTab(server, clock, sharedStorage().tab())
    await s.load()
    server.hold()
    s.set({ send_key: 'shift-enter' })
    await clock.advance(600)
    s.set({ send_key: 'mod-enter', density: 'compact' })
    await clock.advance(600)
    expect(server.of('PUT')).toHaveLength(1)
    server.release()
    await clock.advance(0)
    expect(server.maxInFlight()).toBe(1)
    expect(server.of('PUT').map((r) => r.body)).toEqual([
      { send_key: 'shift-enter' },
      { send_key: 'mod-enter', density: 'compact' },
    ])
    expect(server.db.values).toEqual(s.snapshot().value)
    expect(s.snapshot().status).toBe('saved')
  })
})

describe('synced contract: 409 rebase', () => {
  test('a stale base loads, re-applies the unsent patch and retries once', async () => {
    const server = versionedServer()
    const clock = virtualClock()
    const s = session({
      key: 'pair',
      initial: PAIR,
      transport: server.transport,
      clock,
      storage: sharedStorage().tab(),
    })
    await s.load()
    server.remoteWrite({ a: 'other device' })
    s.set({ b: 'mine' })
    await clock.advance(600)
    expect(server.of('PATCH').map((r) => (r.body as { baseRev: string }).baseRev)).toEqual([
      '1',
      '2',
    ])
    expect(server.db.value).toEqual({ a: 'other device', b: 'mine' })
    expect(s.snapshot()).toEqual({ value: server.db.value, status: 'saved', rev: '3' })
  })

  test('a second conflict ends in error with the patch kept for the next set', async () => {
    const server = versionedServer({ alwaysConflict: true })
    const clock = virtualClock()
    const s = session({
      key: 'pair',
      initial: PAIR,
      transport: server.transport,
      clock,
      storage: sharedStorage().tab(),
    })
    await s.load()
    server.db.rev += 1
    s.set({ b: 'mine' })
    await clock.advance(600)
    expect(server.of('PATCH')).toHaveLength(2)
    expect(s.snapshot().status).toBe('error')
    s.set({ a: 'next' })
    await clock.advance(600)
    expect(server.of('PATCH')[2]?.body).toMatchObject({ patch: { b: 'mine', a: 'next' } })
  })
})

describe('synced contract: LWW transport, rev from updated_at', () => {
  test('revs follow updated_at; a stale-base PUT wins; a remote edit waits for the settle', async () => {
    const server = argoServer(GYM)
    const clock = virtualClock()
    const s = gymTab(server, clock, sharedStorage().tab())
    await s.load()
    s.set({ rest: 100 })
    await clock.advance(600)
    const first = s.snapshot().rev
    expect(first).toBe(server.updatedAt())
    server.remoteWrite({ rest: 45 }) // another device, after our save
    s.set({ warmup: true })
    await clock.advance(600)
    const second = s.snapshot().rev
    expect(second! > first!).toBe(true)
    // Last write wins: the whole-state PUT from the stale base overwrote the other device.
    expect(server.db.row).toEqual({ ...GYM, rest: 100, warmup: true })
    server.remoteWrite({ warmup: false, unit: 'lb' })
    await s.load() // 600 ms after the warmup edit
    expect(s.snapshot().value).toMatchObject({ warmup: true, unit: 'lb' })
    await clock.advance(SETTLE_MS)
    await s.load()
    expect(s.snapshot().value).toMatchObject({ warmup: false, unit: 'lb' })
    expect(s.snapshot().rev! > second!).toBe(true)
  })
})

describe('synced contract: per-field changedAt transport', () => {
  test('a read in flight adopts the other fields and keeps the edited one; PUT sends only it', async () => {
    const server = eposServer()
    const clock = virtualClock()
    const s = eposTab(server, clock, sharedStorage().tab())
    await s.load()
    server.remoteWrite({ theme: 'dark', density: 'cozy' })
    server.hold()
    const read = s.load()
    s.set({ density: 'compact' })
    server.release()
    await read
    expect(s.snapshot().value).toMatchObject({ theme: 'dark', density: 'compact' })
    await clock.advance(600)
    expect(server.of('PUT').map((r) => Object.keys(r.body as object))).toEqual([['density']])
  })

  test('a stale snapshot landing 3 s after the save leaves the field', async () => {
    const server = eposServer()
    const clock = virtualClock()
    const s = eposTab(server, clock, sharedStorage().tab())
    await s.load()
    server.hold()
    const stale = s.load() // snapshot taken before the edit
    s.set({ density: 'compact' })
    server.release()
    await stale
    server.hold()
    const late = s.load() // nothing pending: this GET goes out and is parked
    await clock.advance(0)
    server.release()
    await late
    await clock.advance(600 + 3000)
    expect(s.snapshot().value.density).toBe('compact')
  })
})

describe('synced contract: a load that lands after a save', () => {
  test('never regresses rev or the saved value', async () => {
    const server = argoServer(GYM)
    const clock = virtualClock()
    const s = gymTab(server, clock, sharedStorage().tab())
    await s.load()
    server.hold('GET')
    const slow = s.load() // its reply carries the row as it was before the save
    s.set({ rest: 100 })
    await clock.advance(600 + SETTLE_MS)
    const saved = server.updatedAt()
    expect(s.snapshot().rev).toBe(saved)
    server.release()
    await slow
    expect(s.snapshot().rev).toBe(saved)
    expect(s.snapshot().value.rest).toBe(100)
  })
})

describe('synced contract: remote ignored while editing()', () => {
  test('a remote value waits until editing() is false and the settle passed', async () => {
    const server = eposServer()
    const clock = virtualClock()
    let editing = true
    const s = eposTab(server, clock, sharedStorage().tab(), () => editing)
    server.remoteWrite({ theme: 'dark' })
    await s.load()
    expect(s.snapshot().value.theme).toBe('light')
    editing = false
    await s.load()
    expect(s.snapshot().value.theme).toBe('dark')
  })
})

const hide = (): void => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
  document.dispatchEvent(new Event('visibilitychange'))
  delete (document as { visibilityState?: unknown }).visibilityState
}

/** A gym value whose JSON is exactly `bytes` long. */
const sized = (bytes: number): Gym => {
  const empty = new TextEncoder().encode(JSON.stringify({ ...GYM, note: '' })).byteLength
  return { ...GYM, note: 'x'.repeat(bytes - empty) }
}

describe('synced contract: hide flush with a 64 KiB body', () => {
  test('a hidden tab sends the pending patch at once with keepalive up to 64 KiB', async () => {
    const server = argoServer(GYM)
    const clock = virtualClock()
    const s = gymTab(server, clock, sharedStorage().tab())
    await s.load()
    s.set(sized(KEEPALIVE_MAX_BYTES))
    hide()
    await clock.advance(0)
    expect(server.of('PUT')).toHaveLength(1)
    expect(server.of('PUT')[0]?.keepalive).toBe(true)
    const body = server.of('PUT')[0]?.body as { state: Gym } | undefined
    expect(JSON.stringify(body?.state)).toHaveLength(KEEPALIVE_MAX_BYTES)
  })

  test('one byte over 64 KiB goes as a normal request, best effort', async () => {
    const server = argoServer(GYM)
    const clock = virtualClock()
    const s = gymTab(server, clock, sharedStorage().tab())
    await s.load()
    s.set(sized(KEEPALIVE_MAX_BYTES + 1))
    hide()
    await clock.advance(0)
    expect(server.of('PUT')).toHaveLength(1)
    expect(server.of('PUT')[0]?.keepalive).toBe(false)
  })
})

describe('synced contract: no echo across two tabs', () => {
  test('the other tab shows the edit, writes nothing and sends nothing', async () => {
    const server = eposServer()
    const clock = virtualClock()
    const store = sharedStorage()
    const tabA = store.tab()
    const tabB = store.tab()
    const a = eposTab(server, clock, tabA)
    const b = eposTab(server, clock, tabB)
    await Promise.all([a.load(), b.load()])
    a.set({ theme: 'dark' })
    await clock.advance(SETTLE_MS)
    expect(b.snapshot().value.theme).toBe('dark')
    expect(tabB.writes).toHaveLength(0)
    expect(server.of('PUT')).toHaveLength(1)
  })
})

describe('synced contract: two-tab edit-then-edit keeps both fields', () => {
  test('argo: the whole-state PUT of tab B carries the field tab A set', async () => {
    const server = argoServer(GYM)
    const clock = virtualClock()
    const store = sharedStorage()
    const a = gymTab(server, clock, store.tab())
    const b = gymTab(server, clock, store.tab())
    await Promise.all([a.load(), b.load()])
    a.set({ unit: 'lb' })
    await clock.advance(600)
    b.set({ rest: 150 })
    await clock.advance(600 + SETTLE_MS)
    const both: Gym = { ...GYM, unit: 'lb', rest: 150 }
    expect(server.db.row).toEqual(both)
    expect(a.snapshot().value).toEqual(both)
    expect(b.snapshot().value).toEqual(both)
  })

  test('epos: tab B synthesises its result from a base that holds tab A’s field', async () => {
    const server = eposServer()
    const clock = virtualClock()
    const store = sharedStorage()
    const a = eposTab(server, clock, store.tab())
    const b = eposTab(server, clock, store.tab())
    await Promise.all([a.load(), b.load()])
    a.set({ theme: 'dark' })
    await clock.advance(600)
    b.set({ density: 'compact' })
    await clock.advance(600 + SETTLE_MS)
    const both = { ...SETTINGS, theme: 'dark', density: 'compact' }
    expect(server.db.values).toEqual(both)
    expect(a.snapshot().value).toEqual(both)
    expect(b.snapshot().value).toEqual(both)
  })

  test('a field from the other tab that arrives while a save is in flight survives its result', async () => {
    const server = eposServer()
    const clock = virtualClock()
    const store = sharedStorage()
    const a = eposTab(server, clock, store.tab())
    const b = eposTab(server, clock, store.tab())
    await Promise.all([a.load(), b.load()])
    server.hold('PUT')
    b.set({ density: 'compact' })
    await clock.advance(600) // B's PUT is parked; its result will be built from theme 'light'
    a.set({ theme: 'dark' })
    await clock.advance(0)
    expect(b.snapshot().value.theme).toBe('dark')
    server.release()
    await clock.advance(600)
    server.release()
    await clock.advance(SETTLE_MS)
    const both = { ...SETTINGS, theme: 'dark', density: 'compact' }
    expect(b.snapshot().value).toEqual(both)
    expect(a.snapshot().value).toEqual(both)
    expect(server.db.values).toEqual(both)
  })
})

describe('synced contract: owner switch isolates keys', () => {
  test('the next owner reads its own mirror; the previous owner’s unsent edit is dropped', async () => {
    const server = eposServer()
    const clock = virtualClock()
    const store = sharedStorage()
    store.data.set('basalt:u2:settings', mirror({ ...SETTINGS, level: 'expert' }))
    const tab = store.tab()
    const first = eposTab(server, clock, tab)
    first.set({ theme: 'dark' })
    first.dispose() // owner switch before the debounce fires
    const second = session({
      key: 'settings',
      initial: SETTINGS,
      transport: eposSettingsTransport(server.http),
      clock,
      storage: tab,
      owner: 'u2',
    })
    expect(second.snapshot().value).toEqual({ ...SETTINGS, level: 'expert' })
    await clock.advance(SETTLE_MS)
    expect(server.of('PUT')).toHaveLength(0)
    expect(JSON.parse(store.data.get('basalt:u1:settings') ?? '{}').value.theme).toBe('dark')
    expect(JSON.parse(store.data.get('basalt:u2:settings') ?? '{}').value.theme).toBe('light')
  })

  test('a save that returns after the switch touches nothing of the next owner', async () => {
    const server = eposServer()
    const clock = virtualClock()
    const tab = sharedStorage().tab()
    const first = eposTab(server, clock, tab)
    server.hold()
    first.set({ theme: 'dark' })
    await clock.advance(600)
    first.dispose()
    const second = session({
      key: 'settings',
      initial: SETTINGS,
      transport: eposSettingsTransport(server.http),
      clock,
      storage: tab,
      owner: 'u2',
    })
    server.release()
    await clock.advance(0)
    expect(second.snapshot()).toEqual({ value: SETTINGS, status: 'saved', rev: null })
  })
})

describe('synced contract: base before the first load', () => {
  test('an edit before the first load PUTs over the resolved mirror, not initial', async () => {
    const server = argoServer({ ...GYM, unit: 'lb', rest: 120 })
    const clock = virtualClock()
    const store = sharedStorage()
    store.data.set('basalt:u1:gym', mirror({ ...GYM, unit: 'lb', rest: 120 }))
    const s = gymTab(server, clock, store.tab())
    s.set({ warmup: true })
    await clock.advance(600)
    expect(server.of('PUT')[0]?.body).toEqual({
      state: { ...GYM, unit: 'lb', rest: 120, warmup: true },
    })
  })
})

describe('synced contract: failed writes', () => {
  test('a failed write retries 3 times with backoff, then error; the next set sends both', async () => {
    let fail = true
    const channel = fakeChannel((req) =>
      req.method === 'PUT' && fail ? { status: 503, body: null } : { status: 200, body: {} },
    )
    const clock = virtualClock()
    const s = session({
      key: 'settings',
      initial: SETTINGS,
      transport: eposSettingsTransport(channel.http),
      clock,
      storage: sharedStorage().tab(),
    })
    s.set({ theme: 'dark' })
    await clock.advance(600)
    expect(channel.of('PUT')).toHaveLength(1)
    await clock.advance(1000 + 2000)
    expect(channel.of('PUT')).toHaveLength(3)
    expect(s.snapshot().status).toBe('saving')
    await clock.advance(4000)
    expect(channel.of('PUT')).toHaveLength(4)
    expect(s.snapshot().status).toBe('error')
    fail = false
    s.set({ level: 'expert' })
    await clock.advance(600)
    expect(channel.of('PUT')[4]?.body).toEqual({ theme: 'dark', level: 'expert' })
    expect(s.snapshot().status).toBe('saved')
  })

  test('a 4xx is not retried; without a network the status is offline', async () => {
    const channel = fakeChannel(() => ({ status: 422, body: null }))
    const clock = virtualClock()
    const s = session({
      key: 'settings',
      initial: SETTINGS,
      transport: eposSettingsTransport(channel.http),
      clock,
      storage: sharedStorage().tab(),
      online: () => false,
    })
    s.set({ theme: 'dark' })
    await clock.advance(600 + 10_000)
    expect(channel.of('PUT')).toHaveLength(1)
    expect(s.snapshot().status).toBe('offline')
  })
})

describe('synced contract: loss', () => {
  test('an edit unsent at reload is lost: the server value wins and nothing is sent', async () => {
    const server = argoServer({ ...GYM, rest: 60 })
    const clock = virtualClock()
    const store = sharedStorage()
    const before = gymTab(server, clock, store.tab())
    await before.load()
    before.set({ rest: 200 })
    before.dispose() // the page reloads inside the debounce window, no hide event
    const after = gymTab(server, clock, store.tab())
    expect(after.snapshot().value.rest).toBe(200) // the mirror shows it until the load
    await after.load()
    await clock.advance(SETTLE_MS)
    expect(after.snapshot().value.rest).toBe(60)
    expect(server.of('PUT')).toHaveLength(0)
  })
})
