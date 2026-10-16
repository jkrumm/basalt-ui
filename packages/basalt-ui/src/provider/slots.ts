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
import type { FlatNavItem } from '../router-tanstack/nav'

/** What the provider hands every mount; a mount that needs none of it ignores it. */
export type SlotProps = {
  router: AnyRouter
  navCommandLabel: ((item: FlatNavItem) => string) | undefined
  openDevTool: (tool: BasaltDevDockTool) => void
}

export type SlotName = 'hotkeys' | 'spotlight' | 'modals'
export type Slots = { readonly [K in SlotName]?: ComponentType<SlotProps> }

let slots: Slots = {}
const listeners = new Set<() => void>()

/** @internal — idempotent: re-registering the same component is a no-op (no notify, no new snapshot). */
export function registerSlot(name: SlotName, component: ComponentType<SlotProps>): void {
  if (slots[name] === component) return
  slots = { ...slots, [name]: component }
  for (const listener of listeners) listener()
}

/** @internal — test isolation only. */
export function resetSlots(): void {
  slots = {}
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

const getSlots = (): Slots => slots

/** @internal — the registered mounts, read by `BasaltProvider`. */
export function useSlots(): Slots {
  return useSyncExternalStore(subscribe, getSlots, getSlots)
}
