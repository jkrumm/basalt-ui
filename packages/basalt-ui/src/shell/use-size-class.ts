/**
 * `useSizeClass` — the viewport axis of the responsive law (`docs/waves/RESPONSIVE-SPEC.md` §1):
 * `'compact' | 'medium' | 'expanded'`, for the JS reads CSS cannot express (portal targets,
 * mount-one-of-two branches). Shell-only — components size by container, not by this.
 *
 * Built on `useMediaQuery` (`common/use-media-query`), one call per class boundary. The server
 * snapshot is `<BasaltProvider sizeClassHint>` (default `'compact'`), so SSR, the hydration pass
 * and the first client paint agree, and the real class lands one commit later — no first-frame
 * flash from a `matchMedia` read inside a `useState` initializer.
 */
import { createContext, useContext } from 'react'
import { useMediaQuery } from '../common/use-media-query'
import { SIZE_CLASSES, toEm } from '../tokens/size-classes'

export type SizeClass = keyof typeof SIZE_CLASSES

/** Provided by `BasaltProvider`'s `sizeClassHint`; the server snapshot. `undefined` = no provider. */
export const SizeClassHintContext = createContext<SizeClass | undefined>(undefined)

export function useSizeClass(): SizeClass {
  const hint = useContext(SizeClassHintContext) ?? 'compact'
  const isMedium = useMediaQuery(`(min-width: ${toEm(SIZE_CLASSES.medium)})`, hint !== 'compact')
  const isExpanded = useMediaQuery(
    `(min-width: ${toEm(SIZE_CLASSES.expanded)})`,
    hint === 'expanded',
  )
  if (isExpanded) return 'expanded'
  if (isMedium) return 'medium'
  return 'compact'
}
