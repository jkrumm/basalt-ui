/**
 * ./router-tanstack — headless TanStack Router bridge for the app shell.
 * Optional peer: @tanstack/react-router.
 * Augments StaticDataRouteOption with title/icon/navSection for breadcrumb
 * and nav-active wiring — no Mantine, no JSX, no navigate() helper.
 */

export {
  createSearchParamStore,
  type SearchParamStore,
  type SearchParamStoreOptions,
} from './search-param-store'
import type { ReactNode } from 'react'
import { useLocation, useMatches } from '@tanstack/react-router'

// ── StaticDataRouteOption augmentation ───────────────────────────────────────────────────────────

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** Page/section title — drives breadcrumbs via useRouterBreadcrumbs(). */
    title?: string
    /** Nav icon — ReactNode passed through to the shell SidebarItem. */
    icon?: ReactNode
    /** Groups sidebar items under a named section label. */
    navSection?: string
  }
}

// ── useBasaltNav ──────────────────────────────────────────────────────────────────────────────────

/** Reactive nav-active state derived from the current TanStack Router location. */
export type BasaltNav = {
  /** Current pathname (reactive, updates on every navigation). */
  currentPath: string
  /**
   * True when `href` matches the current route.
   * Default: prefix match so a parent nav item stays active on child routes.
   * Pass `{ exact: true }` for exact-only matching.
   * The root `'/'` always matches exactly regardless of the option.
   */
  isActive: (href: string, opts?: { exact?: boolean }) => boolean
}

/**
 * Returns the current path and an `isActive` predicate for nav highlighting.
 * Reads only `useLocation` — no navigate, no typed-route `to` casts.
 * Navigation stays with TanStack's own typed `<Link>` / `useNavigate`.
 *
 * @example
 * import { useBasaltNav } from 'basalt-ui/router-tanstack'
 *
 * function NavItem({ href, label }: { href: string; label: string }) {
 *   const { isActive } = useBasaltNav()
 *   return <NavLink href={href} active={isActive(href)}>{label}</NavLink>
 * }
 */
export function useBasaltNav(): BasaltNav {
  const currentPath = useLocation({ select: (l) => l.pathname })

  const isActive = (href: string, opts?: { exact?: boolean }): boolean => {
    const exact = opts?.exact === true || href === '/'
    if (exact) return currentPath === href
    return currentPath === href || currentPath.startsWith(href + '/')
  }

  return { currentPath, isActive }
}

// ── useRouterBreadcrumbs ──────────────────────────────────────────────────────────────────────────

/** A single breadcrumb entry projected from route staticData. */
export type BasaltBreadcrumb = {
  /** The route's `staticData.title`. */
  title: string
  /** The matched pathname for this ancestor (usable as `<Link to={href}>` target). */
  href: string
}

/**
 * Returns the ancestor→deepest breadcrumb trail derived from `staticData.title` on each match.
 * Routes without a `staticData.title` are silently omitted.
 * Uses the `select` form of `useMatches` for re-render gating — only re-renders when the
 * projected breadcrumb array actually changes shape.
 *
 * @example
 * import { useRouterBreadcrumbs } from 'basalt-ui/router-tanstack'
 *
 * function AppBreadcrumbs() {
 *   const crumbs = useRouterBreadcrumbs()
 *   return (
 *     <nav aria-label="breadcrumb">
 *       {crumbs.map((c) => <a key={c.href} href={c.href}>{c.title}</a>)}
 *     </nav>
 *   )
 * }
 */
export function useRouterBreadcrumbs(): BasaltBreadcrumb[] {
  return useMatches({
    select: (matches) =>
      matches.flatMap((m) =>
        typeof m.staticData?.title === 'string'
          ? [{ title: m.staticData.title, href: m.pathname }]
          : [],
      ),
  })
}
