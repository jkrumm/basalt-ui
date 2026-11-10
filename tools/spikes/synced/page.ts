// fallow-ignore-file
/**
 * Browser entry of spike 620, bundled in memory by run.ts. Exposes `window.__spike`: a virtual
 * scheduler, setItem / storage-event counters and helpers to build one synced instance per page.
 */
import { createSyncedState } from './core'
import type { Scheduler, Synced, Transport } from './core'
import { argoGym, GYM_INITIAL } from './flows/argo-gym'
import { eposSettings, EPOS_INITIAL } from './flows/epos-settings'

type Bag = Record<string, unknown>
type Timer = { id: number; at: number; fn: () => void }
type CreateOptions = {
  flow: string
  key: string
  owner: string | null
  pollMs?: number
  debounceMs?: number
  settleMs?: number
}

let now = 1_000_000
let nextId = 1
let timers: Timer[] = []
const scheduler: Scheduler = {
  now: () => now,
  setTimeout(fn, ms) {
    const id = nextId++
    timers.push({ id, at: now + ms, fn })
    return id
  },
  clearTimeout(id) {
    timers = timers.filter((t) => t.id !== id)
  },
}
const microtasks = async (): Promise<void> => {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}
async function advance(ms: number): Promise<void> {
  const target = now + ms
  for (;;) {
    const due = timers.filter((t) => t.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0]
    if (!due) break
    timers = timers.filter((t) => t !== due)
    now = due.at
    due.fn()
    await microtasks()
  }
  now = target
}

let setItems: Record<string, number> = {}
let events: Record<string, number> = {}
const setItem = Storage.prototype.setItem
Storage.prototype.setItem = function (key: string, value: string) {
  setItems[key] = (setItems[key] ?? 0) + 1
  return setItem.call(this, key, value)
}
window.addEventListener('storage', (e) => {
  if (e.key) events[e.key] = (events[e.key] ?? 0) + 1
})

let owner: string | null = null
let editing = false
let inst: Synced<Bag> | null = null
const instance = (): Synced<Bag> => {
  if (!inst) throw new Error('no instance')
  return inst
}

const FLOWS: Record<string, () => { transport: Transport<Bag>; initial: Bag }> = {
  argoGym: () => ({ transport: argoGym(() => owner) as Transport<Bag>, initial: GYM_INITIAL }),
  eposSettings: () => ({
    transport: eposSettings(() => owner) as Transport<Bag>,
    initial: EPOS_INITIAL,
  }),
}

const spike = {
  create(c: CreateOptions): void {
    owner = c.owner
    const flow = FLOWS[c.flow]?.()
    if (!flow) throw new Error(`unknown flow ${c.flow}`)
    inst = createSyncedState<Bag>({
      key: c.key,
      version: 1,
      initial: flow.initial,
      owner: () => owner,
      transport: flow.transport,
      scheduler,
      pollMs: c.pollMs,
      debounceMs: c.debounceMs,
      settleMs: c.settleMs,
      editing: () => editing,
    })
  },
  start: (): void => instance().start(),
  set: (patch: Bag): void => instance().set(patch),
  get: () => instance().get(),
  refresh(): void {
    void instance().refresh()
  },
  setOwner(next: string | null): void {
    owner = next
  },
  setEditing(next: boolean): void {
    editing = next
  },
  advance,
  dump: (): Record<string, string | null> =>
    Object.fromEntries(
      Object.keys(localStorage)
        .sort()
        .map((k) => [k, localStorage.getItem(k)]),
    ),
  counts: () => ({ setItems: { ...setItems }, events: { ...events } }),
  resetCounts(): void {
    setItems = {}
    events = {}
  },
}
;(window as unknown as { __spike: typeof spike }).__spike = spike
