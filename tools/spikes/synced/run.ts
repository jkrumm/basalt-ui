// fallow-ignore-file
/**
 * Spike 620 (docs/v3/concepts/state-persistence-forms.md section 9, falsifier S1). Throwaway harness,
 * no tests.
 *
 * One minimal `createSyncedState` core (core.ts) with a transport per flow (flows/*.ts): can it serve
 * argo's gym flow (null seed, poll, server `updated_at`, last write wins) and epos's settings flow
 * (per-field PATCH, no rev, no poll, a client-side per-field guard) unchanged?
 *
 * Ledger: core.v0.ts is the frozen baseline written when the argo cases first went green. Epos runs on
 * v0 first (`eposOnV0`); every later edit of core.ts is a CORE_CHANGES entry. The argo suite runs on
 * both cores; the headline `argoGym` / `eposSettings` results use the final core.
 *
 * Prints ONE JSON object on stdout and always exits 0 (0 = the harness ran, not "hypothesis held").
 * Progress goes to stderr. Output is deterministic (virtual time, counter stamps, no clocks).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'
import type { Browser, BrowserContext, Page } from 'playwright-core'
import { GYM_INITIAL } from './flows/argo-gym'
import type { GymState } from './flows/argo-gym'
import { EPOS_INITIAL } from './flows/epos-settings'
import type { EposState } from './flows/epos-settings'

type Flow = 'argoGym' | 'eposSettings'
type Bag = Record<string, unknown>
type Method = 'GET' | 'PUT'
type Log = { seq: number; flow: Flow; method: Method; owner: string; body: unknown }
type Outcome = { checks: Record<string, boolean>; evidence: string; puts: number }
type CaseResult = { id: string; pass: boolean; evidence: string; puts: number }

const HERE = import.meta.dir
const ORIGIN = 'https://spike.test'
const log = (msg: string): void => void process.stderr.write(`${msg}\n`)
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const J = (v: unknown): string => JSON.stringify(v)
const eq = (a: unknown, b: unknown): boolean => J(sortKeys(a)) === J(sortKeys(b))
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys)
  if (!v || typeof v !== 'object') return v
  return Object.fromEntries(
    Object.entries(v)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, x]) => [k, sortKeys(x)]),
  )
}

// Core changes made after core.v0.ts was frozen (the epos stage). Empty = the baseline sufficed.
// tag `widening` only if the edit adds an OPTIONAL field to load's result or save's params/result and
// argo passes unchanged; anything else (new method, scheduler semantics, new option, a per-flow branch)
// is `core`.
const CORE_CHANGES: { id: string; what: string; why: string; tag: 'widening' | 'core' }[] = []

// ---- fake server (Node) -------------------------------------------------------------------------

type ArgoRow = { state: GymState | null; updated_at: string | null }

class FakeServer {
  log: Log[] = []
  argo = new Map<string, ArgoRow>()
  epos = new Map<string, Partial<EposState>>()
  inflight: Record<Method, number> = { GET: 0, PUT: 0 }
  maxInFlight: Record<Method, number> = { GET: 0, PUT: 0 }
  private stamps = 0
  constructor(readonly flow: Flow) {}
  private gate: { method: Method; mode: 'before' | 'after'; parked: (() => void)[] } | null = null

  private stamp(): string {
    return `2026-01-01T00:00:00.${String(++this.stamps).padStart(3, '0')}Z`
  }
  seedArgo(owner: string, state: GymState): void {
    this.argo.set(owner, { state, updated_at: this.stamp() })
  }
  /** An un-seeded argo server stays null; a seeded one (and any epos server) holds the defaults. */
  seed(owner: string): void {
    if (this.flow === 'argoGym') this.seedArgo(owner, GYM_INITIAL)
  }
  /** The whole state as the server holds it. */
  state(owner: string): Bag | null {
    if (this.flow === 'argoGym') return this.argo.get(owner)?.state ?? null
    return { ...EPOS_INITIAL, ...this.epos.get(owner) }
  }
  /** Another device writes. */
  remoteWrite(owner: string, patch: Bag): void {
    if (this.flow === 'eposSettings') {
      this.epos.set(owner, { ...this.epos.get(owner), ...patch })
      return
    }
    const row = this.argo.get(owner)
    const state = { ...(row?.state ?? GYM_INITIAL), ...patch } as GymState
    this.argo.set(owner, { state, updated_at: this.stamp() })
  }
  /** Park matching requests: 'before' = process at release, 'after' = process now, answer at release. */
  hold(method: Method, mode: 'before' | 'after' = 'before'): void {
    this.gate = { method, mode, parked: [] }
  }
  release(): void {
    const g = this.gate
    this.gate = null
    g?.parked.forEach((r) => r())
  }
  puts(owner?: string): Log[] {
    return this.log.filter((e) => e.method === 'PUT' && (!owner || e.owner === owner))
  }
  gets(owner?: string): Log[] {
    return this.log.filter((e) => e.method === 'GET' && (!owner || e.owner === owner))
  }

  async handle(flow: Flow, method: Method, owner: string, body: unknown): Promise<unknown> {
    this.log.push({ seq: this.log.length + 1, flow, method, owner, body })
    this.inflight[method]++
    this.maxInFlight[method] = Math.max(this.maxInFlight[method], this.inflight[method])
    const g = this.gate?.method === method ? this.gate : null
    const park = (): Promise<void> => new Promise((r) => g?.parked.push(r))
    if (g?.mode === 'before') await park()
    const res = structuredClone(this.apply(method, owner, body))
    if (g?.mode === 'after') await park()
    this.inflight[method]--
    return res
  }
  private apply(method: Method, owner: string, body: unknown): unknown {
    if (this.flow === 'eposSettings') {
      if (method === 'GET') return { ...this.state(owner), extra_hint: 'L0' }
      this.epos.set(owner, { ...this.epos.get(owner), ...(body as Partial<EposState>) })
      return {}
    }
    if (method === 'GET') return this.argo.get(owner) ?? { state: null, updated_at: null }
    const row = { state: body as GymState, updated_at: this.stamp() }
    this.argo.set(owner, row)
    return row
  }
}

