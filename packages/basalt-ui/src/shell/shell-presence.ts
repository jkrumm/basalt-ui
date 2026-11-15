/**
 * Whether a v3 `AppShell` is mounted: a counter, since a route swap can mount the next shell before
 * the previous one unmounts. The 2.x `BasaltProvider` reads it to stand its Spotlight down, so under
 * the shell `CommandPalette` is the one palette and the one `Mod+K` listener. A leaf (the notifier is
 * one too), so the provider reads it without pulling the shell in.
 */
import { useSyncExternalStore } from 'react'
import { createLiveCounter } from '../provider/notifier'

const shells = createLiveCounter()

const getMounted = (): boolean => shells.count() > 0
const getServerMounted = (): boolean => false

/** @internal — `AppShell` declares itself mounted; returns the retraction (idempotent). */
export const trackShell = shells.acquire

/** @internal — true while a v3 `AppShell` is mounted. */
export function useShellMounted(): boolean {
  return useSyncExternalStore(shells.subscribe, getMounted, getServerMounted)
}
