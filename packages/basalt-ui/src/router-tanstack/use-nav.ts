/**
 * Resolve a `defineNav` definition into the two props `BasaltShell` renders from.
 *
 * One `defineNav([...])` in a leaf module produces the desktop sidebar AND the mobile bar: this
 * hook resolves active state through the router and builds each destination's anchor, which is
 * what deletes a consumer's `renderNavLink` / `renderBreadcrumbLink` / `NAV_TARGETS` table and
 * every hand-written `useMatchRoute` call.
 *
 * No JSX — anchors are built with `createElement`, so `./router-tanstack` stays a headless,
 * no-JSX `.ts` module per its own barrel contract.
 */
import { createElement, forwardRef, useMemo, useState } from 'react'
import type { AnchorHTMLAttributes, ElementType, ReactNode } from 'react'
import { Link, useMatchRoute, useRouterState } from '@tanstack/react-router'
import type {
  ActiveCrumb,
  MobileNavConfig,
  NavAnchor,
  SidebarItem,
  SidebarSection,
} from '../shell/nav-types'
import { flattenNav } from './nav-stash'
import type { AnyNavGroup, AnyNavItem, NavConfig, NavItemId, NavTabId } from './nav'

export type UseNavOptions<G extends ReadonlyArray<AnyNavGroup>> = {
  /**
   * Live per-destination badges, keys typed to the definition's id union.
   * A `number` becomes `item.count` (desktop `NavCountBadge` + mobile dot).
   * Anything else becomes `item.badge` (desktop only).
   */
  badges?: Partial<Record<NavItemId<G>, number | ReactNode>>
  /** Override active detection entirely. Keep it stable (module scope or memoized). */
  isActive?: (item: AnyNavItem & { id: NavItemId<G> }) => boolean
  getScrollElement?: () => HTMLElement | null
}

type OverriddenAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  'data-status'?: string
  'data-basalt-current'?: 'page' | 'true'
  _asChild?: unknown
}

/**
 * The host `Link` renders as when `isActive` overrides the router (via the undocumented
 * `props._asChild` seam, re-verified per router bump in `MAINTAINING.md`). It drops the router's
 * `aria-current` / `data-status` and re-applies only basalt's verdict, passed as
 * `data-basalt-current`, so a router-matched loser cannot claim the page.
 */
const OverriddenAnchor = forwardRef<HTMLAnchorElement, OverriddenAnchorProps>((props, ref) => {
  const {
    'aria-current': _routerCurrent,
    'data-status': _routerStatus,
    'data-basalt-current': current,
    _asChild: _host,
    ...rest
  } = props
  return createElement('a', {
    ...rest,
    ...(current !== undefined && { 'aria-current': current, 'data-status': 'active' }),
    ref,
  })
})
OverriddenAnchor.displayName = 'OverriddenAnchor'

/** What this resolver turns a definition into: `ShellFrame`'s sidebar sections and mobile-bar tuning. */
export type ResolvedNav = {
  sections: SidebarSection[]
  mobileNav: MobileNavConfig
  /** The breadcrumb for the one active destination; `undefined` when nothing matches. */
  activeCrumb: ActiveCrumb | undefined
}

/**
 * One anchor per destination for the life of its `config`: a fresh function per resolve is a new
 * component TYPE and remounts every nav `<a>` on each navigation. Nothing per-render is closed over;
 * active state arrives as the `aria-current` prop. Keyed by override mode because `isActive` swaps
 * the host element (`OverriddenAnchor`).
 */
const anchorCache = new WeakMap<object, Map<boolean, Map<string, NavAnchor>>>()

function anchorFor(config: object, item: AnyNavItem, overridden: boolean): NavAnchor {
  let byMode = anchorCache.get(config)
  if (!byMode) anchorCache.set(config, (byMode = new Map()))
  let byId = byMode.get(overridden)
  if (!byId) byMode.set(overridden, (byId = new Map()))
  const cached = byId.get(item.id)
  if (cached) return cached
  // `exact: true` makes `resolveState` the only authority on active: a `Link` spreads its own
  // `aria-current` LAST and cannot be overridden from outside, so a prefix-matching parent would
  // otherwise claim the page beside its child. `Link as ElementType` is the one cast in the chain.
  const Anchor: NavAnchor = (props) =>
    createElement(Link as ElementType, {
      ...item.link,
      activeOptions: { exact: true, includeSearch: true },
      ...(overridden && {
        _asChild: OverriddenAnchor,
        'data-basalt-current': props['aria-current'],
      }),
      ...props,
    })
  byId.set(item.id, Anchor)
  return Anchor
}

const NO_BADGES: Readonly<Record<string, unknown>> = {}

/** Shallow equality over own keys; `undefined` and `{}` are the same (no badges). */
function shallowEqual(
  a: Readonly<Record<string, unknown>> = NO_BADGES,
  b: Readonly<Record<string, unknown>> = NO_BADGES,
): boolean {
  if (a === b) return true
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every((k) => Object.hasOwn(b, k) && Object.is(a[k], b[k]))
  )
}

