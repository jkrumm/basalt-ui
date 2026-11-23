/**
 * The shell's side of favourites: the list from the store (the app's, else a `persisted` one under
 * `<storageKey>-favourites`) and the three ways to change it. A toggle resolves the record's target
 * to an href through the router, because a `NavTarget` is opaque and a store keeps text.
 */
import { useRouter } from '@tanstack/react-router'
import { useMemo, useSyncExternalStore } from 'react'
import type { FavouriteEntry, FavouritesStore } from '../page/contract'
import { persistedFavourites, rememberFavouriteGlyph } from '../page/favourites'
import type { FavouritesApi } from '../page/favourites'
import { targetHref } from '../router/nav-target'

const NONE: readonly FavouriteEntry[] = []

export function useFavouritesApi(
  store: FavouritesStore | undefined,
  storageKey: string,
): FavouritesApi {
  const router = useRouter()
  const fallback = useMemo(() => persistedFavourites(`${storageKey}-favourites`), [storageKey])
  const active = store ?? fallback
  const entries = useSyncExternalStore(active.subscribe, active.get, () => NONE)
  return useMemo<FavouritesApi>(
    () => ({
      entries,
      toggle(input) {
        const now = active.get()
        if (now.some((entry) => entry.id === input.id)) {
          active.set(now.filter((entry) => entry.id !== input.id))
          return
        }
        const href = targetHref(router, input.target)
        if (href === undefined) return
        rememberFavouriteGlyph(input.id, input.icon)
        active.set([...now, { id: input.id, label: input.label, href }])
      },
      remove(id) {
        active.set(active.get().filter((entry) => entry.id !== id))
      },
      move(from, to) {
        const next = [...active.get()]
        const [moved] = next.splice(from, 1)
        if (moved === undefined || to < 0 || to > next.length) return
        next.splice(to, 0, moved)
        active.set(next)
      },
    }),
    [entries, active, router],
  )
}