// ---- browser plumbing ---------------------------------------------------------------------------

class Tab {
  constructor(readonly page: Page) {}
  private call<R>(name: string, ...args: unknown[]): Promise<R> {
    return this.page.evaluate(
      ([n, a]) =>
        (
          globalThis as unknown as { __spike: Record<string, (...x: unknown[]) => unknown> }
        ).__spike[n as string](...(a as unknown[])),
      [name, args] as const,
    ) as Promise<R>
  }
  create = (o: Bag): Promise<void> => this.call('create', o)
  start = (): Promise<void> => this.call('start')
  set = (p: Bag): Promise<void> => this.call('set', p)
  get = (): Promise<{ value: Bag; status: string; rev: string | null }> => this.call('get')
  refresh = (): Promise<void> => this.call('refresh')
  setOwner = (o: string | null): Promise<void> => this.call('setOwner', o)
  setEditing = (b: boolean): Promise<void> => this.call('setEditing', b)
  advance = (ms: number): Promise<void> => this.call('advance', ms)
  dump = (): Promise<Record<string, string | null>> => this.call('dump')
  counts = (): Promise<{ setItems: Record<string, number>; events: Record<string, number> }> =>
    this.call('counts')
  resetCounts = (): Promise<void> => this.call('resetCounts')
  /** The decoded mirror entry, or null. */
  async mirror(owner: string, key: string): Promise<Bag | null> {
    const raw = (await this.dump())[`basalt:${owner}:${key}`]
    return raw ? (JSON.parse(raw) as Bag) : null
  }
  /** Pre-write a mirror entry (setup only; callers reset the counters afterwards). */
  writeMirror(owner: string, key: string, value: Bag): Promise<void> {
    return this.page.evaluate(([k, v]) => localStorage.setItem(k, v), [
      `basalt:${owner}:${key}`,
      J({ v: 1, value }),
    ] as const)
  }
}

type Env = {
  server: FakeServer
  tab(): Promise<Tab>
  settle(): Promise<void>
  close(): Promise<void>
}
type Mk = () => Promise<Env>

