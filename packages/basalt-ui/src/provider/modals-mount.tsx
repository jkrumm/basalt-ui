/**
 * The modals mount: `ModalsProvider` as a SIBLING of the router, plus the live-provider declaration
 * `overlays.confirm` checks. Registered by `defineOverlays` (never imported by the provider), so an
 * app defining no overlays ships none of `@mantine/modals`.
 */
import { ModalsProvider } from '@mantine/modals'
import { useEffect } from 'react'

/**
 * How many `ModalsProvider`s are live right now — a COUNTER, not a flag: two overlapping mounts
 * are normal (a route swap mounts the next provider before unmounting the previous one), and a
 * last-write-wins boolean reports the teardown of the OLD one as "no layer" while the new one is
 * serving.
 *
 * It is the availability test `overlays.confirm` runs, because `@mantine/modals`' imperative API is
 * a window event bus: with nothing subscribed the dialog never appears and the promise never
 * settles.
 */
let mountedModalsProviders = 0
const liveWaiters = new Set<() => void>()

/**
 * Internal — `ModalsMount` declares its `ModalsProvider` as live for as long as it is mounted,
 * and gets back the function that retracts it. There is no way to detect the provider from outside
 * React (its context is only readable through `useModals()`, and `confirm` is an imperative call),
 * so the registration is explicit.
 */
export function registerModalsProvider(): () => void {
  mountedModalsProviders++
  for (const waiter of liveWaiters) waiter()
  let released = false
  return () => {
    // Idempotent: an effect cleanup React runs twice (StrictMode remount) must not drive the count
    // below the number of providers actually on screen.
    if (released) return
    released = true
    mountedModalsProviders--
  }
}

/** @internal — the availability test `overlays.confirm` runs. */
export function liveModalsProviders(): number {
  return mountedModalsProviders
}

/**
 * Resolves `true` once a `ModalsProvider` is live, `false` after `timeoutMs` without one — the grace
 * a `BasaltProvider` needs to commit the mount a just-registered slot asked for. A hang guard on a
 * missing provider, never a budget on a live one.
 */
export function whenModalsLive(timeoutMs: number): Promise<boolean> {
  if (mountedModalsProviders > 0) return Promise.resolve(true)
  return new Promise((resolve) => {
    const done = (live: boolean): void => {
      liveWaiters.delete(onLive)
      clearTimeout(timer)
      resolve(live)
    }
    const onLive = (): void => done(true)
    const timer = setTimeout(() => done(false), timeoutMs)
    liveWaiters.add(onLive)
  })
}

export function ModalsMount() {
  // `overlays.confirm` is an imperative call; this tells it a `ModalsProvider` is live.
  useEffect(() => registerModalsProvider(), [])
  return <ModalsProvider>{null}</ModalsProvider>
}
