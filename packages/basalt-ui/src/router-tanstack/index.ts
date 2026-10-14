/**
 * ./router-tanstack — headless TanStack Router bridge. The nav half (`defineNav`, `navGroup`,
 * `navTarget`, `flattenNav`, `useBasaltNav`, `NavItemId`) moves to the root barrel in 2.0 and the
 * store half (`createSearchStore`) to `./state`, which re-exports it from `./search-store` directly.
 * The shell's active-state resolver lives in `use-nav.ts` and is not a public export.
 * Optional peer: @tanstack/react-router. No Mantine, no JSX.
 */
import type { ReactNode } from 'react'
import { useLocation } from '@tanstack/react-router'

export { defineNav, navGroup, navTarget, flattenNav } from './nav'
export type { NavItemId } from './nav'

// ── StaticDataRouteOption augmentation ───────────────────────────────────────────────────────────

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** Page/section title. */
    title?: string
    /** Nav icon — ReactNode passed through to the shell SidebarItem. */
    icon?: ReactNode
    /** Groups sidebar items under a named section label. */
    navSection?: string
  }
}

// ── useBasaltNav ──────────────────────────────────────────────────────────────────────────────────

/**
 * The current path and an `isActive` predicate for nav highlighting. `isActive(href)` is a prefix
 * match so a parent stays active on child routes; `{ exact: true }` matches exactly, and `'/'` is
 * always exact. Reads only `useLocation` — navigation stays with TanStack's own `<Link>`.
 *
 * @example
 * const { isActive } = useBasaltNav()
 * <NavLink href={href} active={isActive(href)}>{label}</NavLink>
 */
export function useBasaltNav(): {
  currentPath: string
  isActive: (href: string, opts?: { exact?: boolean }) => boolean
} {
  const currentPath = useLocation({ select: (l) => l.pathname })

  const isActive = (href: string, opts?: { exact?: boolean }): boolean => {
    const exact = opts?.exact === true || href === '/'
    if (exact) return currentPath === href
    return currentPath === href || currentPath.startsWith(href + '/')
  }

  return { currentPath, isActive }
}
