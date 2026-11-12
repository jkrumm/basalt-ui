/**
 * The fake scheduler every live-query test runs on: Query's timers (`refetchInterval`, retry
 * delays, gc), its notify scheduler and `Date.now` all follow one virtual clock, so 60 s of polling
 * is a loop, not a wait. Parameterised on the Query core so the same matrix runs on 5.107.1 (the
 * devDependency) and on 5.101.2 (the nested `query-5101` package).
 */
import type * as ReactQuery from '@tanstack/react-query'

export type Core = Pick<
  typeof ReactQuery,
  | 'QueryClient'
  | 'QueryObserver'
  | 'focusManager'
  | 'onlineManager'
  | 'notifyManager'
  | 'timeoutManager'
  | 'environmentManager'
>

type Timer = { id: number; at: number; cb: () => void; every?: number | undefined }

export const EPOCH_MS = 1_700_000_000_000

export type Clock = {
  readonly now: number
  advance(ms: number): Promise<void>
  /** A virtual request latency. */
  sleep(ms: number): Promise<void>
  uninstall(): void
}

/** Installs the virtual clock on `core`; call `uninstall()` in `afterEach`. */
export function installClock(core: Core): Clock {
  let now = 0
  let seq = 0
  let timers: Timer[] = []
  const add = (cb: () => void, delay: number, every?: number): number => {
    const id = ++seq
    timers.push({ id, at: now + Math.max(delay, 0), cb, every })
    return id
  }
  const flush = async (): Promise<void> => {
    for (let i = 0; i < 4; i++) await new Promise<void>((r) => setImmediate(r))
  }
  const advanceTo = async (target: number): Promise<void> => {
    await flush()
    for (;;) {
      const next = timers.reduce<Timer | undefined>(
        (best, t) => (!best || t.at < best.at || (t.at === best.at && t.id < best.id) ? t : best),
        undefined,
      )
      if (!next || next.at > target) break
      now = next.at
      if (next.every === undefined) timers = timers.filter((t) => t !== next)
      else next.at += next.every
      next.cb()
      await flush()
    }
    now = target
    await flush()
  }

  const realNow = Date.now
  const quiet = console.error
  console.error = () => {} // Query logs when the timeout provider changes after first use
  core.environmentManager.setIsServer(() => false)
  core.timeoutManager.setTimeoutProvider({
    setTimeout: (cb, delay) => add(cb, delay) as never,
    clearTimeout: (id) => void (timers = timers.filter((t) => t.id !== Number(id))),
    setInterval: (cb, delay) => add(cb, delay, delay) as never,
    clearInterval: (id) => void (timers = timers.filter((t) => t.id !== Number(id))),
  })
  console.error = quiet
  core.notifyManager.setScheduler((cb) => void add(cb, 0))
  Date.now = () => EPOCH_MS + now

  return {
    get now() {
      return now
    },
    advance: (ms) => advanceTo(now + ms),
    sleep: (ms) => new Promise<void>((r) => add(r, ms)),
    uninstall() {
      timers = []
      Date.now = realNow
      console.error = () => {}
      core.timeoutManager.setTimeoutProvider({
        setTimeout: (cb, delay) => setTimeout(cb, delay) as never,
        clearTimeout: (id) => clearTimeout(id as never),
        setInterval: (cb, delay) => setInterval(cb, delay) as never,
        clearInterval: (id) => clearInterval(id as never),
      })
      console.error = quiet
      core.notifyManager.setScheduler((cb) => void setTimeout(cb, 0))
      core.focusManager.setFocused(undefined)
      core.onlineManager.setOnline(true)
    },
  }
}

/** A `queryFn` that counts its starts, takes `latencyMs` of virtual time, then resolves or throws. */
export function countingFetch(
  clock: Clock,
  o: { latencyMs?: number; fail?: (n: number) => unknown } = {},
) {
  const starts: number[] = []
  const queryFn = async () => {
    starts.push(clock.now)
    const n = starts.length
    await clock.sleep(o.latencyMs ?? 300)
    const error = o.fail?.(n)
    if (error !== undefined) throw error
    return { n }
  }
  return { queryFn, starts }
}

/** How many starts fall in each `[from + k * intervalMs, from + (k + 1) * intervalMs)` window. */
export function perInterval(
  starts: readonly number[],
  from: number,
  to: number,
  intervalMs: number,
) {
  return Array.from({ length: (to - from) / intervalMs }, (_, k) => {
    const lo = from + k * intervalMs
    return starts.filter((s) => s >= lo && s < lo + intervalMs).length
  })
}