async function newEnv(browser: Browser, bundle: string, flow: Flow): Promise<Env> {
  const context: BrowserContext = await browser.newContext()
  const server = new FakeServer(flow)
  await context.route(`${ORIGIN}/**`, async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    if (path !== (flow === 'argoGym' ? '/gym' : '/settings')) {
      return route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>spike</title>',
      })
    }
    const owner = req.headers()['x-owner'] ?? ''
    const body = await server.handle(flow, req.method() as Method, owner, req.postDataJSON())
    return route.fulfill({ contentType: 'application/json', body: J(body) })
  })
  return {
    server,
    async tab() {
      const page = await context.newPage()
      await page.goto(`${ORIGIN}/`)
      await page.addScriptTag({ content: bundle })
      return new Tab(page)
    },
    /** Wait until no request has arrived for two 10 ms windows (parked requests do not count). */
    async settle() {
      for (;;) {
        const n = server.log.length
        await sleep(10)
        await sleep(10)
        if (server.log.length === n) return
      }
    },
    async close() {
      server.release()
      await context.close()
    },
  }
}

async function bundleCore(core: 'core' | 'core.v0'): Promise<string> {
  const result = await Bun.build({
    entrypoints: [resolve(HERE, 'page.ts')],
    target: 'browser',
    format: 'iife',
    plugins: [
      {
        name: 'pick-core',
        setup(build) {
          build.onResolve({ filter: /^\.\/core$/ }, () => ({ path: resolve(HERE, `${core}.ts`) }))
        },
      },
    ],
  })
  if (!result.success) throw new Error(`bundle ${core}: ${result.logs.join('\n')}`)
  return result.outputs[0].text()
}

// ---- flow configuration -------------------------------------------------------------------------

type Cfg = {
  key: string
  initial: Bag
  pollMs?: number
  edit: { a: Bag; b: Bag; c: Bag }
  remote: Bag // a remote change touching edit.a's field, to a value no local edit uses
  other: Bag // a remote change to a field no local edit touches
}
const CFG: Record<Flow, Cfg> = {
  eposSettings: {
    key: 'settings',
    initial: EPOS_INITIAL,
    edit: { a: { theme: 'dark' }, b: { send_key: 'mod-enter' }, c: { density: 'compact' } },
    remote: { theme: 'light' },
    other: { level: 'expert' },
  },
  argoGym: {
    key: 'gym',
    initial: GYM_INITIAL,
    pollMs: 5000,
    edit: { a: { unit: 'lb' }, b: { restSec: 120 }, c: { note: 'c' } },
    remote: { unit: 'stone' },
    other: { barKg: 15 },
  },
}

async function boot(
  env: Env,
  flow: Flow,
  owner: string,
  opts: { seed?: boolean; start?: boolean } = {},
): Promise<Tab> {
  if (opts.seed !== false) env.server.seed(owner)
  const tab = await env.tab()
  await tab.create({ flow, key: CFG[flow].key, owner, pollMs: CFG[flow].pollMs })
  if (opts.start !== false) {
    await tab.start()
    await env.settle()
  }
  return tab
}
const verdict = (checks: Record<string, boolean>, evidence: string, puts: number): Outcome => {
  const failed = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name)
  return {
    checks,
    evidence: failed.length ? `${evidence} | FAILED ${failed.join(',')}` : evidence,
    puts,
  }
}

// ---- cases --------------------------------------------------------------------------------------

type CaseFn = (mk: Mk, flow: Flow) => Promise<Outcome>