/** The breadcrumb for `winnerId`: its group, and its immediate parent when nested. */
function crumbOf(
  config: { groups: ReadonlyArray<AnyNavGroup> },
  winnerId: string | undefined,
  overridden: boolean,
): ActiveCrumb | undefined {
  const find = (
    items: ReadonlyArray<AnyNavItem>,
    section: string,
    parent?: AnyNavItem,
  ): ActiveCrumb | undefined => {
    for (const item of items) {
      if (item.id === winnerId) {
        const parentCrumb = parent && {
          parent: parent.label,
          parentAnchor: anchorFor(config, parent, overridden),
        }
        return { section, page: item.label, ...parentCrumb }
      }
      const nested = item.children && find(item.children, section, item)
      if (nested) return nested
    }
  }
  for (const group of config.groups) {
    const found = find(group.items, group.label)
    if (found) return found
  }
}

/**
 * Resolve a nav definition against the live router into `BasaltShell`'s internal `ShellFrame`
 * props. Shell-internal: a consumer passes `nav={NAV}` to `BasaltShell` and never calls this.
 */
export function useNav<
  const G extends ReadonlyArray<AnyNavGroup>,
  const T extends ReadonlyArray<NavTabId<G>>,
>(config: NavConfig<G, T>, opts?: UseNavOptions<G>): ResolvedNav {
  // `useMatchRoute` is `useCallback(fn, [router])` — a STABLE identity across renders — and it
  // subscribes internally to `router.stores.matchRouteDeps`, so the component still re-renders on
  // navigation. That makes it safe as a memo dep, and makes the memo below actually hit.
  const matchRoute = useMatchRoute()
  // The change signal: one string that moves on every navigation, including search-param-only ones.
  const href = useRouterState({ select: (s) => s.location.href })

  // Keep the previous badges object while every value is unchanged, so an inline literal never
  // rebuilds the sections below. Adjusting state during render is React's sanctioned form of this.
  const [badges, setBadges] = useState(opts?.badges)
  if (!shallowEqual(badges, opts?.badges)) setBadges(opts?.badges)
  const isActiveOverride = opts?.isActive

  const resolved = useMemo<Pick<ResolvedNav, 'sections' | 'activeCrumb'>>(() => {
    const badgeOf = (id: string): number | ReactNode =>
      (badges as Readonly<Record<string, number | ReactNode>> | undefined)?.[id]

    // "On the path" only: the override wins, else a router prefix match (`'/'` stays exact). The
    // pass below picks the ONE `active` winner.
    const matchOf = (item: AnyNavItem): boolean =>
      isActiveOverride?.(item as AnyNavItem & { id: NavItemId<G> }) ??
      Boolean(
        matchRoute({
          to: item.link.to,
          ...(item.link.params !== undefined && { params: item.link.params }),
          fuzzy: item.exact !== true && item.link.to !== '/',
        }),
      )

    // One pass over the flattened definition: the most SPECIFIC match (most `/`-segments in
    // `link.to`) wins, and a tie keeps the FIRST item in definition order.
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

    // `active` is the winner only; `ancestor` is a matched item strictly on the winner's path. Two
    // destinations sharing one route are siblings, so a tie loser is neither.
    const resolveState = (item: AnyNavItem): { active: boolean; ancestor: boolean } => {
      if (item.id === winnerId) return { active: true, ancestor: false }
      const matched = matchedById.get(item.id) ?? false
      const ancestor = winnerTo !== undefined && matched && winnerTo.startsWith(`${item.link.to}/`)
      return { active: false, ancestor }
    }

    const overridden = isActiveOverride !== undefined

    const toSidebarItem = (item: AnyNavItem): SidebarItem => {
      // One anchor per destination, hosted by basalt's own chrome (desktop row, 56px slot, 44px
      // sheet row), so `preload`, middle-click and back/forward all keep working.
      const Anchor = anchorFor(config, item, overridden)
      const badge = badgeOf(item.id)
      const children = item.children?.map(toSidebarItem)
      const { active, ancestor } = resolveState(item)

      return {
        key: item.id,
        label: item.label,
        icon: item.icon,
        Anchor,
        // Exactly one destination reads `active`; `projectMobileNav` rolls it up into mobile slots.
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

    const sections = config.groups.map((group) => ({
      label: group.label,
      items: group.items.map(toSidebarItem),
      ...(group.icon !== undefined && { icon: group.icon }),
      ...(group.collapsible !== undefined && { collapsible: group.collapsible }),
      ...(group.defaultCollapsed !== undefined && { defaultCollapsed: group.defaultCollapsed }),
      ...(group.mobile !== undefined && { mobile: group.mobile }),
    }))
    return { sections, activeCrumb: crumbOf(config, winnerId, overridden) }
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

  return { ...resolved, mobileNav }
}
