/**
 * `useSizeClass` — the viewport axis of the responsive law (`docs/DESIGN-CORE.md` § Layout,
 * elevation, shapes):
 * `'compact' | 'medium' | 'expanded'`, for the JS reads CSS cannot express (portal targets,
 * mount-one-of-two branches). Shell-only — components size by container, not by this.
 *
 * Built on `useMediaQuery` (`common/use-media-query`), one call per class boundary. A
 * client-rendered app (`createRoot`) reads `matchMedia` on its FIRST render — no hint, no flash, so
 * a mount-one-of-two branch on this hook is flash-free in a CSR SPA (`use-size-class.test.tsx`
 * pins it). Only SSR and the `hydrateRoot` pass read the server snapshot,
 * `<BasaltProvider sizeClassHint>` (default `'compact'`), so server HTML and hydration agree and the
 * real class lands one commit later.
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