const nullSeed: CaseFn = async (mk, flow) => {
  const MIRROR = { unit: 'lb', restSec: 75, barKg: 15, note: 'mirror' }
  const run = async (serverRow: GymState | null) => {
    const e = await mk()
    if (serverRow) e.server.seedArgo('alice', serverRow)
    else e.server.argo.set('alice', { state: null, updated_at: null })
    const t = await e.tab()
    await t.writeMirror('alice', CFG[flow].key, MIRROR)
    await t.create({ flow, key: CFG[flow].key, owner: 'alice', pollMs: 5000 })
    await t.start()
    await e.settle()
    for (let i = 0; i < 3; i++) {
      await t.refresh()
      await e.settle()
    }
    await t.advance(5000)
    await e.settle()
    return { e, got: await t.get() }
  }
  const empty = await run(null)
  const puts = empty.e.server.puts()
  const row = empty.e.server.argo.get('alice')
  const seeded = await run({ ...GYM_INITIAL, note: 'other-device' })
  const putsSeeded = seeded.e.server.puts().length
  return verdict(
    {
      onePut: puts.length === 1,
      bodyIsMirror: eq(puts[0]?.body, MIRROR),
      revIsStamp: !!row?.updated_at && empty.got.rev === row.updated_at,
      noPutWhenSeeded: putsSeeded === 0,
    },
    `null server: ${puts.length} PUT, body==mirror ${eq(puts[0]?.body, MIRROR)}, rev ${empty.got.rev} vs updated_at ${row?.updated_at}; non-null server: ${putsSeeded} PUT, value.note ${J(seeded.got.value.note)}`,
    puts.length,
  )
}

const pollPauses: CaseFn = async (mk, flow) => {
  const e = await mk()
  const t = await boot(e, flow, 'alice')
  const gets = (): number => e.server.gets().length
  const g0 = gets()
  await t.advance(5000)
  await e.settle()
  const g1 = gets()
  e.server.hold('PUT')
  await t.set({ restSec: 111 })
  await t.advance(600)
  await e.settle()
  const status = (await t.get()).status
  const putsParked = e.server.puts().length
  await t.advance(15000)
  await e.settle()
  const g2 = gets()
  const during = await t.get()
  e.server.release()
  await e.settle()
  await t.advance(5000)
  await e.settle()
  const g3 = gets()
  // Second half: the tick lands inside the debounce window, then the save is held.
  await t.advance(4100)
  e.server.hold('PUT')
  await t.set({ note: 'y' })
  await t.advance(300) // tick at +300: debounce (600) still armed, nothing sent yet
  await e.settle()
  const g4 = gets()
  await t.advance(5000)
  await e.settle()
  const g5 = gets()
  e.server.release()
  await e.settle()
  await t.advance(5000)
  await e.settle()
  const g6 = gets()
  return verdict(
    {
      pollRunsWhenIdle: g1 === g0 + 1,
      putInFlight: status === 'saving' && putsParked === 1,
      noGetWhileSaving: g2 === g1,
      localKeptWhileSaving: during.value.restSec === 111,
      pollResumes: g3 === g2 + 1,
      noGetInsideDebounce: g4 === g3,
      noGetWhileSecondSaveHeld: g5 === g3,
      pollResumesAfterSecond: g6 === g5 + 1,
    },
    `GETs idle ${g0}->${g1}; PUT held (status ${status}) 15000 ms later GETs ${g2}, restSec ${during.value.restSec}; after release +5000 -> ${g3}; inside debounce ${g4}; second save held ${g5}; resumed ${g6}`,
    e.server.puts().length,
  )
}

const serialOrder: CaseFn = async (mk, flow) => {
  const { a, b, c } = CFG[flow].edit
  const e = await mk()
  const t = await boot(e, flow, 'alice')
  e.server.hold('PUT')
  await t.set(a)
  await t.advance(700)
  await e.settle()
  await t.set(b)
  await t.advance(700)
  await e.settle()
  await t.set(c)
  await t.advance(700)
  await e.settle()
  const parked = e.server.puts().length
  e.server.release()
  await e.settle()
  const puts = e.server.puts()
  const local = await t.get()
  const expected = { ...CFG[flow].initial, ...a, ...b, ...c }
  const serverState = e.server.state('alice')
  const second = puts[1]?.body as Bag | undefined
  const carriesBC = !!second && Object.keys({ ...b, ...c }).every((k) => k in second)
  // argo bodies are whole states (each includes the earlier edits); epos bodies are patches of only the changed keys
  const whole = flow === 'argoGym'
  const wholeBodies = whole
    ? eq(puts[0]?.body, { ...CFG[flow].initial, ...a }) && eq(puts[1]?.body, expected)
    : eq(puts[0]?.body, a) && eq(puts[1]?.body, { ...b, ...c })
  return verdict(
    {
      oneInFlight: e.server.maxInFlight.PUT === 1 && parked === 1,
      twoPuts: puts.length === 2,
      secondCoalesced: carriesBC,
      bodiesAsExpected: wholeBodies,
      serverEqualsLocal: eq(serverState, local.value) && eq(local.value, expected),
      statusIdle: local.status === 'idle',
    },
    `maxInFlight(PUT) ${e.server.maxInFlight.PUT}, parked ${parked}, PUTs ${puts.length}, PUT#2 body ${J(puts[1]?.body)}, server==local ${eq(serverState, local.value)}`,
    puts.length,
  )
}

