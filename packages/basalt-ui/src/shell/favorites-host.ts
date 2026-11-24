/**
 * The shell's side of favorites: the list from the store (the app's, else a `persisted` one under
 * `<storageKey>-favorites`) and the three ways to change it. A toggle resolves the record's target
 * to an href through the router, because a `NavTarget` is opaque and a store keeps text.
 */
import { useRouter } from '@tanstack/react-router'
import { useMemo, useSyncExternalStore } from 'react'
import type { FavoriteEntry, FavoritesStore } from '../page/contract'
import { persistedFavorites, rememberFavoriteGlyph } from '../page/favorites'
import type { FavoritesApi } from '../page/favorites'
import { targetHref } from '../router/nav-target'

const NONE: readonly FavoriteEntry[] = []

export function useFavoritesApi(
  store: FavoritesStore | undefined,
  storageKey: string,
): FavoritesApi {
  const router = useRouter()
  const fallback = useMemo(() => persistedFavorites(`${storageKey}-favorites`), [storageKey])
  const active = store ?? fallback
  const entries = useSyncExternalStore(active.subscribe, active.get, () => NONE)
  return useMemo<FavoritesApi>(
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
        rememberFavoriteGlyph(input.id, input.icon)
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
