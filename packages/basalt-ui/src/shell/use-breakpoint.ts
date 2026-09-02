/**
 * `useBreakpoint` — one media-query hook over the theme's own breakpoints, SSR/hydration-safe.
 *
 * Built on `useSyncExternalStore`, NOT `@mantine/hooks`' `useMediaQuery` — that hook reads
 * `matchMedia` inside a `useState` initializer, so on the server it returns its `fallback` and on
 * the client's very first render it returns the REAL match; when that render is a hydration pass
 * the two disagree silently (a server-rendered desktop layout hydrating on a phone against a
 * client tree that already moved). `useSyncExternalStore`'s `getServerSnapshot` makes React render
 * the server's answer during hydration and correct itself immediately after — the documented,
 * warning-free version of the same fix. `page-aside.tsx`'s own former private
 * `useMediaQueryMatches` carried this exact rationale; it now lives here and page-aside composes
 * this hook instead (C5 consolidation — one media-query hook, not two).
 *
 * `edge` defaults to `'min'` (`"at least this wide"`); pass `'max'` for `"narrower than"`. The
 * `fallback` (what the server, and a shim with no `matchMedia`, sees) defaults to the answer that
 * assumes the NARROW side of the query — `false` for `min`, `true` for `max` — since a component
 * library cannot know a consumer's real device mix; a call site with its own rationale (e.g.
 * `page-aside.tsx`'s desktop-first portal fallback) overrides it via `options.fallback`.
 *
 * @example
 * import { useBreakpoint } from 'basalt-ui'
 *
 * const isDesktop = useBreakpoint('sm')            // >= theme.breakpoints.sm
 * const isNarrow = !useBreakpoint('sm')             // < theme.breakpoints.sm
 * const isWide = useBreakpoint('lg')                // >= theme.breakpoints.lg
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useMantineTheme } from '@mantine/core'

export type BreakpointName = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/** `window.matchMedia`, or `null` where there is no window and on a shim that does not ship it. */
function mediaQueryList(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(query)
}

/**
 * Internal — the raw media-query read. Exported (not `default`) so `page-aside.tsx` can compose
 * it directly for its `(min-width: theme.breakpoints.sm)` desktop check without re-deriving the
 * query string `useBreakpoint` builds for the fixed `BreakpointName` union.
 */
export function useMediaQueryMatches(query: string, fallback: boolean): boolean {
  // ONE `MediaQueryList` per query, held across renders — `matchMedia()` allocates a fresh live
  // object on every call, and `getSnapshot` runs on every render AND after every store
  // notification, so calling it there would churn an object per read while `subscribe` listened
  // on a different instance than `getSnapshot` measured.
  const list = useMemo(() => mediaQueryList(query), [query])
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (list === null) return () => {}
      list.addEventListener('change', onStoreChange)
      return () => {
        list.removeEventListener('change', onStoreChange)
      }
    },
    [list],
  )
  const getSnapshot = useCallback(() => list?.matches ?? fallback, [list, fallback])
  const getServerSnapshot = useCallback(() => fallback, [fallback])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function useBreakpoint(
  name: BreakpointName,
  edge: 'min' | 'max' = 'min',
  options?: { fallback?: boolean },
): boolean {
  const theme = useMantineTheme()
  const bp = theme.breakpoints[name]
  const fallback = options?.fallback ?? edge === 'max'
  return useMediaQueryMatches(`(${edge}-width: ${bp})`, fallback)
}
