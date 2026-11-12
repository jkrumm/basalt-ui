/**
 * `useNow`: the current time as a number, ticking every `ms`, so an age ("5 s ago") stays current
 * without a refetch. One interval per distinct `ms`, shared by every caller, started with the first
 * subscriber and cleared with the last: nothing runs at import or on the server.
 *
 * Runtime imports: `react` only.
 */
import { useSyncExternalStore } from 'react'

type Ticker = {
  now: number
  listeners: Set<() => void>
  timer?: ReturnType<typeof setInterval>
}

const tickers = new Map<number, Ticker>()

function tickerFor(ms: number): Ticker {
  let t = tickers.get(ms)
  if (!t) {
    t = { now: Date.now(), listeners: new Set() }
    tickers.set(ms, t)
  }
  return t
}

function subscribeTo(ms: number, onChange: () => void): () => void {
  const t = tickerFor(ms)
  const tick = () => {
    t.now = Date.now()
    for (const l of Array.from(t.listeners)) l()
  }
  t.listeners.add(onChange)
  if (t.listeners.size === 1) {
    // a hook that mounts after a long idle reads a fresh time at once, not after the first interval
    t.now = Date.now()
    t.timer = setInterval(tick, ms)
  }
  return () => {
    t.listeners.delete(onChange)
    if (t.listeners.size > 0) return
    clearInterval(t.timer)
    tickers.delete(ms)
  }
}

/**
 * The current time in epoch ms, refreshed every `ms`.
 *
 * @useWhen a surface shows an age or a countdown that must advance between data updates (the
 * "updated 5 s ago" beside a live indicator).
 * @neverWhen the value is a deadline you can compute once; or for animation (use CSS, not a timer).
 */
export function useNow(ms: number): number {
  const subscribe = (onChange: () => void) => subscribeTo(ms, onChange)
  const read = () => tickerFor(ms).now
  return useSyncExternalStore(subscribe, read, read)
}
