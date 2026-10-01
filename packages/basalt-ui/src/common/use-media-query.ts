/**
 * `useMediaQuery` — the one sanctioned raw `window.matchMedia` read
 * (`basalt/raw-breakpoint`'s `RAW_BREAKPOINT_EXEMPT_FILE`). Every other breakpoint/pointer-tier
 * hook (`useSizeClass`, `useCoarsePointer`, the shell's own min-width dock check) is built on this
 * one primitive instead of allocating its own `MediaQueryList`.
 *
 * `useSyncExternalStore`, so SSR and the hydration pass read `serverFallback` and the real match
 * lands one commit later — never a mismatch mid-hydration. One `MediaQueryList` PER QUERY STRING,
 * shared module-wide: `useSizeClass`'s two boundaries and a chart's coarse-pointer read resolve
 * through the same handful of live objects rather than each allocating their own.
 */
import { useCallback, useSyncExternalStore } from 'react'

// Keyed by the LIVE `window.matchMedia` function, not just the query string: a test that swaps in
// its own stub (a real pattern in this repo — `provider/host.test.tsx`) gets a fresh inner cache
// for free, rather than reading a `MediaQueryList` a previous test's stub produced.
const cache = new WeakMap<typeof window.matchMedia, Map<string, MediaQueryList>>()

function mediaQueryList(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  let byQuery = cache.get(window.matchMedia)
  if (byQuery === undefined) {
    byQuery = new Map()
    cache.set(window.matchMedia, byQuery)
  }
  const cached = byQuery.get(query)
  if (cached !== undefined) return cached
  const list = window.matchMedia(query)
  byQuery.set(query, list)
  return list
}

/** A one-off, non-reactive read — for a dev-only check that runs once inside an effect/callback
 * rather than subscribing for the component's lifetime. Prefer `useMediaQuery` for anything that
 * should re-render on a match change. */
export function readMediaQuery(query: string, fallback: boolean): boolean {
  return mediaQueryList(query)?.matches ?? fallback
}

export function useMediaQuery(query: string, serverFallback: boolean): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = mediaQueryList(query)
      if (list === null) return () => {}
      list.addEventListener('change', onStoreChange)
      return () => list.removeEventListener('change', onStoreChange)
    },
    [query],
  )
  const getSnapshot = useCallback(
    () => mediaQueryList(query)?.matches ?? serverFallback,
    [query, serverFallback],
  )
  const getServerSnapshot = useCallback(() => serverFallback, [serverFallback])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Whether the primary pointer is coarse — the JS twin of `--vx-hit`'s `(pointer: coarse)` query.
 * For a branch CSS cannot express (mount one of two components, attach a keydown listener); styling
 * stays `@media (pointer: coarse)` in a CSS module. Server and hydration snapshot is `false`; a
 * `createRoot` app reads the real pointer on its first render.
 */
export function useCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)', false)
}
