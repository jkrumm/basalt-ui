/**
 * Spike 627 (docs/v3/concepts/live-realtime.md section 7, P1). Throwaway harness, no tests.
 *
 * Six observers on ONE query key, each with `refetchInterval`, on a virtual clock for 60 s:
 *   arm A  per-observer timers (what Query does by default, what argo's `gym.ts` warns about)
 *   arm B  a minimal central poller: one interval per query hash, driven by `observerAdded` /
 *          `observerRemoved` on the QueryCache, observers carry NO `refetchInterval`
 *
 * `fetchesPerInterval` = fetches started in one interval across all six observers (mean over the
 * measured intervals); `extraPerInterval` = that minus 1, a total, not per observer.
 *
 * Primary scenario is `staggered`: the observers mount at six distinct instants inside the first
 * interval, as argo's WeightPopover-per-row does (a row appears when the user adds a set). The
 * `aligned` scenario (all six mount in the same tick) is informational. Verdict rule, fixed before
 * measuring, on argo's locked Query version: `build` iff arm A `extraPerInterval` > 1 and arm B
 * `fetchesPerInterval` is exactly 1; else `drop`.
 *
 * Prints ONE JSON object on stdout and always exits 0 (0 = the harness ran, not "hypothesis held").
 * Progress goes to stderr.
 */
import * as argoCore from 'query-core-argo'
import * as newestCore from 'query-core-newest'

type Core = typeof argoCore

const INTERVAL_MS = 5_000 // argo gym.ts GYM_POLL_MS
const FETCH_MS = 300 // virtual latency of one request
const DURATION_MS = 60_000
const WARMUP_MS = 2 * INTERVAL_MS // first fire of the last-mounted observer is at 4700 + 5000
const OBSERVERS = 6
const STAGGERED_MOUNTS_MS = [0, 1_100, 2_300, 3_100, 4_200, 4_700]
const ALIGNED_MOUNTS_MS = [0, 0, 0, 0, 0, 0]
const EPOCH_MS = 1_700_000_000_000 // Date.now() at virtual t=0
const KEY = ['gym', 'state'] as const

// ---- virtual clock: timers, Date.now, microtask flush between firings -----------------------------

interface Timer {
  id: number
  at: number
  cb: () => void
  every?: number
}

const clock = {
  now: 0,
  seq: 0,
  timers: [] as Timer[],
  reset() {
    this.now = 0
    this.seq = 0
    this.timers = []
  },
  add(cb: () => void, delay: number, every?: number): number {
    const id = ++this.seq
    this.timers.push({ id, at: this.now + Math.max(delay, 0), cb, every })
    return id
  },
  clear(id: unknown) {
    this.timers = this.timers.filter((t) => t.id !== Number(id))
  },
  async flush() {
    for (let i = 0; i < 4; i++) await new Promise<void>((r) => setImmediate(r))
  },
  async advanceTo(target: number) {
    await this.flush()
    for (;;) {
      const next = this.timers.reduce<Timer | undefined>(
        (best, t) => (!best || t.at < best.at || (t.at === best.at && t.id < best.id) ? t : best),
        undefined,
      )
      if (!next || next.at > target) break
      this.now = next.at
      if (next.every === undefined) this.timers = this.timers.filter((t) => t !== next)
      else next.at += next.every
      next.cb()
      await this.flush()
    }
    this.now = target
    await this.flush()
  },
}

const provider = {
  setTimeout: (cb: () => void, delay: number) => clock.add(cb, delay) as never,
  clearTimeout: (id: unknown) => clock.clear(id),
  setInterval: (cb: () => void, delay: number) => clock.add(cb, delay, delay) as never,
  clearInterval: (id: unknown) => clock.clear(id),
}

const realNow = Date.now
function installClock(core: Core) {
  // Bun has no `window`, so Query would treat this process as a server and schedule no
  // `refetchInterval` timer at all. The subject is the browser.
  core.environmentManager.setIsServer(() => false)
  core.timeoutManager.setTimeoutProvider(provider)
  core.notifyManager.setScheduler((cb) => {
    clock.add(cb, 0)
  })
  Date.now = () => EPOCH_MS + clock.now
}

const sleep = (ms: number) => new Promise<void>((r) => clock.add(r, ms))

// ---- arm B: the minimal central poller ------------------------------------------------------------

const isEnabled = (o: { options: { enabled?: unknown } }) => o.options.enabled !== false