const lwwRev: CaseFn = async (mk, flow) => {
  const e = await mk()
  const t = await boot(e, flow, 'alice')
  await t.set({ unit: 'lb' })
  await t.advance(700)
  await e.settle()
  const r1 = (await t.get()).rev
  e.server.remoteWrite('alice', { restSec: 200 })
  const r2 = e.server.argo.get('alice')?.updated_at ?? ''
  await t.set({ note: 'local' }) // stale base: the remote restSec 200 is unknown here
  await t.advance(700)
  await e.settle()
  const r3 = e.server.argo.get('alice')?.updated_at ?? ''
  const after = await t.get()
  const serverState = e.server.argo.get('alice')?.state
  const expected = { ...GYM_INITIAL, unit: 'lb', note: 'local' }
  e.server.remoteWrite('alice', { note: 'remote2' })
  const r4 = e.server.argo.get('alice')?.updated_at ?? ''
  await t.refresh() // inside settleMs of the note edit
  await e.settle()
  const early = await t.get()
  await t.advance(5000) // past settleMs, and a poll tick
  await e.settle()
  const late = await t.get()
  return verdict(
    {
      revOrder: !!r1 && r2 > r1 && r3 > r2 && r4 > r3,
      staleBaseAccepted: e.server.puts().length === 2,
      serverHasLocalEdit: eq(serverState, expected) && eq(after.value, expected),
      localRevIsStamp: after.rev === r3,
      noAdoptInsideSettle: early.value.note === 'local',
      adoptsAfterSettle: late.value.note === 'remote2' && late.rev === r4,
    },
    `r1 ${r1} < r2 ${r2} < r3 ${r3}; PUTs ${e.server.puts().length}; server==local ${eq(serverState, after.value)}; local rev ${after.rev}; inside settle note ${J(early.value.note)}; after ${J(late.value.note)} rev ${late.rev} (remote ${r4})`,
    e.server.puts().length,
  )
}

const remoteIgnoredWhileEditing: CaseFn = async (mk, flow) => {
  const { a } = CFG[flow].edit
  const cfg = CFG[flow]
  const [field] = Object.keys(cfg.other)
  const e = await mk()
  const t = await boot(e, flow, 'alice')
  const trigger = async (): Promise<void> => {
    if (cfg.pollMs) await t.advance(cfg.pollMs)
    else await t.refresh()
    await e.settle()
  }
  const g0 = e.server.gets().length
  await t.setEditing(true)
  e.server.remoteWrite('alice', cfg.other)
  await trigger()
  const whileEditing = await t.get()
  const g1 = e.server.gets().length
  await t.setEditing(false)
  await t.advance(2500)
  await trigger()
  const adopted = await t.get()
  // Settle window: a field just saved is not replaced by a remote value until settleMs has passed.
  await t.set(a)
  await t.advance(700)
  await e.settle()
  e.server.remoteWrite('alice', cfg.remote)
  await t.refresh()
  await e.settle()
  const inside = await t.get()
  await t.advance(2000)
  await t.refresh()
  await e.settle()
  const outside = await t.get()
  const [aField] = Object.keys(a)
  return verdict(
    {
      fetchedWhileEditing: g1 > g0,
      unchangedWhileEditing: eq(whileEditing.value, cfg.initial),
      adoptedWhenFree: adopted.value[field] === cfg.other[field],
      heldInsideSettle: inside.value[aField] === a[aField],
      adoptedAfterSettle: outside.value[aField] === cfg.remote[aField],
    },
    `GETs while editing ${g1 - g0}, ${field} ${J(whileEditing.value[field])} -> free ${J(adopted.value[field])}; saved ${aField} inside settle ${J(inside.value[aField])}, after ${J(outside.value[aField])}`,
    e.server.puts().length,
  )
}

