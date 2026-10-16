/**
 * The modals mount: `ModalsProvider` as a SIBLING of the router, plus the live-provider declaration
 * the imperative overlay calls wait on. Registered by `defineOverlays` / `overlays.*` (never imported
 * by the provider), so an app using none ships none of `@mantine/modals`.
 */
import { ModalsProvider } from '@mantine/modals'
import { useEffect } from 'react'
import { createNotifier } from './notifier'
import { hasMountedProvider, registerSlot } from './slots'

/**
 * How many `ModalsProvider`s are live right now — a COUNTER, not a flag: two overlapping mounts
 * are normal (a route swap mounts the next provider before unmounting the previous one), and a
 * last-write-wins boolean reports the teardown of the OLD one as "no layer" while the new one is
 * serving. `@mantine/modals`' imperative API is a window event bus: with nothing subscribed a dialog
 * never appears and a confirm promise never settles, so the calls wait for this to be non-zero.
 */
let liveProviders = 0
const live = createNotifier()

/**
 * Internal — `ModalsMount` declares its `ModalsProvider` as live for as long as it is mounted,
 * and gets back the function that retracts it. There is no way to detect the provider from outside
 * React (its context is only readable through `useModals()`, and the overlay calls are imperative),
 * so the registration is explicit.
 */
export function registerModalsProvider(): () => void {
  liveProviders++
  live.notify()
  let released = false
  return () => {
    // Idempotent: an effect cleanup React runs twice (StrictMode remount) must not drive the count
    // below the number of providers actually on screen.
    if (released) return
    released = true
    liveProviders--
  }
}

/** How long a call waits for a mounted `BasaltProvider` to commit the modals mount it asked for. */
const COMMIT_WAIT_MS = 5000
/** With no `BasaltProvider` mounted nothing will commit it; this is only the grace for one mounting now. */
const NO_PROVIDER_WAIT_MS = 500

/** Resolves `true` once a `ModalsProvider` is live, `false` after `timeoutMs` without one. */
function whenModalsLive(timeoutMs: number): Promise<boolean> {
  if (liveProviders > 0) return Promise.resolve(true)
  return new Promise((resolve) => {
    let unsubscribe = (): void => {}
    const finish = (isLive: boolean): void => {
      unsubscribe()
      clearTimeout(timer)
      resolve(isLive)
    }
    const timer = setTimeout(() => finish(false), timeoutMs)
    unsubscribe = live.subscribe(() => liveProviders > 0 && finish(true))
  })
}

/** @internal — put the modals mount in the provider's slots; synchronous, nothing awaited. */
export function registerModalsMount(): void {
  registerSlot('modals', ModalsMount)
}

/**
 * @internal — register the mount, then wait for it to go live: up to 5 s when a `BasaltProvider` is
 * mounted (it commits the slot), 500 ms when none is. `false` means no dialog layer will serve the call.
 */
export function ensureModalsMount(): Promise<boolean> {
  registerModalsMount()
  return whenModalsLive(hasMountedProvider() ? COMMIT_WAIT_MS : NO_PROVIDER_WAIT_MS)
}

export function ModalsMount() {
  useEffect(() => registerModalsProvider(), [])
  return <ModalsProvider>{null}</ModalsProvider>
}
