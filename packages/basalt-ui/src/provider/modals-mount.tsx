/**
 * The modals mount: `ModalsProvider` as a SIBLING of the router, plus the live-provider declaration
 * the imperative overlay calls wait on. Registered by `defineOverlays` / `overlays.*` (never imported
 * by the provider), so an app using none ships none of `@mantine/modals`.
 */
import { ModalsProvider } from '@mantine/modals'
import { useEffect } from 'react'
import { createLiveCounter } from './notifier'
import { hasMountedProvider, registerSlot } from './slots'

/**
 * The live `ModalsProvider`s. `@mantine/modals`' imperative API is a window event bus: with nothing
 * subscribed a dialog never appears and a confirm promise never settles, so the overlay calls wait for
 * this to be non-zero.
 */
const liveProviders = createLiveCounter()

/**
 * Internal — `ModalsMount` declares its `ModalsProvider` live for as long as it is mounted and gets
 * back the retraction. There is no way to detect the provider from outside React (its context is only
 * readable through `useModals()`, and the overlay calls are imperative), so the registration is explicit.
 * Exported for the confirm tests, which mount their own host.
 */
export const registerModalsProvider = liveProviders.acquire

/** How long a call waits for a mounted `BasaltProvider` to commit the modals mount it asked for. */
const COMMIT_WAIT_MS = 5000
/** With no `BasaltProvider` mounted nothing will commit it; this is only the grace for one mounting now. */
const NO_PROVIDER_WAIT_MS = 500

/** Resolves `true` once a `ModalsProvider` is live, `false` after `timeoutMs` without one. */
function whenModalsLive(timeoutMs: number): Promise<boolean> {
  if (liveProviders.count() > 0) return Promise.resolve(true)
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let unsubscribe: (() => void) | undefined
    const finish = (isLive: boolean): void => {
      clearTimeout(timer)
      unsubscribe?.()
      resolve(isLive)
    }
    timer = setTimeout(() => finish(false), timeoutMs)
    unsubscribe = liveProviders.subscribe(() => {
      if (liveProviders.count() > 0) finish(true)
    })
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
