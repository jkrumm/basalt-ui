/**
 * The active item against the live router. A minimal seam: the projector that turns this into rail,
 * tab bar and breadcrumb belongs to the nav runtime, not here.
 */
import { useMemo } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { resolveActive } from './resolve-active'
import type { ActiveNav } from './resolve-active'
import type { AnyNavConfig } from './types'

export function useActiveNav(nav: AnyNavConfig): ActiveNav {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // The change signal: one string that moves on every navigation, including search-param-only ones.
  const href = useRouterState({ select: (s) => s.location.href })
  return useMemo(
    () => resolveActive(nav, pathname),
    // `href` is deliberately an unread dep, and the reason the memo is correct: an `activeWhen` may
    // read router state beyond the pathname, and `href` is the one value that always moves when
    // that state does.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [nav, pathname, href],
  )
}
