/**
 * `useNav` — resolve a `defineNav` definition into the two props `BasaltShell` needs.
 *
 * One `defineNav([...])` in a leaf module produces the desktop sidebar AND the mobile bar: this
 * hook resolves active state through the router and builds each destination's anchor, which is
 * what deletes a consumer's `renderNavLink` / `renderBreadcrumbLink` / `NAV_TARGETS` table and
 * every hand-written `useMatchRoute` call.
 *
 * No JSX — anchors are built with `createElement`, so `./router-tanstack` stays a headless,
 * no-JSX `.ts` module per its own barrel contract.
 */
import { createElement, useMemo } from 'react'
import type { ElementType, ReactNode } from 'react'
import { Link, useMatchRoute, useRouterState } from '@tanstack/react-router'
import type { MobileNavConfig, NavAnchor, SidebarItem, SidebarSection } from '../nav/types'
import type { AnyNavGroup, AnyNavItem, NavConfig, NavItemId, NavTabId } from './nav'

export type UseNavOptions<G extends ReadonlyArray<AnyNavGroup>> = {
  /**
   * Live per-destination badges, keys typed to the definition's id union.
   * A `number` becomes `item.count` (desktop `NavCountBadge` + mobile dot).
   * Anything else becomes `item.badge` (desktop only).
   */
  badges?: Partial<Record<NavItemId<G>, number | ReactNode>>
  /** Override active detection entirely. */
  isActive?: (item: AnyNavItem) => boolean
  getScrollElement?: () => HTMLElement | null
}

/** Spread straight onto `<BasaltShell {...nav} />` — both keys are `BasaltShellProps` keys. */
export type NavBinding = { sections: SidebarSection[]; mobileNav: MobileNavConfig }

/**
 * Resolve a nav definition against the live router.
 *
 * @example
 * const nav = useNav(NAV, { badges: { calendar: 3 } })
 * return <BasaltShell brand={brand} {...nav}>{children}</BasaltShell>
 */
export function useNav<
  const G extends ReadonlyArray<AnyNavGroup>,
  const T extends ReadonlyArray<NavTabId<G>>,
>(config: NavConfig<G, T>, opts?: UseNavOptions<G>): NavBinding {
  // `useMatchRoute` is `useCallback(fn, [router])` — a STABLE identity across renders — and it
  // subscribes internally to `router.stores.matchRouteDeps`, so the component still re-renders on
  // navigation. That makes it safe as a memo dep, and makes the memo below actually hit.
  const matchRoute = useMatchRoute()
  // The change signal: one string that moves on every navigation, including search-param-only ones.
  const href = useRouterState({ select: (s) => s.location.href })

  const badges = opts?.badges
  const isActiveOverride = opts?.isActive

  const sections = useMemo<SidebarSection[]>(() => {
    const badgeOf = (id: string): number | ReactNode =>
      (badges as Record<string, number | ReactNode> | undefined)?.[id]

    const isActive = (item: AnyNavItem): boolean =>
      isActiveOverride?.(item) ??
      Boolean(
        matchRoute({
          to: item.link.to,
          ...(item.link.params !== undefined && { params: item.link.params }),
          // Prefix match by default so a parent stays lit on its children; `'/'` would then match
          // everything, so it is always exact.
          fuzzy: item.exact !== true && item.link.to !== '/',
        }),
      )

    const toSidebarItem = (item: AnyNavItem): SidebarItem => {
      // One anchor per destination. Basalt renders every pixel of chrome around it (desktop row,
      // 56px slot, 44px sheet row) and only hosts this component, so `preload`, middle-click and
      // back/forward all keep working. `Link as ElementType` is the single cast in the whole
      // chain: the widened `AnyNavLink['search']` is `unknown`, which `LinkComponentProps` rejects.
      // The consumer gets zero casts, which is the point.
      const Anchor: NavAnchor = (props) =>
        createElement(Link as ElementType, { ...item.link, ...props })

      const badge = badgeOf(item.id)
      const children = item.children?.map(toSidebarItem)

      return {
        key: item.id,
        label: item.label,
        icon: item.icon,
        Anchor,
        // Per-destination active only. Rolling a child's active state up into its parent is the
        // MOBILE SLOT's rule (§2.3.12) and belongs to `projectMobileNav`, which reads `children`
        // anyway — doing it here too would also light a desktop parent row whose own route does
        // not match.
        active: isActive(item),
        ...(item.short !== undefined && { short: item.short }),
        ...(item.mobile !== undefined && { mobile: item.mobile }),
        ...(item.disabled !== undefined && { disabled: item.disabled }),
        ...(typeof badge === 'number'
          ? { count: badge }
          : badge === undefined || badge === null
            ? {}
            : { badge }),
        ...(children !== undefined && { children }),
      }
    }

    return config.groups.map((group) => ({
      label: group.label,
      items: group.items.map(toSidebarItem),
      ...(group.icon !== undefined && { icon: group.icon }),
      ...(group.collapsible !== undefined && { collapsible: group.collapsible }),
      ...(group.defaultCollapsed !== undefined && { defaultCollapsed: group.defaultCollapsed }),
      ...(group.mobile !== undefined && { mobile: group.mobile }),
    }))
    // `href` is deliberately an unread dep, and the reason the memo is correct: `matchRoute` has a
    // STABLE identity (`useCallback(fn, [router])`), so nothing else in this list moves on a
    // navigation — while the `matchRoute` calls above read router state that just changed. `href`
    // is the one value that always does move, so it is what re-derives `active`.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [config, matchRoute, href, badges, isActiveOverride])

  const mobile = config.mobile
  const getScrollElement = opts?.getScrollElement

  const mobileNav = useMemo<MobileNavConfig>(() => {
    // `MobileNavConfig.tabs` names SIDEBAR keys, and a `SidebarSection` is identified by its
    // `label` (it carries no key). A group id in `mobile.tabs` is therefore translated to that
    // group's label here; item ids pass through verbatim because `SidebarItem.key` IS the id.
    const groupLabelById = new Map(config.groups.map((g) => [g.id, g.label]))
    const tabs = mobile?.tabs?.map((id) => {
      const key = id as string
      return groupLabelById.get(key) ?? key
    })

    return {
      ...(tabs !== undefined && { tabs }),
      ...(mobile?.maxTabs !== undefined && { maxTabs: mobile.maxTabs }),
      ...(mobile?.menuMax !== undefined && { menuMax: mobile.menuMax }),
      ...(mobile?.moreLabel !== undefined && { moreLabel: mobile.moreLabel }),
      ...(getScrollElement !== undefined && { getScrollElement }),
    }
  }, [config, mobile, getScrollElement])

  return { sections, mobileNav }
}