/** One interval per query hash while it has at least one enabled observer. */
function installPoller(core: Core, client: InstanceType<Core['QueryClient']>, every: number) {
  const counts = new Map<string, number>()
  const timers = new Map<string, unknown>()
  return client.getQueryCache().subscribe((event) => {
    if (event.type !== 'observerAdded' && event.type !== 'observerRemoved') return
    const { queryHash, queryKey } = event.query
    const was = counts.get(queryHash) ?? 0
    const now = was + (isEnabled(event.observer) ? (event.type === 'observerAdded' ? 1 : -1) : 0)
    counts.set(queryHash, now)
    if (was === 0 && now > 0) {
      timers.set(
        queryHash,
        core.timeoutManager.setInterval(() => {
          if (!core.focusManager.isFocused()) return
          void client.refetchQueries({ queryKey, exact: true })
        }, every),
      )
    } else if (was > 0 && now === 0) {
      core.timeoutManager.clearInterval(timers.get(queryHash) as never)
      timers.delete(queryHash)
    }
  })
}

// ---- one run --------------------------------------------------------------------------------------

type Arm = 'perObserver' | 'central'

async function run(core: Core, arm: Arm, mounts: readonly number[], constantPayload = false) {
  clock.reset()
  const fetchStarts: number[] = []
  const client = new core.QueryClient()
  const unsubscribePoller = arm === 'central' ? installPoller(core, client, INTERVAL_MS) : undefined
  const unsubscribers: (() => void)[] = []

  const mount = (i: number) => {
    const observer = new core.QueryObserver(client, {
      queryKey: KEY,
      queryFn: async () => {
        fetchStarts.push(clock.now)
        await sleep(FETCH_MS)
        return constantPayload ? { n: 0 } : { n: fetchStarts.length }
      },
      staleTime: INTERVAL_MS, // argo gym.ts: matched to the poll
      refetchInterval: arm === 'perObserver' ? INTERVAL_MS : false,
    })
    unsubscribers[i] = observer.subscribe(() => {})
  }

  const order = mounts.map((at, i) => ({ at, i })).toSorted((a, b) => a.at - b.at || a.i - b.i)
  for (const m of order) {
    await clock.advanceTo(m.at)
    mount(m.i)
  }
  await clock.advanceTo(DURATION_MS)

  unsubscribers.forEach((u) => u?.())
  unsubscribePoller?.()
  client.clear()

  const intervals = (DURATION_MS - WARMUP_MS) / INTERVAL_MS
  const perInterval = Array.from({ length: intervals }, (_, k) => {
    const from = WARMUP_MS + k * INTERVAL_MS
    return fetchStarts.filter((s) => s >= from && s < from + INTERVAL_MS).length
  })
  const fetchesPerInterval = perInterval.reduce((a, b) => a + b, 0) / intervals
  return {
    fetchesPerInterval,
    extraPerInterval: round(fetchesPerInterval - 1),
    perInterval,
    totalFetches: fetchStarts.length,
  }
}

const round = (n: number) => Math.round(n * 100) / 100

async function measure(label: string, core: Core) {
  installClock(core)
  const out: Record<string, unknown> = { queryCore: label }
  // `staggered` decides; the others are informational. `staggeredConstant` returns the same
  // payload every time, which is what a settings row polled for changes mostly does.
  const scenarios = {
    staggered: { mounts: STAGGERED_MOUNTS_MS, constant: false },
    staggeredConstant: { mounts: STAGGERED_MOUNTS_MS, constant: true },
    aligned: { mounts: ALIGNED_MOUNTS_MS, constant: false },
  } as const
  const results: Record<string, Record<Arm, Awaited<ReturnType<typeof run>>>> = {}
  for (const [name, { mounts, constant }] of Object.entries(scenarios)) {
    console.error(`[live-poller] ${label} ${name}`)
    results[name] = {
      perObserver: await run(core, 'perObserver', mounts, constant),
      central: await run(core, 'central', mounts, constant),
    }
  }
  const { perObserver, central } = results.staggered
  const exactlyOne = central.perInterval.every((n) => n === 1)
  out.perObserver = perObserver
  out.central = central
  out.staggeredConstant = results.staggeredConstant
  out.aligned = results.aligned
  out.poller = perObserver.extraPerInterval > 1 && exactlyOne ? 'build' : 'drop'
  return out
}

const argo = await measure('5.104.1', argoCore)
const newest = await measure('5.107.1', newestCore as unknown as Core)
Date.now = realNow

console.log(
  JSON.stringify(
    {
      spike: 'live-poller',
      config: {
        observers: OBSERVERS,
        intervalMs: INTERVAL_MS,
        fetchMs: FETCH_MS,
        durationMs: DURATION_MS,
        warmupMs: WARMUP_MS,
        staggeredMountsMs: STAGGERED_MOUNTS_MS,
      },
      decidedOn: '5.104.1',
      versions: { '5.104.1': argo, '5.107.1': newest },
      poller: argo.poller,
    },
    null,
    2,
  ),
)
