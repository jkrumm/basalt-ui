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
import { flattenNav } from './nav'
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

    // Per-item match, exactly as before: the override wins when supplied, otherwise a router
    // prefix match (`'/'` stays exact). What changed is that this boolean no longer BECOMES
    // `active` on its own — it only says "on the path", and the pass below picks ONE winner
    // across the whole definition so a parent and its child can no longer both read `active`.
    const matchOf = (item: AnyNavItem): boolean =>
      isActiveOverride?.(item) ??
      Boolean(
        matchRoute({
          to: item.link.to,
          ...(item.link.params !== undefined && { params: item.link.params }),
          fuzzy: item.exact !== true && item.link.to !== '/',
        }),
      )

    // One pass over the WHOLE flattened definition (`flattenNav` — depth-first, parent then
    // children, the same order every other reader of a nav config walks it) rather than a
    // per-item independent check, which is what let a parent prefix-match stay lit alongside an
    // exact-matching child. The most SPECIFIC match (most non-empty `/`-segments in `link.to`)
    // wins; a tie (the playground's `reports`/`components` shape, both pointing at `/components`)
    // keeps the FIRST item in definition order, since only a strictly later, strictly longer match
    // ever replaces the current winner below.
    const allItems = flattenNav(config)
    const specificity = (to: string): number => to.split('/').filter(Boolean).length
    const matchedById = new Map<string, boolean>()
    let winnerId: string | undefined
    let winnerTo: string | undefined
    for (const item of allItems) {
      const matched = matchOf(item)
      matchedById.set(item.id, matched)
      if (
        matched &&
        (winnerTo === undefined || specificity(item.link.to) > specificity(winnerTo))
      ) {
        winnerId = item.id
        winnerTo = item.link.to
      }
    }

    // `active` is true for the winner only. `ancestor` is true for a matched item that sits
    // strictly on the winner's PATH (`winnerTo` starts with `item.link.to + '/'`) — a same-length
    // tie loser matches nothing here (its own `to` cannot be a strict prefix of an equally long
    // `winnerTo`), so it reads as neither active nor an ancestor, which is the point: two
    // destinations sharing one route are siblings, not a hierarchy.
    const resolveState = (item: AnyNavItem): { active: boolean; ancestor: boolean } => {
      if (item.id === winnerId) return { active: true, ancestor: false }
      const matched = matchedById.get(item.id) ?? false
      const ancestor = winnerTo !== undefined && matched && winnerTo.startsWith(`${item.link.to}/`)
      return { active: false, ancestor }
    }

    const toSidebarItem = (item: AnyNavItem): SidebarItem => {
      // One anchor per destination. Basalt renders every pixel of chrome around it (desktop row,
      // 56px slot, 44px sheet row) and only hosts this component, so `preload`, middle-click and
      // back/forward all keep working. `Link as ElementType` is the single cast in the whole
      // chain: the widened `AnyNavLink['search']` is `unknown`, which `LinkComponentProps` rejects.
      // The consumer gets zero casts, which is the point.
      //
      // `activeOptions: { exact: true, includeSearch: true }` is what makes `resolveState` above
      // the ONLY authority on active, and it is not a preference — a `Link` computes its own
      // `isActive` (default `activeOptions.exact: false`, i.e. prefix) and spreads
      // `{ 'data-status': 'active', 'aria-current': 'page' }` LAST, after `activeProps` and after
      // every caller prop (`@tanstack/react-router/dist/esm/link.js` — `...isActive &&
      // STATIC_ACTIVE_PROPS` is the final entry of the returned object). So `aria-current` cannot
      // be overridden from outside; the only lever is `isActive` itself. Left at its default, the
      // router re-derived the exact fuzzy match this resolver exists to replace, and at
      // `/dashboard/sessions` BOTH the parent and the child anchor carried `aria-current="page"`
      // even with basalt's own model marking one of them an ancestor — verified in Chrome, and the
      // reason the first attempt at this fix measured as no fix at all. `includeSearch` already
      // defaults to `true` upstream; naming it here is belt-and-braces so a future default change
      // cannot silently reopen the gap.
      //
      // Exact here does NOT narrow basalt's own law. `resolveState` still matches fuzzily and still
      // lights an item whose exact route is never visited; that item is simply named by the
      // `aria-current` `app-sidebar.tsx` stamps itself, which survives because the router's spread
      // is conditional on ITS `isActive` being true. The CSS side no longer treats `aria-current`
      // as a style hook either (`theme/nav-link.module.css`, `shell/app-sidebar.module.css`), so
      // `use-nav`'s single `data-active` winner is the one visual authority even if the router's
      // own `isActive` ever disagreed.
      const Anchor: NavAnchor = (props) =>
        createElement(Link as ElementType, {
          ...item.link,
          activeOptions: { exact: true, includeSearch: true },
          ...props,
        })

      const badge = badgeOf(item.id)
      const children = item.children?.map(toSidebarItem)
      const { active, ancestor } = resolveState(item)

      return {
        key: item.id,
        label: item.label,
        icon: item.icon,
        Anchor,
        // Exactly one destination in the WHOLE definition reads `active` (`resolveState` above).
        // Rolling that up into a mobile SLOT (any descendant active → the slot reads active) is
        // still `projectMobileNav`'s job, which reads `children` for that. `ancestor` is the
        // desktop-only middle state: a matched item that sits on the winner's path but isn't it.
        active,
        ...(ancestor && { ancestor }),
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