const noEchoTwoTabs: CaseFn = async (mk, flow) => {
  const { a } = CFG[flow].edit
  const key = `basalt:alice:${CFG[flow].key}`
  const e = await mk()
  e.server.seed('alice')
  const A = await boot(e, flow, 'alice', { seed: false })
  const B = await boot(e, flow, 'alice', { seed: false })
  await A.resetCounts()
  await B.resetCounts()
  await A.set(a)
  await A.advance(600)
  await e.settle()
  const bAfter = await B.get()
  const bCounts = await B.counts()
  const putsAfterSave = e.server.puts().length
  await A.advance(5000)
  await B.advance(5000)
  await e.settle()
  const aCounts = await A.counts()
  const bFinal = await B.counts()
  const [field] = Object.keys(a)
  return verdict(
    {
      bGotValue: bAfter.value[field] === a[field],
      bOneEvent: bCounts.events[key] === 1,
      bNoMirrorWrite: (bFinal.setItems[key] ?? 0) === 0,
      onePut: putsAfterSave === 1 && e.server.puts().length === 1,
      aReceivedNone: (aCounts.events[key] ?? 0) === 0,
    },
    `B ${field} ${J(bAfter.value[field])}, B storage events ${bCounts.events[key]}, B mirror setItem ${bFinal.setItems[key] ?? 0}, PUTs ${e.server.puts().length}, A storage events ${aCounts.events[key] ?? 0}`,
    e.server.puts().length,
  )
}

const ownerSwitchIsolates: CaseFn = async (mk, flow) => {
  const { a, b } = CFG[flow].edit
  const key = CFG[flow].key
  const e = await mk()
  e.server.seed('bob')
  const t = await boot(e, flow, 'alice')
  e.server.hold('PUT')
  await t.set(a)
  await t.advance(700)
  await e.settle()
  await t.setOwner('bob')
  await t.refresh()
  await e.settle()
  const bobBefore = await t.get()
  const bobMirrorBefore = await t.mirror('bob', key)
  e.server.release()
  await e.settle()
  const bobAfter = await t.get()
  const bobMirrorAfter = await t.mirror('bob', key)
  await t.set(b)
  await t.advance(700)
  await e.settle()
  const bobPut = e.server.puts('bob')
  const dump = await t.dump()
  const stored = (o: string): Bag =>
    (JSON.parse(dump[`basalt:${o}:${key}`] ?? 'null') as Bag | null) ?? {}
  const aliceStored = stored('alice').value as Bag
  const bobStored = stored('bob').value as Bag
  const expectedBob = { ...CFG[flow].initial, ...b }
  const bobBody = flow === 'argoGym' ? expectedBob : b // epos sends the patch
  return verdict(
    {
      bobStartsClean: eq(bobBefore.value, CFG[flow].initial),
      aliceResponseIgnored: eq(bobAfter, bobBefore) && bobMirrorAfter === null,
      bobMirrorUntouched: bobMirrorBefore === null,
      bobPutIsBobs: bobPut.length === 1 && eq(bobPut[0]?.body, bobBody),
      separateMirrors:
        eq(aliceStored, { ...CFG[flow].initial, ...a }) && eq(bobStored, expectedBob),
      serverNotMixed:
        eq(e.server.state('alice'), { ...CFG[flow].initial, ...a }) &&
        eq(e.server.state('bob'), expectedBob),
      alicePutLogged: e.server.puts('alice').length === 1,
    },
    `bob start ${J(bobBefore.value)}, after alice release rev ${bobAfter.rev} (was ${bobBefore.rev}), bob mirror ${bobMirrorAfter === null ? 'absent' : 'written'}; bob PUTs ${bobPut.length} body ${J(bobPut[0]?.body)}; stored keys ${Object.keys(dump).join(',')}`,
    e.server.puts().length,
  )
}

