/**
 * The provider's feature slots — a tiny leaf store (React types only, no Mantine, no peers, nothing
 * touched at import so it is SSR-safe). "The bundle follows the definitions": a feature's runtime
 * (hotkeys, Spotlight, modals) enters the import graph only through the `define*` call that needs
 * it, and that call registers its mount here. `BasaltProvider` reads the store with
 * `useSyncExternalStore`, so a registration made after first render (a `define*` call inside a lazily
 * loaded route) mounts a sibling instead of re-parenting the app tree.
 */
import { useSyncExternalStore } from 'react'
import type { ComponentType } from 'react'
import type { AnyRouter } from '@tanstack/react-router'
import type { BasaltDevDockTool } from '../dev-dock'
import type { FlatNavItem } from '../router-tanstack/nav-stash'
import { createNotifier } from './notifier'

/** What the provider hands every mount; a mount that needs none of it ignores it. */
export type SlotProps = {
  router: AnyRouter
  navCommandLabel: ((item: FlatNavItem) => string) | undefined
  openDevTool: (tool: BasaltDevDockTool) => void
}

export type SlotName = 'hotkeys' | 'spotlight' | 'modals'
export type Slots = { readonly [K in SlotName]?: ComponentType<SlotProps> }

let slots: Slots = {}
const store = createNotifier()

/** @internal — idempotent: re-registering the same component is a no-op (no notify, no new snapshot). */
export function registerSlot(name: SlotName, component: ComponentType<SlotProps>): void {
  if (slots[name] === component) return
  slots = { ...slots, [name]: component }
  store.notify()
}

/** @internal — test isolation only. */
export function resetSlots(): void {
  slots = {}
  store.notify()
}

const getSlots = (): Slots => slots

/** @internal — the registered mounts, read by `BasaltProvider`. */
export function useSlots(): Slots {
  return useSyncExternalStore(store.subscribe, getSlots, getSlots)
}

// ── Mounted providers ─────────────────────────────────────────────────────────

let mountedProviders = 0

/** @internal — `BasaltProvider` declares itself mounted; returns the retraction. Idempotent per call. */
export function trackProvider(): () => void {
  mountedProviders++
  let released = false
  return () => {
    if (released) return
    released = true
    mountedProviders--
  }
}

/** @internal — whether a `BasaltProvider` is mounted to commit a slot registered right now. */
export function hasMountedProvider(): boolean {
  return mountedProviders > 0
}
