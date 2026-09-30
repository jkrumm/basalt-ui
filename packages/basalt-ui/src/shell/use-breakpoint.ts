/**
 * `useBreakpoint` — DEPRECATED (on notice in `MIGRATING.md`, removed in 1.33.0): use
 * `useSizeClass` from `./use-size-class`. One media-query hook over the theme's own breakpoints,
 * built on the shared `useMediaQuery` (`common/use-media-query`) — SSR/hydration-safe.
 *
 * `edge` defaults to `'min'` (`"at least this wide"`); pass `'max'` for `"narrower than"`. The
 * `fallback` (what the server, and a shim with no `matchMedia`, sees) defaults to the answer that
 * assumes the NARROW side of the query — `false` for `min`, `true` for `max` — since a component
 * library cannot know a consumer's real device mix; `options.fallback` overrides it.
 *
 * @example
 * import { useBreakpoint } from 'basalt-ui'
 *
 * const isDesktop = useBreakpoint('sm')            // >= theme.breakpoints.sm
 * const isNarrow = !useBreakpoint('sm')             // < theme.breakpoints.sm
 * const isWide = useBreakpoint('lg')                // >= theme.breakpoints.lg
 */
import { useMantineTheme } from '@mantine/core'
import { useMediaQuery } from '../common/use-media-query'

export type BreakpointName = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/**
 * @deprecated Use `useSizeClass` — removed in 1.33.0 (see `MIGRATING.md`). `theme.breakpoints` is
 * now derived: `sm` moved 48em → 52.5em and `md`/`lg`/`xl` all sit at 75em (`xs`/`sm` collapse,
 * `md`/`lg`/`xl` collapse).
 */
export function useBreakpoint(
  name: BreakpointName,
  edge: 'min' | 'max' = 'min',
  options?: { fallback?: boolean },
): boolean {
  const theme = useMantineTheme()
  const bp = theme.breakpoints[name]
  const fallback = options?.fallback ?? edge === 'max'
  return useMediaQuery(`(${edge}-width: ${bp})`, fallback)
}