const perFieldChangedAt: CaseFn = async (mk, flow) => {
  const key = CFG[flow].key
  // Variant 1: the read is parked and answers after the remote write; the local edit is still pending.
  const e = await mk()
  const t = await boot(e, flow, 'alice')
  e.server.hold('GET')
  await t.refresh()
  await e.settle()
  const parked = e.server.inflight.GET
  await t.set({ density: 'compact' })
  e.server.remoteWrite('alice', { theme: 'dark', density: 'spacious' })
  e.server.release()
  await e.settle()
  const read = await t.get()
  await t.advance(700)
  await e.settle()
  const puts = e.server.puts()
  // Variant 2: the read snapshots the server first (old density), the edit is saved and settled
  // (3000 ms > settleMs) before the stale answer lands: only the touch counter protects the field.
  const e2 = await mk()
  const t2 = await boot(e2, flow, 'alice')
  e2.server.hold('GET', 'after')
  await t2.refresh()
  await e2.settle()
  await t2.set({ density: 'compact' })
  await t2.advance(700)
  await e2.settle()
  await t2.advance(3000)
  e2.server.release()
  await e2.settle()
  const late = await t2.get()
  const mirror = (await t2.mirror('alice', key))?.value as Bag | undefined
  await t2.advance(5000)
  await e2.settle()
  return verdict(
    {
      readWasInFlight: parked === 1,
      remoteFieldAdopted: read.value.theme === 'dark',
      localEditKept: read.value.density === 'compact',
      patchHasOnlyDensity:
        puts.length === 1 && eq(Object.keys((puts[0]?.body as Bag) ?? {}), ['density']),
      serverEndsMerged: eq(e.server.state('alice'), {
        ...CFG[flow].initial,
        theme: 'dark',
        density: 'compact',
      }),
      staleSnapshotKept: late.value.density === 'compact' && mirror?.density === 'compact',
      adoptionWritesNothing:
        e2.server.puts().length === 1 && e2.server.state('alice')?.density === 'compact',
    },
    `read in flight ${parked}; theme ${J(read.value.theme)} (remote dark), density ${J(read.value.density)} (local edit); PUT keys ${J(Object.keys((puts[0]?.body as Bag) ?? {}))}; server ${J(e.server.state('alice'))}; stale-snapshot read after 3000 ms: density ${J(late.value.density)}, PUTs ${e2.server.puts().length}`,
    puts.length + e2.server.puts().length,
  )
}

const CASES: Record<Flow, [string, CaseFn][]> = {
  eposSettings: [
    ['serial-order', serialOrder],
    ['per-field-changedAt', perFieldChangedAt],
    ['remote-ignored-while-editing', remoteIgnoredWhileEditing],
    ['no-echo-two-tabs', noEchoTwoTabs],
    ['owner-switch-isolates', ownerSwitchIsolates],
  ],
  argoGym: [
    ['null-seed', nullSeed],
    ['poll-pauses-while-saving', pollPauses],
    ['serial-order', serialOrder],
    ['lww-rev', lwwRev],
    ['remote-ignored-while-editing', remoteIgnoredWhileEditing],
    ['no-echo-two-tabs', noEchoTwoTabs],
    ['owner-switch-isolates', ownerSwitchIsolates],
  ],
}
const NOT_APPLICABLE: Record<Flow, { id: string; reason: string }[]> = {
  eposSettings: [
    {
      id: 'null-seed',
      reason:
        'epos GET always returns the fields (defaults when unset): the server is never un-seeded',
    },
    {
      id: 'poll-pauses-while-saving',
      reason: 'epos has no poll: it reloads on owner or session change only',
    },
    {
      id: 'lww-rev',
      reason:
        'epos responses carry no rev or updated_at; the rev is a local counter the transport synthesises',
    },
  ],
  argoGym: [
    {
      id: 'per-field-changedAt',
      reason: 'argo has no per-field stamps: whole-state LWW with one server updated_at',
    },
  ],
}

