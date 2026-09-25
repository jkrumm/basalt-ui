/**
 * `useSizeClass` — the viewport axis of the responsive law (`docs/waves/RESPONSIVE-SPEC.md` §1):
 * `'compact' | 'medium' | 'expanded'`, for the JS reads CSS cannot express (portal targets,
 * mount-one-of-two branches). Shell-only — components size by container, not by this.
 *
 * `useSyncExternalStore` with one `MediaQueryList` per class boundary. The server snapshot is
 * `<BasaltProvider sizeClassHint>` (default `'compact'`), so SSR, the hydration pass and the first
 * client paint agree, and the real class lands one commit later — no first-frame flash from a
 * `matchMedia` read inside a `useState` initializer.
 */
import { createContext, useCallback, useContext, useState, useSyncExternalStore } from 'react'
import { SIZE_CLASSES, toEm } from '../tokens/size-classes'

export type SizeClass = keyof typeof SIZE_CLASSES

/** Non-`compact` classes, widest first — the first list that matches is the current class. */
const BOUNDARIES: readonly (readonly [SizeClass, number])[] = (
  [
    ['medium', SIZE_CLASSES.medium],
    ['expanded', SIZE_CLASSES.expanded],
  ] as const
)
  .slice()
  .reverse()

/** Provided by `BasaltProvider`'s `sizeClassHint`; the server snapshot. `undefined` = no provider. */
export const SizeClassHintContext = createContext<SizeClass | undefined>(undefined)

type BoundaryLists = readonly (readonly [SizeClass, MediaQueryList])[]

/** One `MediaQueryList` per boundary; empty where there is no `matchMedia` (SSR, a shim). */
function boundaryLists(): BoundaryLists {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return []
  return BOUNDARIES.map(([name, minPx]) => [name, window.matchMedia(`(min-width: ${toEm(minPx)})`)])
}

/** Without `matchMedia` there is nothing to read: fall back to `hint`. */
function readSizeClass(lists: BoundaryLists, hint: SizeClass): SizeClass {
  if (lists.length === 0) return hint
  return lists.find(([, list]) => list.matches)?.[0] ?? 'compact'
}

export function useSizeClass(): SizeClass {
  const hint = useContext(SizeClassHintContext) ?? 'compact'
  // Created once per mount: `matchMedia()` allocates a live object per call, and `subscribe` must
  // listen on the very lists `getSnapshot` reads.
  const [lists] = useState(boundaryLists)
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      for (const [, list] of lists) list.addEventListener('change', onStoreChange)
      return () => {
        for (const [, list] of lists) list.removeEventListener('change', onStoreChange)
      }
    },
    [lists],
  )
  const getSnapshot = useCallback(() => readSizeClass(lists, hint), [lists, hint])
  const getServerSnapshot = useCallback(() => hint, [hint])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