async function runSuite(browser: Browser, bundle: string, flow: Flow): Promise<CaseResult[]> {
  const results: CaseResult[] = []
  for (const [id, fn] of CASES[flow]) {
    const envs: Env[] = []
    const mk: Mk = async () => {
      const env = await newEnv(browser, bundle, flow)
      envs.push(env)
      return env
    }
    let out: Outcome
    try {
      out = await fn(mk, flow)
    } catch (err) {
      out = {
        checks: { ran: false },
        evidence: `threw ${(err as Error).message.split('\n')[0]}`,
        puts: 0,
      }
    }
    await Promise.all(envs.map((env) => env.close()))
    const pass = Object.values(out.checks).every(Boolean)
    log(`  ${flow} ${id}: ${pass ? 'pass' : 'FAIL'}`)
    results.push({ id, pass, evidence: out.evidence, puts: out.puts })
  }
  return results
}

const summary = (r: CaseResult[]) => ({
  casesPassed: r.filter((c) => c.pass).length,
  casesTotal: r.length,
  failed: r.filter((c) => !c.pass).map((c) => c.id),
})
const headline = (flow: Flow, r: CaseResult[]) => ({
  casesPassed: r.filter((c) => c.pass).length,
  casesTotal: r.length,
  cases: r.map(({ id, pass, evidence }) => ({ id, pass, evidence })),
  notApplicable: NOT_APPLICABLE[flow],
})
const lines = (file: string): number =>
  readFileSync(resolve(HERE, file), 'utf8').split('\n').length - 1

// forcedBy rule (mechanical): the first failing case in argoOnFinal, then eposSettings, then argoOnV0;
// when everything passes (decision symbol), the epos case that went through the most synthesised saves
// (one per PUT, since epos answers `{}`), first on a tie.
function forcedBy(argo: CaseResult[], epos: CaseResult[]): string {
  const failing = [...argo, ...epos].find((c) => !c.pass)
  if (failing) return `${failing.id}: ${failing.evidence}`
  const worst = epos.reduce((m, c) => (c.puts > m.puts ? c : m), epos[0])
  return `${worst.id} (closest call, ${worst.puts} synthesised saves): ${worst.evidence}`
}

async function main(): Promise<void> {
  const bundles = { v0: await bundleCore('core.v0'), final: await bundleCore('core') }
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    // Order matters for the ledger: epos meets core.v0 before anything in core.ts may change.
    log('epos on core.v0')
    const eposV0 = await runSuite(browser, bundles.v0, 'eposSettings')
    log('argo on core.v0')
    const argoV0 = await runSuite(browser, bundles.v0, 'argoGym')
    log('argo on core')
    const argoFinal = await runSuite(browser, bundles.final, 'argoGym')
    log('epos on core')
    const epos = await runSuite(browser, bundles.final, 'eposSettings')
    const allPass = [...argoFinal, ...epos].every((c) => c.pass)
    // An unlogged edit of core.ts (it differs from the baseline with an empty ledger) cannot be 'symbol'.
    const coreMatchesV0 =
      readFileSync(resolve(HERE, 'core.ts'), 'utf8') ===
      readFileSync(resolve(HERE, 'core.v0.ts'), 'utf8')
    const ledgerHolds = coreMatchesV0 || CORE_CHANGES.length > 0
    const decision =
      allPass && ledgerHolds && CORE_CHANGES.every((c) => c.tag === 'widening')
        ? 'symbol'
        : 'recipe'
    const out = {
      argoGym: headline('argoGym', argoFinal),
      eposSettings: headline('eposSettings', epos),
      eposOnV0: summary(eposV0),
      argoOnV0: summary(argoV0),
      argoOnFinal: summary(argoFinal),
      coreChanges: CORE_CHANGES,
      coreMatchesV0,
      decision,
      forcedBy: forcedBy(argoFinal, epos),
      coreLines: {
        'core.ts': lines('core.ts'),
        'flows/argo-gym.ts': lines('flows/argo-gym.ts'),
        'flows/epos-settings.ts': lines('flows/epos-settings.ts'),
      },
    }
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
  } finally {
    await browser.close()
  }
}

await main()
process.exit(0)
